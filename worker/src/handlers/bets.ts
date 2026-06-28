import { Env, AuthContext } from "../types";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

const BET_LOCK_MINUTES = 0;
// Double Ups: 2 may be spent in the group stage; the whole tournament is capped
// at 4. So the knockout phase gets 4 − (group-stage used) — unused group-stage
// Double Ups roll over (0 group used → 4 in knockouts, 1 → 3, 2 → 2).
const MAX_DOUBLE_UPS = 2;
const MAX_DOUBLE_UPS_TOURNAMENT = 4;

async function ensureBetColumns(env: Env): Promise<void> {
  try {
    await env.DB.prepare("SELECT confidence FROM bets LIMIT 1").first();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("no such column")) throw e;
    await env.DB.prepare("ALTER TABLE bets ADD COLUMN confidence TEXT").run();
    await env.DB.prepare("ALTER TABLE bets ADD COLUMN double_up INTEGER DEFAULT 0").run();
  }
}

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

  if (request.method === "POST") {
    await ensureBetColumns(env);

    const { match_id, group_id, home_score_pred, away_score_pred, confidence, double_up } =
      await request.json<{
        match_id: string;
        group_id: string;
        home_score_pred: number;
        away_score_pred: number;
        confidence?: string | null;
        double_up?: boolean;
      }>();

    if (!match_id || !group_id) return err("match_id and group_id required", 400, origin);
    if (typeof home_score_pred !== "number" || typeof away_score_pred !== "number")
      return err("Scores must be numbers", 400, origin);
    if (home_score_pred < 0 || away_score_pred < 0 || home_score_pred > 20 || away_score_pred > 20)
      return err("Score out of range", 400, origin);
    if (confidence && !["cautious", "confident", "reckless"].includes(confidence))
      return err("Invalid confidence level", 400, origin);

    const member = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?")
      .bind(group_id, auth.userId).first();
    if (!member) return err("Not a member of this group", 403, origin);

    const match = await env.DB.prepare("SELECT match_date, status, group_name, stage FROM matches WHERE id = ?")
      .bind(match_id).first<{ match_date: number; status: string; group_name: string | null; stage: string | null }>();
    if (!match) return err("Match not found", 404, origin);

    const minutesUntilKickoff = (match.match_date * 1000 - Date.now()) / 60000;
    if (minutesUntilKickoff <= BET_LOCK_MINUTES || match.status !== "scheduled")
      return err("Betting is closed for this match", 423, origin);

    // Double Up budget: 2 in the group stage, 4 across the whole tournament, so
    // the knockout phase gets whatever's left (unused group-stage ones roll over).
    // Knockout matches carry no group_name; group-stage rows always do.
    const isKnockout = match.group_name === null && match.stage !== "Group Stage";
    if (double_up) {
      const existing = await env.DB.prepare(
        "SELECT COALESCE(double_up, 0) as double_up FROM bets WHERE user_id = ? AND group_id = ? AND match_id = ?"
      ).bind(auth.userId, group_id, match_id).first<{ double_up: number }>();

      const alreadyUsedHere = (existing?.double_up ?? 0) === 1;

      if (!alreadyUsedHere) {
        if (isKnockout) {
          // Knockout draws on the shared tournament budget of 4 (group stage is
          // separately capped at 2), so count ALL of the user's double-ups here.
          const used = await env.DB.prepare(
            "SELECT COUNT(*) as cnt FROM bets WHERE user_id = ? AND group_id = ? AND COALESCE(double_up, 0) = 1"
          ).bind(auth.userId, group_id).first<{ cnt: number }>();
          if ((used?.cnt ?? 0) >= MAX_DOUBLE_UPS_TOURNAMENT)
            return err(`No Double Ups remaining (max ${MAX_DOUBLE_UPS_TOURNAMENT} across the tournament)`, 400, origin);
        } else {
          // Group stage stays capped at 2 — count only group-stage double-ups.
          const used = await env.DB.prepare(
            `SELECT COUNT(*) as cnt
             FROM bets b
             JOIN matches m ON m.id = b.match_id
             WHERE b.user_id = ? AND b.group_id = ? AND COALESCE(b.double_up, 0) = 1
               AND NOT (m.group_name IS NULL AND COALESCE(m.stage, '') != 'Group Stage')`
          ).bind(auth.userId, group_id).first<{ cnt: number }>();
          if ((used?.cnt ?? 0) >= MAX_DOUBLE_UPS)
            return err(`No Double Ups remaining for the group stage (max ${MAX_DOUBLE_UPS})`, 400, origin);
        }
      }
    }

    await env.DB.prepare(`
      INSERT INTO bets (id, user_id, group_id, match_id, home_score_pred, away_score_pred, confidence, double_up, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(user_id, group_id, match_id)
      DO UPDATE SET
        home_score_pred = excluded.home_score_pred,
        away_score_pred = excluded.away_score_pred,
        confidence      = excluded.confidence,
        double_up       = excluded.double_up,
        updated_at      = unixepoch()
    `).bind(
      crypto.randomUUID(), auth.userId, group_id, match_id,
      Math.round(home_score_pred), Math.round(away_score_pred),
      confidence ?? null,
      double_up ? 1 : 0
    ).run();

    return json({ ok: true }, 200, origin);
  }

  return err("Method not allowed", 405, origin);
}
