import { Env, AuthContext } from "../types";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

export async function handleMatches(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  const { pathname, searchParams } = url;

  // GET /api/matches?group_id=...
  if (pathname === "/api/matches" && request.method === "GET") {
    const groupId = searchParams.get("group_id");

    if (groupId && groupId !== "all") {
      // Verify membership
      const member = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?")
        .bind(groupId, auth.userId).first();
      if (!member) return err("Not a member of this group", 403, origin);

      // Matches with user's bets for this group
      const rows = await env.DB.prepare(`
        SELECT m.*,
               b.home_score_pred, b.away_score_pred, b.points_earned
        FROM matches m
        LEFT JOIN bets b ON b.match_id = m.id AND b.user_id = ? AND b.group_id = ?
        ORDER BY m.match_date ASC
      `).bind(auth.userId, groupId).all();

      return json(rows.results.map((r: Record<string, unknown>) => ({
        ...r,
        my_bet: r.home_score_pred !== null
          ? { home_score_pred: r.home_score_pred, away_score_pred: r.away_score_pred, points_earned: r.points_earned }
          : undefined,
        home_score_pred: undefined,
        away_score_pred: undefined,
        points_earned: undefined,
      })), 200, origin);
    }

    // All matches (no bet data)
    const rows = await env.DB.prepare("SELECT * FROM matches ORDER BY match_date ASC").all();
    return json(rows.results, 200, origin);
  }

  return err("Not found", 404, origin);
}
