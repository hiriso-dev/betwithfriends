import { Env, Match } from "../types";

type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

async function buildVapidHeaders(
  env: Env,
  audience: string
): Promise<Record<string, string>> {
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const headerB64 = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify({ aud: audience, exp, sub: env.VAPID_SUBJECT }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const privateKeyBytes = Uint8Array.from(
    atob(env.VAPID_PRIVATE_KEY.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", privateKeyBytes.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${headerB64}.${payloadB64}.${sigB64}`;

  return {
    Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    "Content-Type": "application/json",
    TTL: "86400",
  };
}

async function sendPush(env: Env, sub: PushSubscription, payload: object): Promise<void> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const headers = await buildVapidHeaders(env, audience);

  const body = JSON.stringify(payload);
  const res = await fetch(sub.endpoint, { method: "POST", headers, body });

  if (res.status === 410 || res.status === 404) {
    // Subscription expired — delete it
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(sub.endpoint).run();
  }
}

export async function sendMatchResultNotifications(env: Env, match: Match): Promise<void> {
  // Get all users who bet on this match and have result notifications enabled
  const rows = await env.DB.prepare(`
    SELECT DISTINCT b.user_id, ps.subscription_json,
           b.home_score_pred, b.away_score_pred, b.points_earned,
           gm.pseudo
    FROM bets b
    JOIN notification_prefs np ON np.user_id = b.user_id AND np.result_after_game = 1
    JOIN push_subscriptions ps ON ps.user_id = b.user_id
    JOIN group_members gm ON gm.user_id = b.user_id AND gm.group_id = b.group_id
    WHERE b.match_id = ?
  `).bind(match.id).all<{
    user_id: string;
    subscription_json: string;
    home_score_pred: number;
    away_score_pred: number;
    points_earned: number | null;
    pseudo: string;
  }>();

  for (const row of rows.results) {
    const sub = JSON.parse(row.subscription_json) as PushSubscription;
    const pts = row.points_earned ?? 0;
    const body = pts > 0
      ? `${match.home_team} ${match.home_score}–${match.away_score} ${match.away_team} · You earned +${pts.toFixed(1)}pts 🎉`
      : `${match.home_team} ${match.home_score}–${match.away_score} ${match.away_team} · Your prediction: ${row.home_score_pred}–${row.away_score_pred}`;

    await sendPush(env, sub, {
      title: "⚽ Match result",
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: `result-${match.id}`,
    }).catch(() => {});
  }
}

export async function sendPreGameReminders(env: Env): Promise<void> {
  // Find matches starting in 50–70 minutes that have unbetted users
  const soon = Math.floor(Date.now() / 1000) + 60 * 60;
  const windowStart = soon - 10 * 60;
  const windowEnd = soon + 10 * 60;

  const matches = await env.DB.prepare(
    "SELECT id, home_team, away_team FROM matches WHERE status = 'scheduled' AND match_date BETWEEN ? AND ?"
  ).bind(windowStart, windowEnd).all<{ id: string; home_team: string; away_team: string }>();

  for (const match of matches.results) {
    // Find group members who haven't bet on this match
    const rows = await env.DB.prepare(`
      SELECT DISTINCT gm.user_id, ps.subscription_json
      FROM group_members gm
      JOIN notification_prefs np ON np.user_id = gm.user_id AND np.remind_before_game = 1
      JOIN push_subscriptions ps ON ps.user_id = gm.user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM bets b
        WHERE b.user_id = gm.user_id AND b.match_id = ? AND b.group_id = gm.group_id
      )
    `).bind(match.id).all<{ user_id: string; subscription_json: string }>();

    for (const row of rows.results) {
      const sub = JSON.parse(row.subscription_json) as PushSubscription;
      await sendPush(env, sub, {
        title: "⏰ Game in 1 hour!",
        body: `${match.home_team} vs ${match.away_team} — place your prediction now`,
        icon: "/icons/icon-192.png",
        tag: `reminder-${match.id}`,
      }).catch(() => {});
    }
  }
}
