import { Env, AuthContext } from "../types";
import { sendTestNotification } from "../services/push-service";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

export async function handleNotifications(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  const { pathname } = url;

  // POST /api/push/subscribe
  if (pathname === "/api/push/subscribe" && request.method === "POST") {
    const sub = await request.json<{ endpoint: string; keys: { p256dh: string; auth: string } }>();
    if (!sub?.endpoint) return err("Invalid subscription", 400, origin);

    await env.DB.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, subscription_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET subscription_json = excluded.subscription_json, user_id = excluded.user_id
    `).bind(crypto.randomUUID(), auth.userId, sub.endpoint, JSON.stringify(sub)).run();

    // Keep a single subscription per user — the latest device wins. iOS PWAs can
    // leave a "zombie" Apple subscription after a reinstall: the old endpoint keeps
    // returning 2xx (so it is never pruned by the 410 path) but never displays the
    // notification. With per-user delivery dedup, that dead endpoint can swallow the
    // push and the user receives nothing. Dropping the user's other endpoints on each
    // (re)subscribe — which the app does on every app open — keeps cron notifications
    // pointed at the live device.
    await env.DB.prepare(
      "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint != ?"
    ).bind(auth.userId, sub.endpoint).run();

    // Ensure notification prefs row exists
    await env.DB.prepare(`
      INSERT OR IGNORE INTO notification_prefs (user_id) VALUES (?)
    `).bind(auth.userId).run();

    return json({ ok: true }, 200, origin);
  }

  // POST /api/push/unsubscribe
  if (pathname === "/api/push/unsubscribe" && request.method === "POST") {
    const { endpoint } = await request.json<{ endpoint: string }>();
    if (!endpoint) return err("endpoint required", 400, origin);
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
      .bind(endpoint, auth.userId).run();
    return json({ ok: true }, 200, origin);
  }

  // POST /api/push/test
  if (pathname === "/api/push/test" && request.method === "POST") {
    const result = await sendTestNotification(env, auth.userId);
    if (result.found === 0) {
      return err("No push subscription found for this account", 400, origin);
    }
    if (result.sent === 0) {
      return err(
        result.firstError
          ? `Push subscription found, but delivery failed: ${result.firstError}`
          : "Push subscription found, but delivery failed.",
        502,
        origin
      );
    }
    return json({ ok: true, sent: result.sent, found: result.found }, 200, origin);
  }

  // GET /api/push/prefs
  if (pathname === "/api/push/prefs" && request.method === "GET") {
    const prefs = await env.DB.prepare(
      "SELECT remind_before_game, result_after_game FROM notification_prefs WHERE user_id = ?"
    ).bind(auth.userId).first<{ remind_before_game: number; result_after_game: number }>();

    if (!prefs) return json({ remind_before_game: true, result_after_game: true }, 200, origin);
    return json({
      remind_before_game: prefs.remind_before_game === 1,
      result_after_game: prefs.result_after_game === 1,
    }, 200, origin);
  }

  // POST /api/push/prefs
  if (pathname === "/api/push/prefs" && request.method === "POST") {
    const { remind_before_game, result_after_game } =
      await request.json<{ remind_before_game: boolean; result_after_game: boolean }>();

    await env.DB.prepare(`
      INSERT INTO notification_prefs (user_id, remind_before_game, result_after_game)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        remind_before_game = excluded.remind_before_game,
        result_after_game = excluded.result_after_game
    `).bind(auth.userId, remind_before_game ? 1 : 0, result_after_game ? 1 : 0).run();

    return json({ ok: true }, 200, origin);
  }

  return err("Not found", 404, origin);
}
