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

  // GET /api/matches/:match_id/bets?group_id=...
  // Returns all bets for the match from members of the specified group (only
  // if the match is live or finished — predictions stay private until kickoff).
  const betsMatch = pathname.match(/^\/api\/matches\/([^\/]+)\/bets$/);
  if (betsMatch && request.method === "GET") {
    const matchId = betsMatch[1];
    const groupId = searchParams.get("group_id");
    if (!groupId) return err("group_id required", 400, origin);

    const member = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?")
      .bind(groupId, auth.userId).first();
    if (!member) return err("Not a member of this group", 403, origin);

    const match = await env.DB.prepare(
      "SELECT id, home_team, away_team, home_team_code, away_team_code, match_date, home_score, away_score, status, stage, group_name FROM matches WHERE id = ?"
    ).bind(matchId).first<{ status: string; match_date: number }>();
    if (!match) return err("Match not found", 404, origin);

    const kickoffPassed = (match.match_date * 1000) <= Date.now();
    if (match.status === "scheduled" && !kickoffPassed) {
      return err("Bets are hidden until kickoff", 423, origin);
    }

    const rows = await env.DB.prepare(`
      SELECT gm.user_id, gm.pseudo,
             b.home_score_pred, b.away_score_pred, b.confidence, b.double_up, b.points_earned
      FROM group_members gm
      LEFT JOIN bets b ON b.user_id = gm.user_id AND b.group_id = gm.group_id AND b.match_id = ?
      WHERE gm.group_id = ?
    `).bind(matchId, groupId).all();

    return json({ match, bets: rows.results }, 200, origin);
  }

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
               b.home_score_pred, b.away_score_pred, b.points_earned, b.confidence, b.double_up
        FROM matches m
        LEFT JOIN bets b ON b.match_id = m.id AND b.user_id = ? AND b.group_id = ?
        ORDER BY m.match_date ASC
      `).bind(auth.userId, groupId).all();

      return json(rows.results.map((r: Record<string, unknown>) => ({
        ...r,
        my_bet: r.home_score_pred !== null
          ? { home_score_pred: r.home_score_pred, away_score_pred: r.away_score_pred, points_earned: r.points_earned, confidence: r.confidence, double_up: r.double_up }
          : undefined,
        home_score_pred: undefined,
        away_score_pred: undefined,
        points_earned: undefined,
        confidence: undefined,
        double_up: undefined,
      })), 200, origin);
    }

    // All matches (no bet data)
    const rows = await env.DB.prepare("SELECT * FROM matches ORDER BY match_date ASC").all();
    return json(rows.results, 200, origin);
  }

  return err("Not found", 404, origin);
}
