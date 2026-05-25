import { Env } from "./types";
import { handleAuth } from "./handlers/auth";
import { handleGroups } from "./handlers/groups";
import { handleMatches } from "./handlers/matches";
import { handleBets } from "./handlers/bets";
import { handleSpecialBets } from "./handlers/special-bets";
import { handleNotifications } from "./handlers/notifications";
import { syncScores } from "./services/scores-sync";
import { sendPreGameReminders } from "./services/push-service";

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const { pathname } = url;

    try {
      // Auth routes (no JWT required)
      if (pathname.startsWith("/api/auth")) {
        return handleAuth(request, env, url, json, err, origin);
      }

      // All other routes require auth
      const token = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) return err("Unauthorized", 401, origin);

      const auth = await verifyJWT(token, env.JWT_SECRET);
      if (!auth) return err("Invalid token", 401, origin);

      if (pathname.startsWith("/api/groups")) {
        return handleGroups(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/matches")) {
        return handleMatches(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/bets")) {
        return handleBets(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/special-bets")) {
        return handleSpecialBets(request, env, url, auth, json, err, origin);
      }
      if (pathname.startsWith("/api/push")) {
        return handleNotifications(request, env, url, auth, json, err, origin);
      }

      return err("Not found", 404, origin);
    } catch (e) {
      console.error(e);
      return err("Internal server error", 500, origin);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await syncScores(env);
    await sendPreGameReminders(env);
  },
};

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
