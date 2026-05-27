import { Env, Match } from "../types";

type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
};

type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type PushSendOptions = {
  topic?: string;
  urgency?: "very-low" | "low" | "normal" | "high";
  ttl?: number;
};

type GeneratedPushRequest = {
  endpoint: string;
  method: string;
  headers: Record<string, string | number>;
  body?: ArrayBuffer | ArrayBufferView | null;
};

type VapidDetails = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

type GenerateRequestDetailsFn = (
  subscription: PushSubscription,
  payload?: string,
  options?: {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
  }
) => GeneratedPushRequest;

type PushSendResult = {
  ok: boolean;
  permanentFailure: boolean;
  errorMessage?: string;
};

type TestNotificationResult = {
  found: number;
  sent: number;
  firstError?: string;
};

let webPushRequestDetailsPromise: Promise<GenerateRequestDetailsFn> | null = null;

function getGenerateRequestDetails(): Promise<GenerateRequestDetailsFn> {
  if (!webPushRequestDetailsPromise) {
    webPushRequestDetailsPromise = import("web-push").then((mod) => {
      const candidate = mod as unknown as {
        generateRequestDetails?: GenerateRequestDetailsFn;
        default?: { generateRequestDetails?: GenerateRequestDetailsFn };
      };

      const fn = candidate.generateRequestDetails ?? candidate.default?.generateRequestDetails;
      if (!fn) {
        throw new Error("web-push generateRequestDetails is unavailable");
      }

      return fn;
    });
  }

  return webPushRequestDetailsPromise;
}

function getVapidDetails(env: Env): VapidDetails {
  const subject = env.VAPID_SUBJECT?.trim();
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();

  if (!subject) {
    throw new Error("Missing worker secret VAPID_SUBJECT");
  }

  if (!subject.startsWith("mailto:") && !/^https?:\/\//.test(subject)) {
    throw new Error("Invalid VAPID_SUBJECT: expected a mailto: or http(s) URL");
  }

  if (!publicKey) {
    throw new Error("Missing worker secret VAPID_PUBLIC_KEY");
  }

  if (!privateKey) {
    throw new Error("Missing worker secret VAPID_PRIVATE_KEY");
  }

  return { subject, publicKey, privateKey };
}

function isAppleWebPushEndpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).hostname === "web.push.apple.com";
  } catch {
    return false;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildTopicHeader(endpoint: string, rawTopic?: string): Promise<string | undefined> {
  if (!rawTopic) return undefined;
  if (isAppleWebPushEndpoint(endpoint)) return undefined;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawTopic));
  return toHex(new Uint8Array(digest)).slice(0, 32);
}

async function reserveDelivery(
  env: Env,
  userId: string,
  matchId: string,
  deliveryType: "pre_game" | "result"
): Promise<boolean> {
  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO notification_deliveries (id, user_id, match_id, delivery_type)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, matchId, deliveryType).run();

  return (result.meta?.changes ?? 0) > 0;
}

async function releaseDelivery(
  env: Env,
  userId: string,
  matchId: string,
  deliveryType: "pre_game" | "result"
): Promise<void> {
  await env.DB.prepare(`
    DELETE FROM notification_deliveries
    WHERE user_id = ? AND match_id = ? AND delivery_type = ?
  `).bind(userId, matchId, deliveryType).run();
}

async function sendPush(
  env: Env,
  sub: PushSubscription,
  payload: PushPayload,
  options: PushSendOptions
): Promise<PushSendResult> {
  try {
    const generateRequestDetails = await getGenerateRequestDetails();
    const vapidDetails = getVapidDetails(env);
    const topic = await buildTopicHeader(sub.endpoint, options.topic);
    const requestDetails = generateRequestDetails(sub, JSON.stringify(payload), {
      TTL: options.ttl ?? 3600,
      topic,
      urgency: options.urgency ?? "normal",
      vapidDetails,
    });

    const headers = new Headers();
    for (const [key, value] of Object.entries(requestDetails.headers)) {
      headers.set(key, String(value));
    }

    const res = await fetch(requestDetails.endpoint, {
      method: requestDetails.method,
      headers,
      body: requestDetails.body ?? undefined,
    });

    if (res.status === 404 || res.status === 410) {
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?")
        .bind(sub.endpoint)
        .run();
      return {
        ok: false,
        permanentFailure: true,
        errorMessage: `Subscription expired (${res.status})`,
      };
    }

    if (!res.ok) {
      const responseText = await res.text();
      console.error("sendPush failed", res.status, responseText);
      return {
        ok: false,
        permanentFailure: false,
        errorMessage: responseText || `Push service rejected the request (${res.status})`,
      };
    }

    return { ok: true, permanentFailure: false };
  } catch (error) {
    console.error("sendPush error", error);
    return {
      ok: false,
      permanentFailure: false,
      errorMessage: error instanceof Error ? error.message : "Unknown push delivery error",
    };
  }
}

