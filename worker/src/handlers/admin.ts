import { Env, AuthContext } from "../types";
import { processMatchResult } from "../services/scoring";

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

  // GET /api/admin/test-matches
  if (pathname === "/api/admin/test-matches" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT * FROM matches WHERE api_match_id LIKE 'admin-test-%' ORDER BY match_date DESC"
    ).all();
    return json(rows.results, 200, origin);
  }

  // POST /api/admin/test-matches — create a test match
  if (pathname === "/api/admin/test-matches" && request.method === "POST") {
    const body = await request.json<{
      kickoff_offset_minutes?: number; // minutes from now (can be negative)
      home_team?: string;
      away_team?: string;
    }>();

    const offsetMinutes = body.kickoff_offset_minutes ?? 3;
    const kickoff = Math.floor(Date.now() / 1000) + offsetMinutes * 60;
    const id = crypto.randomUUID();
    const apiId = `admin-test-${id}`;

    await env.DB.prepare(`
      INSERT INTO matches (id, api_match_id, home_team, away_team,
        home_team_code, away_team_code, match_date,
        home_score, away_score, status, stage, group_name)
      VALUES (?, ?, ?, ?, 'TST', 'DEV', ?, NULL, NULL, 'scheduled', 'Test Match', NULL)
    `).bind(
      id, apiId,
      body.home_team ?? "Test FC",
      body.away_team ?? "Dev United",
      kickoff
    ).run();

    const match = await env.DB.prepare("SELECT * FROM matches WHERE id = ?").bind(id).first();
    return json(match, 201, origin);
  }

  // Match-specific routes: /api/admin/test-matches/:id/...
  const matchFinishMatch = pathname.match(/^\/api\/admin\/test-matches\/([^/]+)\/finish$/);
  if (matchFinishMatch && request.method === "POST") {
    const matchId = matchFinishMatch[1];

    // Verify it's a test match
    const existing = await env.DB.prepare(
      "SELECT * FROM matches WHERE id = ? AND api_match_id LIKE 'admin-test-%'"
    ).bind(matchId).first<{ id: string; status: string }>();
    if (!existing) return err("Test match not found", 404, origin);

    const { home_score, away_score } = await request.json<{ home_score: number; away_score: number }>();
    if (home_score === undefined || away_score === undefined) return err("home_score and away_score required", 400, origin);

    await env.DB.prepare(
      "UPDATE matches SET home_score = ?, away_score = ?, status = 'finished', updated_at = unixepoch() WHERE id = ?"
    ).bind(home_score, away_score, matchId).run();

    const fullMatch = await env.DB.prepare("SELECT * FROM matches WHERE id = ?").bind(matchId).first();
    if (fullMatch) {
      await processMatchResult(env, fullMatch as Parameters<typeof processMatchResult>[1]);
    }

    return json({ ok: true, match: fullMatch }, 200, origin);
  }

  // DELETE /api/admin/test-matches/:id
  const matchDeleteMatch = pathname.match(/^\/api\/admin\/test-matches\/([^/]+)$/);
  if (matchDeleteMatch && request.method === "DELETE") {
    const matchId = matchDeleteMatch[1];

    const existing = await env.DB.prepare(
      "SELECT id FROM matches WHERE id = ? AND api_match_id LIKE 'admin-test-%'"
    ).bind(matchId).first();
    if (!existing) return err("Test match not found", 404, origin);

    await env.DB.batch([
      env.DB.prepare("DELETE FROM bets WHERE match_id = ?").bind(matchId),
      env.DB.prepare("DELETE FROM matches WHERE id = ?").bind(matchId),
    ]);

    return json({ ok: true }, 200, origin);
  }

  // POST /api/admin/test-matches/:id/kickoff — update kickoff time
  const matchKickoffMatch = pathname.match(/^\/api\/admin\/test-matches\/([^/]+)\/kickoff$/);
  if (matchKickoffMatch && request.method === "POST") {
    const matchId = matchKickoffMatch[1];

    const existing = await env.DB.prepare(
      "SELECT id FROM matches WHERE id = ? AND api_match_id LIKE 'admin-test-%'"
    ).bind(matchId).first();
    if (!existing) return err("Test match not found", 404, origin);

    const { kickoff_offset_minutes } = await request.json<{ kickoff_offset_minutes: number }>();
    const newKickoff = Math.floor(Date.now() / 1000) + kickoff_offset_minutes * 60;

    await env.DB.prepare(
      "UPDATE matches SET match_date = ?, status = 'scheduled', updated_at = unixepoch() WHERE id = ?"
    ).bind(newKickoff, matchId).run();

    const match = await env.DB.prepare("SELECT * FROM matches WHERE id = ?").bind(matchId).first();
    return json(match, 200, origin);
  }

  return err("Not found", 404, origin);
}
