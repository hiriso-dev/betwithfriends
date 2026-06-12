import { Env, AuthContext } from "../types";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

function randomId() { return crypto.randomUUID(); }
function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => chars[b % chars.length]).join("");
}

export async function handleGroups(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  const { pathname, searchParams } = url;

  // GET /api/groups — list user's groups with stats
  if (pathname === "/api/groups" && request.method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT g.id, g.name, g.invite_code,
             COUNT(DISTINCT gm2.user_id) as member_count,
             gm.total_points as my_points,
             (SELECT COUNT(*) + 1 FROM group_members gm3
              WHERE gm3.group_id = g.id AND gm3.total_points > gm.total_points) as my_rank
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
      JOIN group_members gm2 ON gm2.group_id = g.id
      GROUP BY g.id
      ORDER BY COALESCE(gm.sort_order, 1000000) ASC, g.created_at DESC
    `).bind(auth.userId).all();
    return json(rows.results, 200, origin);
  }

  // POST /api/groups — create group
  if (pathname === "/api/groups" && request.method === "POST") {
    const { name, pseudo } = await request.json<{ name: string; pseudo: string }>();
    if (!name?.trim() || !pseudo?.trim()) return err("Name and pseudo required", 400, origin);
    if (name.length > 50) return err("Name too long", 400, origin);
    if (pseudo.length > 30) return err("Pseudo too long", 400, origin);

    const groupId = randomId();
    let invite_code = randomCode();
    // Ensure uniqueness
    for (let i = 0; i < 5; i++) {
      const existing = await env.DB.prepare("SELECT id FROM groups WHERE invite_code = ?").bind(invite_code).first();
      if (!existing) break;
      invite_code = randomCode();
    }

    await env.DB.batch([
      env.DB.prepare("INSERT INTO groups (id, name, invite_code, created_by) VALUES (?, ?, ?, ?)")
        .bind(groupId, name.trim(), invite_code, auth.userId),
      env.DB.prepare("INSERT INTO group_members (id, group_id, user_id, pseudo, is_admin) VALUES (?, ?, ?, ?, 1)")
        .bind(randomId(), groupId, auth.userId, pseudo.trim()),
    ]);

    return json({ id: groupId, invite_code }, 201, origin);
  }

  // POST /api/groups/join
  if (pathname === "/api/groups/join" && request.method === "POST") {
    const { invite_code, pseudo } = await request.json<{ invite_code: string; pseudo: string }>();
    if (!invite_code || !pseudo?.trim()) return err("Code and pseudo required", 400, origin);

    const group = await env.DB.prepare("SELECT id, name FROM groups WHERE invite_code = ?")
      .bind(invite_code.toUpperCase()).first<{ id: string; name: string }>();
    if (!group) return err("Invalid invite code", 404, origin);

    const existing = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?")
      .bind(group.id, auth.userId).first();
    if (existing) return json({ id: group.id }, 200, origin); // already member

    const pseudoTaken = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND LOWER(pseudo) = LOWER(?)")
      .bind(group.id, pseudo.trim()).first();
    if (pseudoTaken) return err("Nickname already taken in this group", 409, origin);

    await env.DB.prepare("INSERT INTO group_members (id, group_id, user_id, pseudo) VALUES (?, ?, ?, ?)")
      .bind(randomId(), group.id, auth.userId, pseudo.trim()).run();

    return json({ id: group.id }, 201, origin);
  }

  // PUT /api/groups/order — persist this user's personal group display order
  if (pathname === "/api/groups/order" && request.method === "PUT") {
    let body: { order?: unknown };
    try {
      body = await request.json<{ order?: unknown }>();
    } catch {
      return err("Invalid JSON", 400, origin);
    }
    const order = body.order;
    if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
      return err("order must be an array of group IDs", 400, origin);
    }

    // Only reorder groups the user actually belongs to; ignore any foreign IDs
    const memberRows = await env.DB.prepare(
      "SELECT group_id FROM group_members WHERE user_id = ?"
    ).bind(auth.userId).all<{ group_id: string }>();
    const memberIds = new Set(memberRows.results.map((r) => r.group_id));

    const ordered = (order as string[]).filter((id) => memberIds.has(id));
    if (ordered.length === 0) return json({ success: true }, 200, origin);

    await env.DB.batch(
      ordered.map((groupId, i) =>
        env.DB.prepare("UPDATE group_members SET sort_order = ? WHERE user_id = ? AND group_id = ?")
          .bind(i, auth.userId, groupId)
      )
    );

    return json({ success: true }, 200, origin);
  }

  // GET /api/groups/:id
  const groupMatch = pathname.match(/^\/api\/groups\/([^/]+)$/);
  if (groupMatch && request.method === "GET") {
    const groupId = groupMatch[1];
    const member = await env.DB.prepare("SELECT * FROM group_members WHERE group_id = ? AND user_id = ?")
      .bind(groupId, auth.userId).first();
    if (!member) return err("Not a member", 403, origin);

    const group = await env.DB.prepare(
      "SELECT g.*, COUNT(gm.id) as member_count FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE g.id = ?"
    ).bind(groupId).first<{ id: string; name: string; invite_code: string; member_count: number }>();
    if (!group) return err("Group not found", 404, origin);

    return json({ ...group, is_admin: (member as { is_admin: number }).is_admin === 1 }, 200, origin);
  }

  // DELETE /api/groups/:id/members/:userId — admin removes a group member
  const removeMemberMatch = pathname.match(/^\/api\/groups\/([^/]+)\/members\/([^/]+)$/);
  if (removeMemberMatch && request.method === "DELETE") {
    const groupId = removeMemberMatch[1];
    const targetUserId = removeMemberMatch[2];

    // Verify caller is an admin of this group
    const caller = await env.DB.prepare(
      "SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?"
    ).bind(groupId, auth.userId).first<{ is_admin: number }>();
    if (!caller) return err("Not a member of this group", 403, origin);
    if (!caller.is_admin) return err("Admin access required", 403, origin);

    // Prevent self-removal
    if (targetUserId === auth.userId) return err("Cannot remove yourself from the group", 400, origin);

    // Verify target exists in group
    const target = await env.DB.prepare(
      "SELECT is_admin FROM group_members WHERE group_id = ? AND user_id = ?"
    ).bind(groupId, targetUserId).first<{ is_admin: number }>();
    if (!target) return err("Member not found in this group", 404, origin);

    // Prevent removing another admin
    if (target.is_admin) return err("Cannot remove another admin", 403, origin);

    // Delete member's bets in this group, then remove the member
    await env.DB.batch([
      env.DB.prepare("DELETE FROM bets WHERE group_id = ? AND user_id = ?").bind(groupId, targetUserId),
      env.DB.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").bind(groupId, targetUserId),
    ]);

    return json({ success: true }, 200, origin);
  }

  // GET /api/groups/:id/rankings
  const rankMatch = pathname.match(/^\/api\/groups\/([^/]+)\/rankings$/);
  if (rankMatch && request.method === "GET") {
    const groupId = rankMatch[1];
    const member = await env.DB.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?")
      .bind(groupId, auth.userId).first();
    if (!member) return err("Not a member", 403, origin);

    const rows = await env.DB.prepare(`
      SELECT gm.user_id, gm.pseudo, gm.total_points,
             ROW_NUMBER() OVER (ORDER BY gm.total_points DESC) as rank,
             COALESCE((
               SELECT SUM(b.points_earned)
               FROM bets b
               JOIN matches m ON m.id = b.match_id
               WHERE b.group_id = gm.group_id
                 AND b.user_id = gm.user_id
                 AND b.points_earned IS NOT NULL
                 AND date(m.match_date, 'unixepoch') = (
                   SELECT date(MAX(match_date), 'unixepoch')
                   FROM matches
                   WHERE status = 'finished'
                 )
             ), 0) as recent_points
      FROM group_members gm
      WHERE gm.group_id = ?
      ORDER BY gm.total_points DESC
    `).bind(groupId).all<{ user_id: string; pseudo: string; total_points: number; rank: number; recent_points: number }>();

    const lastDay = await env.DB.prepare(
      "SELECT date(MAX(match_date), 'unixepoch') as day FROM matches WHERE status = 'finished'"
    ).first<{ day: string | null }>();

    const result = rows.results.map((r) => ({ ...r, is_me: r.user_id === auth.userId }));
    return json({ members: result, last_match_day: lastDay?.day ?? null }, 200, origin);
  }

  return err("Not found", 404, origin);
}