export async function sendMatchResultNotifications(env: Env, match: Match): Promise<void> {
  // Send results to all subscribed users, with extra scoring context when they placed a bet.
  const rows = await env.DB.prepare(`
    SELECT
      ps.user_id,
      ps.subscription_json,
      COUNT(b.id) AS bet_count,
      SUM(COALESCE(b.points_earned, 0)) AS total_points,
      MIN(b.home_score_pred) AS sample_home_score_pred,
      MIN(b.away_score_pred) AS sample_away_score_pred
    FROM push_subscriptions ps
    JOIN notification_prefs np ON np.user_id = ps.user_id AND np.result_after_game = 1
    LEFT JOIN bets b ON b.user_id = ps.user_id AND b.match_id = ?
    GROUP BY ps.user_id, ps.subscription_json
  `).bind(match.id).all<{
    user_id: string;
    subscription_json: string;
    bet_count: number;
    total_points: number | null;
    sample_home_score_pred: number | null;
    sample_away_score_pred: number | null;
  }>();

  for (const row of rows.results) {
    const reserved = await reserveDelivery(env, row.user_id, match.id, "result");
    if (!reserved) continue;

    const sub = JSON.parse(row.subscription_json) as PushSubscription;
    const pts = row.total_points ?? 0;

    let body = `${match.home_team} ${match.home_score}–${match.away_score} ${match.away_team}`;
    if (row.bet_count === 1 && row.sample_home_score_pred !== null && row.sample_away_score_pred !== null) {
      body = pts > 0
        ? `${body} · You earned +${pts.toFixed(1)}pts 🎉`
        : `${body} · Your prediction: ${row.sample_home_score_pred}–${row.sample_away_score_pred}`;
    } else if (row.bet_count > 1) {
      body = pts > 0
        ? `${body} · You earned +${pts.toFixed(1)}pts across ${row.bet_count} groups 🎉`
        : `${body} · Open the app to review your bets across ${row.bet_count} groups`;
    }

    const result = await sendPush(env, sub, {
      title: "⚽ Match result",
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `result-${match.id}`,
      url: "/fixtures",
    }, {
      topic: `result-${match.id}`,
      urgency: "high",
      ttl: 6 * 3600,
    });

    if (!result.ok && !result.permanentFailure) {
      await releaseDelivery(env, row.user_id, match.id, "result");
    }
  }
}

export async function sendPreGameReminders(env: Env): Promise<void> {
  // Find matches starting in about an hour.
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
      const reserved = await reserveDelivery(env, row.user_id, match.id, "pre_game");
      if (!reserved) continue;

      const sub = JSON.parse(row.subscription_json) as PushSubscription;
      const result = await sendPush(env, sub, {
        title: "⏰ Game in 1 hour!",
        body: `${match.home_team} vs ${match.away_team} — place your prediction now`,
        icon: "/icons/icon-192.png",
        tag: `reminder-${match.id}`,
        url: "/fixtures",
      }, {
        topic: `reminder-${match.id}`,
        urgency: "high",
        ttl: 90 * 60,
      });

      if (!result.ok && !result.permanentFailure) {
        await releaseDelivery(env, row.user_id, match.id, "pre_game");
      }
    }
  }
}

export async function sendTestNotification(env: Env, userId: string): Promise<TestNotificationResult> {
  const rows = await env.DB.prepare(`
    SELECT subscription_json
    FROM push_subscriptions
    WHERE user_id = ?
  `).bind(userId).all<{ subscription_json: string }>();

  let sent = 0;
  let firstError: string | undefined;

  for (const row of rows.results) {
    const sub = JSON.parse(row.subscription_json) as PushSubscription;
    const result = await sendPush(env, sub, {
      title: "Test notification",
      body: "BetWithFriends notifications are working on this device.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `test-${userId}`,
      url: "/profile",
    }, {
      topic: "test-notification",
      urgency: "high",
      ttl: 5 * 60,
    });

    if (result.ok) {
      sent += 1;
    } else if (!firstError) {
      firstError = result.errorMessage;
    }
  }

  return {
    found: rows.results.length,
    sent,
    firstError,
  };
}
