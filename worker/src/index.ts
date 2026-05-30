import { Env, Match } from "./types";
import { handleAuth } from "./handlers/auth";
import { handleGroups } from "./handlers/groups";
import { handleMatches } from "./handlers/matches";
import { handleBets } from "./handlers/bets";
import { handleSpecialBets } from "./handlers/special-bets";
import { handleNotifications } from "./handlers/notifications";
import { handleStandings } from "./handlers/standings";
import { handleAdmin } from "./handlers/admin";
import { syncScores, syncScorers, hasMatchNeedingScoreSync } from "./services/scores-sync";
import { processMatchResult } from "./services/scoring";
import {
  sendPreGameReminders,
  sendReminderNotificationToUser,
  sendResultNotificationToUser,
} from "./services/push-service";

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
});

function json(data: unknown, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function err(message: string, status = 400, origin = "*") {
  return json({ error: message }, status, origin);
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      const url = new URL(request.url);
      const { pathname } = url;
      // Auth routes (no JWT required)
      if (pathname.startsWith("/api/auth")) {
        return await handleAuth(request, env, url, json, err, origin);
      }

      // All other routes require auth
      const token = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) return err("Unauthorized", 401, origin);

      const auth = await verifyJWT(token, env.JWT_SECRET);
      if (!auth) return err("Invalid token", 401, origin);

      // Ensure the user still exists in DB (handles wiped/reset DB with old JWT)
      const userExists = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(auth.userId).first();
      if (!userExists) return err("Session expired — please log in again", 401, origin);

      if (pathname.startsWith("/api/groups")) {
        return await handleGroups(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/matches")) {
        return await handleMatches(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/bets")) {
        return await handleBets(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/special-bets")) {
        return await handleSpecialBets(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/push")) {
        return await handleNotifications(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/standings") || pathname.startsWith("/api/scorers")) {
        return await handleStandings(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/admin")) {
        return await handleAdmin(request, env, url, auth, json, err, origin);
      }

      // Dev: manually trigger a competition sync (requires API key — use for UCL/other real match testing)
      if (pathname === "/api/dev/sync" && request.method === "POST" && env.FOOTBALL_DATA_API_KEY) {
        const { competition = "WC" } = await request.json<{ competition?: string }>();
        await syncScores(env, competition);
        return json({ ok: true, competition }, 200, origin);
      }

      // Dev-only: trigger scoring for a specific match
      if (pathname === "/api/dev/score-match" && request.method === "POST" && !env.FOOTBALL_DATA_API_KEY) {
        const { match_id, home_score, away_score } = await request.json<{ match_id: string; home_score: number; away_score: number }>();
        await env.DB.prepare(
          "UPDATE matches SET home_score=?, away_score=?, status='finished' WHERE id=?"
        ).bind(home_score, away_score, match_id).run();
        const match = await env.DB.prepare("SELECT * FROM matches WHERE id=?").bind(match_id).first();
        if (!match) return err("Match not found", 404, origin);
        await processMatchResult(env, match as Parameters<typeof processMatchResult>[1]);
        return json({ ok: true, match_id }, 200, origin);
      }

      if (pathname === "/api/dev/send-reminder" && request.method === "POST") {
        const { match_id } = await request.json<{ match_id: string }>();
        if (!match_id) return err("match_id is required", 400, origin);

        const match = await env.DB.prepare(
          "SELECT id, home_team, away_team FROM matches WHERE id = ?"
        ).bind(match_id).first<Pick<Match, "id" | "home_team" | "away_team">>();

        if (!match) return err("Match not found", 404, origin);

        const result = await sendReminderNotificationToUser(env, auth.userId, match);
        if (result.found === 0) return err("No push subscription found for this account", 400, origin);
        if (result.sent === 0) {
          return err(
            result.firstError
              ? `Push subscription found, but delivery failed: ${result.firstError}`
              : "Push subscription found, but delivery failed.",
            502,
            origin
          );
        }

        return json({ ok: true, sent: result.sent, found: result.found, match_id }, 200, origin);
      }

      if (pathname === "/api/dev/send-result" && request.method === "POST") {
        const { match_id, home_score, away_score } = await request.json<{
          match_id: string;
          home_score?: number;
          away_score?: number;
        }>();
        if (!match_id) return err("match_id is required", 400, origin);

        const match = await env.DB.prepare(
          "SELECT id, home_team, away_team, home_score, away_score FROM matches WHERE id = ?"
        ).bind(match_id).first<Pick<Match, "id" | "home_team" | "away_team" | "home_score" | "away_score">>();

        if (!match) return err("Match not found", 404, origin);

        const matchForNotification = {
          ...match,
          home_score: typeof home_score === "number" ? home_score : match.home_score,
          away_score: typeof away_score === "number" ? away_score : match.away_score,
        };

        const result = await sendResultNotificationToUser(env, auth.userId, matchForNotification);
        if (result.blockedReason) return err(result.blockedReason, 400, origin);
        if (result.found === 0) return err("No push subscription found for this account", 400, origin);
        if (result.sent === 0) {
          return err(
            result.firstError
              ? `Push subscription found, but delivery failed: ${result.firstError}`
              : "Push subscription found, but delivery failed.",
            502,
            origin
          );
        }

        return json({
          ok: true,
          sent: result.sent,
          found: result.found,
          match_id,
          home_score: matchForNotification.home_score,
          away_score: matchForNotification.away_score,
        }, 200, origin);
      }

      return err("Not found", 404, origin);
    } catch (e) {
      console.error(e);
      return err("Internal server error", 500, origin);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    // Runs every minute (see wrangler.toml).
    //
    // Pre-game reminders: DB-only, no API call — cheap to run every tick, and
    // doing so means a reminder is never missed in the hour before kickoff.
    await sendPreGameReminders(env);

    // Score sync: only poll football-data.org when a match is in its scoring
    // window (kicked off 105 min–6h ago, not yet finished). One bulk call covers
    // every match, so even at 1×/min we stay far under the free-tier 10 calls/min
    // (syncScorers self-throttles to every 30 min). Outside that window: 0 calls.
    if (await hasMatchNeedingScoreSync(env)) {
      await syncScores(env);
      await syncScorers(env);
    }
  },
};

export default worker;

async function verifyJWT(token: string, secret: string) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify("HMAC", key, sig, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return { userId: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}
