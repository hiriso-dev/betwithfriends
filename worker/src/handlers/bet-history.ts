import { Env, AuthContext } from "../types";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

export async function handleBetHistory(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  const { pathname, searchParams } = url;

  if (pathname === "/api/bets/history" && request.method === "GET") {
    const groupId = searchParams.get("group_id") || null;
    const targetUserId = searchParams.get("user_id") || null;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    // Whose history are we fetching? Default to the caller's own.
    const viewingUserId = targetUserId ?? auth.userId;
    const isOther = viewingUserId !== auth.userId;

    // Viewing another member's history is always group-scoped.
    if (isOther && !groupId) {
      return err("group_id is required when viewing another user", 400, origin);
    }

    // If group_id provided, verify caller is a member
    if (groupId) {
      const member = await env.DB.prepare(
        "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?"
      ).bind(groupId, auth.userId).first();
      if (!member) return err("Not a member of this group", 403, origin);
    }

    // When viewing another member, resolve their group nickname — this also
    // verifies the target is a member of the scoped group.
    let targetPseudo: string | null = null;
    if (isOther) {
      const targetMember = await env.DB.prepare(
        "SELECT pseudo FROM group_members WHERE group_id = ? AND user_id = ?"
      ).bind(groupId, viewingUserId).first<{ pseudo: string }>();
      if (!targetMember) return err("User is not a member of this group", 403, origin);
      targetPseudo = targetMember.pseudo;
    }

    // Hide a non-self target's not-yet-started predictions (bet-visibility).
    const visibilityFilter = isOther ? "AND m.match_date <= unixepoch()" : "";
    const groupFilter = groupId ? "AND b.group_id = ?" : "";
    const dataBinds = groupId
      ? [viewingUserId, groupId, limit, offset]
      : [viewingUserId, limit, offset];
    const countBinds = groupId
      ? [viewingUserId, groupId]
      : [viewingUserId];

    const rows = await env.DB.prepare(`
      SELECT
        b.id,
        b.group_id,
        g.name AS group_name,
        b.match_id,
        m.home_team,
        m.away_team,
        m.home_team_code,
        m.away_team_code,
        m.match_date,
        b.home_score_pred,
        b.away_score_pred,
        b.confidence,
        b.double_up,
        m.home_score,
        m.away_score,
        m.final_home_score,
        m.final_away_score,
        m.score_duration,
        b.points_earned,
        m.status AS match_status,
        m.stage
      FROM bets b
      JOIN matches m ON m.id = b.match_id
      JOIN groups g ON g.id = b.group_id
      WHERE b.user_id = ? ${groupFilter} ${visibilityFilter}
      ORDER BY m.match_date DESC
      LIMIT ? OFFSET ?
    `).bind(...dataBinds).all();

    const total = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM bets b
      JOIN matches m ON m.id = b.match_id
      WHERE b.user_id = ? ${groupFilter} ${visibilityFilter}
    `).bind(...countBinds).first<{ count: number }>();

    return json({ bets: rows.results, total: total?.count ?? 0, pseudo: targetPseudo }, 200, origin);
  }

  return err("Not found", 404, origin);
}
