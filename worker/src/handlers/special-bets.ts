import { Env, AuthContext } from "../types";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

const WC_2026_START = new Date("2026-06-11T21:00:00Z").getTime();

export const POINTS_MAP: Record<string, number> = {
  champion: 50,
  runner_up: 20,
  third_place: 15,
  top_scorer: 30,
};

export async function handleSpecialBets(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  const { pathname, searchParams } = url;

  if (!pathname.startsWith("/api/special-bets")) return err("Not found", 404, origin);

  // GET /api/special-bets?group_id=...
  if (request.method === "GET") {
    const groupId = searchParams.get("group_id");
    if (!groupId) return err("group_id required", 400, origin);

    const member = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?")
      .bind(groupId, auth.userId).first();
    if (!member) return err("Not a member", 403, origin);

    const rows = await env.DB.prepare(
      "SELECT bet_type, bet_value, points_earned FROM special_bets WHERE user_id = ? AND group_id = ?"
    ).bind(auth.userId, groupId).all();

    return json(rows.results, 200, origin);
  }

  // POST /api/special-bets
  if (request.method === "POST") {
    if (Date.now() >= WC_2026_START) return err("Tournament has started — special bets are locked", 423, origin);

    const { group_id, bet_type, bet_value } =
      await request.json<{ group_id: string; bet_type: string; bet_value: string }>();

    if (!group_id || !bet_type || !bet_value?.trim()) return err("Missing fields", 400, origin);
    if (!POINTS_MAP[bet_type]) return err("Invalid bet type", 400, origin);

    const member = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?")
      .bind(group_id, auth.userId).first();
    if (!member) return err("Not a member", 403, origin);

    await env.DB.prepare(`
      INSERT INTO special_bets (id, user_id, group_id, bet_type, bet_value)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, group_id, bet_type)
      DO UPDATE SET bet_value = excluded.bet_value
    `).bind(crypto.randomUUID(), auth.userId, group_id, bet_type, bet_value.trim()).run();

    return json({ ok: true }, 200, origin);
  }

  return err("Method not allowed", 405, origin);
}
