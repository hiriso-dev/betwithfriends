import { Env, AuthContext } from "../types";
import { syncScores } from "../services/scores-sync";
import { POINTS_MAP } from "./special-bets";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

const ADMIN_EMAIL = "jerome.ladeveze@gmail.com";

export async function handleAdmin(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  if (auth.email !== ADMIN_EMAIL) return err("Forbidden", 403, origin);

  const { pathname } = url;

  // POST /api/admin/sync — pull matches from football-data.org into the DB
  if (pathname === "/api/admin/sync" && request.method === "POST") {
    if (!env.FOOTBALL_DATA_API_KEY) {
      return err("FOOTBALL_DATA_API_KEY not set", 503, origin);
    }
    const body = await request.json<{ competition?: string }>().catch(() => ({}));
    const competition = (body as { competition?: string }).competition ?? "WC";
    await syncScores(env, competition);
    return json({ ok: true, competition }, 200, origin);
  }

  // POST /api/admin/resolve-special — settle tournament special bets.
  // Body: { results: { champion?, runner_up?, third_place?, top_scorer? } }
  // Idempotent: recomputes points_earned for every matching bet and applies
  // only the delta to total_points, so re-running (or fixing a typo) is safe.
  if (pathname === "/api/admin/resolve-special" && request.method === "POST") {
    const body = await request
      .json<{ results?: Record<string, string> }>()
      .catch(() => ({} as { results?: Record<string, string> }));
    const results = body.results ?? {};

    const summary: Record<string, { winners: number; settled: number }> = {};

    for (const betType of Object.keys(POINTS_MAP)) {
      const winning = results[betType]?.trim();
      if (!winning) continue; // skip bet types the admin left blank

      const fullPts = POINTS_MAP[betType];
      const norm = winning.toLowerCase();

      const bets = await env.DB.prepare(
        "SELECT id, user_id, group_id, bet_value, points_earned FROM special_bets WHERE bet_type = ?"
      ).bind(betType).all<{
        id: string; user_id: string; group_id: string;
        bet_value: string; points_earned: number | null;
      }>();

      let winners = 0;
      for (const b of bets.results) {
        const newPts = b.bet_value.trim().toLowerCase() === norm ? fullPts : 0;
        const oldPts = b.points_earned ?? 0;
        if (newPts > 0) winners++;

        await env.DB.prepare("UPDATE special_bets SET points_earned = ? WHERE id = ?")
          .bind(newPts, b.id).run();

        const delta = newPts - oldPts;
        if (delta !== 0) {
          await env.DB.prepare(
            "UPDATE group_members SET total_points = total_points + ? WHERE group_id = ? AND user_id = ?"
          ).bind(delta, b.group_id, b.user_id).run();
        }
      }

      summary[betType] = { winners, settled: bets.results.length };
    }

    return json({ ok: true, summary }, 200, origin);
  }

  return err("Not found", 404, origin);
}
