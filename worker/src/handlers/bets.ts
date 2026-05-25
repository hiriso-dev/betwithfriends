import { Env, AuthContext } from "../types";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

const BET_LOCK_MINUTES = 5;

export async function handleBets(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  const { pathname } = url;

  if (pathname !== "/api/bets") return err("Not found", 404, origin);

  // POST /api/bets — place or update a bet
  if (request.method === "POST") {
    const { match_id, group_id, home_score_pred, away_score_pred } =
      await request.json<{
        match_id: string;
        group_id: string;
        home_score_pred: number;
        away_score_pred: number;
      }>();

    if (!match_id || !group_id) return err("match_id and group_id required", 400, origin);
    if (typeof home_score_pred !== "number" || typeof away_score_pred !== "number")
      return err("Scores must be numbers", 400, origin);
    if (home_score_pred < 0 || away_score_pred < 0 || home_score_pred > 20 || away_score_pred > 20)
      return err("Score out of range", 400, origin);

    // Check group membership
    const member = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?")
      .bind(group_id, auth.userId).first();
    if (!member) return err("Not a member of this group", 403, origin);

    // Check match exists and is not locked
    const match = await env.DB.prepare("SELECT match_date, status FROM matches WHERE id = ?")
      .bind(match_id).first<{ match_date: number; status: string }>();
    if (!match) return err("Match not found", 404, origin);

    const minutesUntilKickoff = (match.match_date * 1000 - Date.now()) / 60000;
    if (minutesUntilKickoff <= BET_LOCK_MINUTES || match.status !== "scheduled") {
      return err("Betting is closed for this match", 423, origin);
    }

    // Upsert bet
    await env.DB.prepare(`
      INSERT INTO bets (id, user_id, group_id, match_id, home_score_pred, away_score_pred, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(user_id, group_id, match_id)
      DO UPDATE SET home_score_pred = excluded.home_score_pred,
                    away_score_pred = excluded.away_score_pred,
                    updated_at = unixepoch()
    `).bind(
      crypto.randomUUID(), auth.userId, group_id, match_id,
      Math.round(home_score_pred), Math.round(away_score_pred)
    ).run();

    return json({ ok: true }, 200, origin);
  }

  return err("Method not allowed", 405, origin);
}
