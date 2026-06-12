import { calcPoints } from "./scoring";
import { Bet, Env, Match } from "../types";

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

type UserNotificationSendResult = {
  found: number;
  sent: number;
  firstError?: string;
  blockedReason?: string;
};

type MatchBetSummary = {
  betCount: number;
  totalPoints: number | null;
  sampleHomeScorePred: number | null;
  sampleAwayScorePred: number | null;
  sampleConfidence: Bet["confidence"];
};

const CONFIDENCE_LABELS: Record<NonNullable<Bet["confidence"]>, string> = {
  cautious: "😬 Cautious",
  confident: "👍 Confident",
  reckless: "🔥 Reckless",
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

function formatPoints(points: number): string {
  return `${points > 0 ? "+" : ""}${points.toFixed(1)}pts`;
}

function formatConfidence(confidence: Bet["confidence"]): string | null {
  if (!confidence) return null;
  return CONFIDENCE_LABELS[confidence];
}

function hasAvailablePoints(summary: MatchBetSummary): boolean {
  return summary.totalPoints !== null;
}

function getFinalScoreSuffix(scoreDuration: Match["score_duration"]): string {
  if (scoreDuration === "PENALTY_SHOOTOUT") return " pens";
  if (scoreDuration === "EXTRA_TIME") return " aet";
  return "";
}

function formatResolvedScore(
  match: Pick<Match, "home_score" | "away_score"> & Partial<Pick<Match, "final_home_score" | "final_away_score" | "score_duration">>
): string | null {
  if (match.home_score === null || match.away_score === null) return null;

  const primary = `${match.home_score}–${match.away_score}`;
  const hasDistinctFinal =
    match.final_home_score !== undefined &&
    match.final_home_score !== null &&
    match.final_away_score !== undefined &&
    match.final_away_score !== null &&
    (match.final_home_score !== match.home_score || match.final_away_score !== match.away_score);

  if (!hasDistinctFinal) return primary;

  return `${primary} (${match.final_home_score}–${match.final_away_score}${getFinalScoreSuffix(match.score_duration ?? null)})`;
}

function buildResultNotificationBody(
  match: Pick<Match, "home_team" | "away_team" | "home_score" | "away_score"> & Partial<Pick<Match, "final_home_score" | "final_away_score" | "score_duration">>,
  summary: MatchBetSummary
): string {
  const lines = [`Match: ${match.home_team} vs ${match.away_team}`];

  const resolvedScore = formatResolvedScore(match);
  if (resolvedScore) {
    lines.push(`Score: ${resolvedScore}`);
  } else {
    lines.push("Score: Available in the app");
  }

  if (summary.betCount === 0) {
    return lines.join("\n");
  }

  if (summary.totalPoints === null) {
    lines.push("Points: Pending");

    if (summary.betCount === 1 && summary.sampleHomeScorePred !== null && summary.sampleAwayScorePred !== null) {
      lines.push(`Prediction: ${summary.sampleHomeScorePred}–${summary.sampleAwayScorePred}`);

      const confidence = formatConfidence(summary.sampleConfidence);
      if (confidence) {
        lines.push(`Confidence: ${confidence}`);
      }

      return lines.join("\n");
    }

    lines.push(`Details: Open the app to review your bets across ${summary.betCount} groups`);
    return lines.join("\n");
  }

  if (summary.betCount === 1) {
    lines.push(`Points: ${formatPoints(summary.totalPoints)}`);

    if (summary.sampleHomeScorePred !== null && summary.sampleAwayScorePred !== null) {
      lines.push(`Prediction: ${summary.sampleHomeScorePred}–${summary.sampleAwayScorePred}`);
    }

    const confidence = formatConfidence(summary.sampleConfidence);
    if (confidence) {
      lines.push(`Confidence: ${confidence}`);
    }

    return lines.join("\n");
  }

  lines.push(`Points: ${formatPoints(summary.totalPoints)} across ${summary.betCount} groups`);
  lines.push(`Details: Open the app to review your bets across ${summary.betCount} groups`);
  return lines.join("\n");
}

async function getUserMatchBetSummary(
  env: Env,
  userId: string,
  match: Pick<Match, "id" | "home_score" | "away_score">
): Promise<MatchBetSummary> {
  const rows = await env.DB.prepare(`
    SELECT home_score_pred, away_score_pred, confidence, double_up, points_earned
    FROM bets
    WHERE user_id = ? AND match_id = ?
  `).bind(userId, match.id).all<{
    home_score_pred: number;
    away_score_pred: number;
    confidence: Bet["confidence"];
    double_up: number;
    points_earned: number | null;
  }>();

  if (rows.results.length === 0) {
    return {
      betCount: 0,
      totalPoints: null,
      sampleHomeScorePred: null,
      sampleAwayScorePred: null,
      sampleConfidence: null,
    };
  }

  const [firstBet] = rows.results;
  const hasActualScore = match.home_score !== null && match.away_score !== null;

  if (hasActualScore) {
    const totalPoints = rows.results.reduce((sum, bet) => sum + calcPoints(
      bet.home_score_pred,
      bet.away_score_pred,
      match.home_score as number,
      match.away_score as number,
      bet.confidence,
      bet.double_up === 1
    ), 0);

    return {
      betCount: rows.results.length,
      totalPoints,
      sampleHomeScorePred: firstBet.home_score_pred,
      sampleAwayScorePred: firstBet.away_score_pred,
      sampleConfidence: firstBet.confidence,
    };
  }

  if (rows.results.every((bet) => bet.points_earned !== null)) {
    const totalPoints = rows.results.reduce((sum, bet) => sum + (bet.points_earned ?? 0), 0);

    return {
      betCount: rows.results.length,
      totalPoints,
      sampleHomeScorePred: firstBet.home_score_pred,
      sampleAwayScorePred: firstBet.away_score_pred,
      sampleConfidence: firstBet.confidence,
    };
  }

  return {
    betCount: rows.results.length,
    totalPoints: null,
    sampleHomeScorePred: firstBet.home_score_pred,
    sampleAwayScorePred: firstBet.away_score_pred,
    sampleConfidence: firstBet.confidence,
  };
}

export async function sendMatchResultNotifications(env: Env, match: Match): Promise<void> {
  // Only send result notifications once the user's bet points are actually available.
  const rows = await env.DB.prepare(`
    SELECT
      ps.user_id,
      ps.subscription_json,
      COUNT(b.id) AS bet_count,
      COALESCE(SUM(b.points_earned), 0) AS total_points,
      MIN(b.home_score_pred) AS sample_home_score_pred,
      MIN(b.away_score_pred) AS sample_away_score_pred,
      MIN(b.confidence) AS sample_confidence
    FROM push_subscriptions ps
    JOIN bets b ON b.user_id = ps.user_id AND b.match_id = ?
    LEFT JOIN notification_prefs np ON np.user_id = ps.user_id
    WHERE COALESCE(np.result_after_game, 1) = 1
    GROUP BY ps.user_id, ps.subscription_json
    HAVING COUNT(b.id) > 0 AND COUNT(b.points_earned) = COUNT(b.id)
  `).bind(match.id).all<{
    user_id: string;
    subscription_json: string;
    bet_count: number;
    total_points: number;
    sample_home_score_pred: number | null;
    sample_away_score_pred: number | null;
    sample_confidence: Bet["confidence"];
  }>();

  for (const row of rows.results) {
    const reserved = await reserveDelivery(env, row.user_id, match.id, "result");
    if (!reserved) continue;

    const sub = JSON.parse(row.subscription_json) as PushSubscription;
    const body = buildResultNotificationBody(match, {
      betCount: row.bet_count,
      totalPoints: row.total_points,
      sampleHomeScorePred: row.sample_home_score_pred,
      sampleAwayScorePred: row.sample_away_score_pred,
      sampleConfidence: row.bet_count === 1 ? row.sample_confidence : null,
    });

    const result = await sendPush(env, sub, {
      title: "⚽ Match result",
      body,
      icon: "/favicon-512.png",
      badge: "/favicon-512.png",
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
  const now = Math.floor(Date.now() / 1000);

  // Candidate matches: still scheduled, not yet flagged complete, and either
  // inside the 60-min pre-game window OR already kicked off. We include
  // `match_date <= now` (kicked off) on purpose so that a match is only ever
  // marked `reminders_done = 1` AFTER kickoff — never because the recipient set
  // happened to be empty on one tick during the window. That fixes the bug
  // where a user who subscribed mid-window was permanently skipped: while
  // kickoff is in the future we re-evaluate recipients every tick, so any tick
  // in the hour before kickoff is a fresh chance to send (notification_deliveries
  // dedups to one delivered reminder per user+match).
  const matches = await env.DB.prepare(
    `SELECT id, home_team, away_team, match_date
     FROM matches
     WHERE status = 'scheduled'
       AND reminders_done = 0
       AND match_date <= ?`
  ).bind(now + 60 * 60).all<{ id: string; home_team: string; away_team: string; match_date: number }>();

  let totalSent = 0;
  let totalTempFailures = 0;
  let totalPermFailures = 0;
  let flaggedComplete = 0;

  for (const match of matches.results) {
    // Kickoff has passed — betting is locked, so no further reminders are useful.
    // This is the ONLY place we flag a match complete, so later ticks skip it.
    if (match.match_date <= now) {
      await env.DB.prepare("UPDATE matches SET reminders_done = 1 WHERE id = ?")
        .bind(match.id).run();
      flaggedComplete += 1;
      logPreGameMatch(match.id, 0, 0, 0, 0, "flagged_complete_kickoff_passed");
      continue;
    }

    // Recipients = group members who, for at least one of their groups:
    //   1. haven't placed a bet on this match,
    //   2. have a push subscription (subscribed to notifications), and
    //   3. have the pre-game reminder pref on (default on when no row exists), and
    //   4. haven't already been sent this match's pre-game reminder.
    const rows = await env.DB.prepare(`
      SELECT DISTINCT gm.user_id, ps.subscription_json
      FROM group_members gm
      JOIN push_subscriptions ps ON ps.user_id = gm.user_id
      LEFT JOIN notification_prefs np ON np.user_id = gm.user_id
      WHERE COALESCE(np.remind_before_game, 1) = 1
        AND NOT EXISTS (
          SELECT 1 FROM bets b
          WHERE b.user_id = gm.user_id AND b.match_id = ? AND b.group_id = gm.group_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM notification_deliveries d
          WHERE d.user_id = gm.user_id AND d.match_id = ? AND d.delivery_type = 'pre_game'
        )
    `).bind(match.id, match.id).all<{ user_id: string; subscription_json: string }>();

    let sent = 0;
    let tempFailures = 0;
    let permFailures = 0;

    for (const row of rows.results) {
      const reserved = await reserveDelivery(env, row.user_id, match.id, "pre_game");
      if (!reserved) continue; // already reserved this tick (e.g. multi-device) — dedup to one

      const sub = JSON.parse(row.subscription_json) as PushSubscription;
      const result = await sendPush(env, sub, {
        title: "⏰ Game in 1 hour!",
        body: `${match.home_team} vs ${match.away_team} — place your prediction now`,
        icon: "/favicon-512.png",
        tag: `reminder-${match.id}`,
        url: "/fixtures",
      }, {
        topic: `reminder-${match.id}`,
        urgency: "high",
        ttl: 90 * 60,
      });

      if (result.ok) {
        sent += 1;
      } else if (result.permanentFailure) {
        permFailures += 1;
      } else {
        tempFailures += 1;
        // Transient failure — release the reservation so a later tick retries.
        await releaseDelivery(env, row.user_id, match.id, "pre_game");
      }
    }

    totalSent += sent;
    totalTempFailures += tempFailures;
    totalPermFailures += permFailures;

    let skipReason: string | null = null;
    if (rows.results.length === 0) skipReason = "no_recipients";
    else if (sent === 0 && tempFailures + permFailures > 0) skipReason = "all_failed";
    else if (sent === 0) skipReason = "all_delivered";

    logPreGameMatch(match.id, rows.results.length, sent, tempFailures, permFailures, skipReason);
  }

  // Per-tick summary so a silent run is still attributable in `wrangler tail`.
  console.log(JSON.stringify({
    evt: "pregame_tick",
    candidateMatches: matches.results.length,
    sent: totalSent,
    tempFailures: totalTempFailures,
    permFailures: totalPermFailures,
    flaggedComplete,
  }));
}

// One structured record per candidate match. Logs match IDs and counts only —
// no PII beyond identifiers already used across the worker.
function logPreGameMatch(
  matchId: string,
  recipientCount: number,
  sent: number,
  tempFailures: number,
  permFailures: number,
  skipReason: string | null
): void {
  console.log(JSON.stringify({
    evt: "pregame_match",
    matchId,
    recipientCount,
    sent,
    tempFailures,
    permFailures,
    skipReason,
  }));
}

async function sendNotificationToUser(
  env: Env,
  userId: string,
  payload: PushPayload,
  options: PushSendOptions
): Promise<UserNotificationSendResult> {
  const rows = await env.DB.prepare(`
    SELECT subscription_json
    FROM push_subscriptions
    WHERE user_id = ?
  `).bind(userId).all<{ subscription_json: string }>();

  let sent = 0;
  let firstError: string | undefined;

  for (const row of rows.results) {
    const sub = JSON.parse(row.subscription_json) as PushSubscription;
    const result = await sendPush(env, sub, payload, options);

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

export async function sendReminderNotificationToUser(
  env: Env,
  userId: string,
  match: Pick<Match, "id" | "home_team" | "away_team">
): Promise<UserNotificationSendResult> {
  return sendNotificationToUser(env, userId, {
    title: "⏰ Game in 1 hour!",
    body: `${match.home_team} vs ${match.away_team} — place your prediction now`,
    icon: "/favicon-512.png",
    badge: "/favicon-512.png",
    tag: `reminder-${match.id}`,
    url: "/fixtures",
  }, {
    topic: `reminder-test-${match.id}`,
    urgency: "high",
    ttl: 90 * 60,
  });
}

export async function sendResultNotificationToUser(
  env: Env,
  userId: string,
  match: Pick<Match, "id" | "home_team" | "away_team" | "home_score" | "away_score">
): Promise<UserNotificationSendResult> {
  const summary = await getUserMatchBetSummary(env, userId, match);
  if (!hasAvailablePoints(summary)) {
    return {
      found: 0,
      sent: 0,
      blockedReason: "Result notifications only send once points are available for your bet(s).",
    };
  }

  const body = buildResultNotificationBody(match, summary);

  return sendNotificationToUser(env, userId, {
    title: "⚽ Match result",
    body,
    icon: "/favicon-512.png",
    badge: "/favicon-512.png",
    tag: `result-${match.id}`,
    url: "/fixtures",
  }, {
    topic: `result-test-${match.id}`,
    urgency: "high",
    ttl: 6 * 3600,
  });
}

export async function sendTestNotification(env: Env, userId: string): Promise<UserNotificationSendResult> {
  return sendNotificationToUser(env, userId, {
    title: "Test notification",
    body: "BetWithFriends notifications are working on this device.",
    icon: "/favicon-512.png",
    badge: "/favicon-512.png",
    tag: `test-${userId}`,
    url: "/profile",
  }, {
    topic: "test-notification",
    urgency: "high",
    ttl: 5 * 60,
  });
}
