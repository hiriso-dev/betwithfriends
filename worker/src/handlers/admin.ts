import { Env, AuthContext } from "../types";
import { syncScores } from "../services/scores-sync";
import { POINTS_MAP } from "./special-bets";

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

  // POST /api/admin/sync — pull matches from football-data.org into the DB
  if (pathname === "/api/admin/sync" && request.method === "POST") {
    if (!env.FOOTBALL_DATA_API_KEY) {
      return err("FOOTBALL_DATA_API_KEY not set", 503, origin);
    }
    const body = await request.json<{ competition?: string }>().catch(() => ({}));
    const competition = (body as { competition?: string }).competition ?? "WC";
    await syncScores(env, competition);
    return json({ ok: true, competition }, 200, origin);
  }

  // POST /api/admin/resolve-special — settle tournament special bets.
  // Body: { results: { champion?, runner_up?, third_place?, top_scorer? } }
  // Idempotent: recomputes points_earned for every matching bet and applies
  // only the delta to total_points, so re-running (or fixing a typo) is safe.
  if (pathname === "/api/admin/resolve-special" && request.method === "POST") {
    const body = await request
      .json<{ results?: Record<string, string> }>()
      .catch(() => ({} as { results?: Record<string, string> }));
    const results = body.results ?? {};

    const summary: Record<string, { winners: number; settled: number }> = {};

    for (const betType of Object.keys(POINTS_MAP)) {
      const winning = results[betType]?.trim();
      if (!winning) continue; // skip bet types the admin left blank

      const fullPts = POINTS_MAP[betType];
      const norm = winning.toLowerCase();

      const bets = await env.DB.prepare(
        "SELECT id, user_id, group_id, bet_value, points_earned FROM special_bets WHERE bet_type = ?"
      ).bind(betType).all<{
        id: string; user_id: string; group_id: string;
        bet_value: string; points_earned: number | null;
      }>();

      let winners = 0;
      for (const b of bets.results) {
        const newPts = b.bet_value.trim().toLowerCase() === norm ? fullPts : 0;
        const oldPts = b.points_earned ?? 0;
        if (newPts > 0) winners++;

        await env.DB.prepare("UPDATE special_bets SET points_earned = ? WHERE id = ?")
          .bind(newPts, b.id).run();

        const delta = newPts - oldPts;
        if (delta !== 0) {
          await env.DB.prepare(
            "UPDATE group_members SET total_points = total_points + ? WHERE group_id = ? AND user_id = ?"
          ).bind(delta, b.group_id, b.user_id).run();
        }
      }

      summary[betType] = { winners, settled: bets.results.length };
    }

    return json({ ok: true, summary }, 200, origin);
  }

  // GET /api/admin/notification-debug?match_id=&user_id=&type=
  // Read-only: reports, for a user + match, the state of every notification
  // precondition and the resulting eligibility. Sends nothing, writes nothing.
  // `type` selects which notification to diagnose: `pre_game` (default) or `result`.
  if (pathname === "/api/admin/notification-debug" && request.method === "GET") {
    const matchId = url.searchParams.get("match_id");
    if (!matchId) return err("match_id is required", 400, origin);
    const userId = url.searchParams.get("user_id") ?? auth.userId;
    const type = url.searchParams.get("type") ?? "pre_game";

    // type=result — diagnose the end-of-game result notification path
    // (sendMatchResultNotifications). Result notifications default ON: a missing
    // notification_prefs row is treated as opted-in, matching delivery behavior.
    if (type === "result") {
      const match = await env.DB.prepare(
        "SELECT id, status, home_score, away_score FROM matches WHERE id = ?"
      ).bind(matchId).first<{ id: string; status: string; home_score: number | null; away_score: number | null }>();
      if (!match) return err("Match not found", 404, origin);

      const matchFinished = match.status === "finished";
      const hasScores = match.home_score !== null && match.away_score !== null;

      const sub = await env.DB.prepare(
        "SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1"
      ).bind(userId).first();
      const hasPushSubscription = sub !== null;

      const prefs = await env.DB.prepare(
        "SELECT result_after_game FROM notification_prefs WHERE user_id = ?"
      ).bind(userId).first<{ result_after_game: number }>();
      const resultAfterGame = prefs ? prefs.result_after_game === 1 : true; // default on

      const betStats = await env.DB.prepare(
        "SELECT COUNT(*) AS total, COUNT(points_earned) AS scored FROM bets WHERE user_id = ? AND match_id = ?"
      ).bind(userId, matchId).first<{ total: number; scored: number }>();
      const betCount = betStats?.total ?? 0;
      const scoredCount = betStats?.scored ?? 0;
      const hasBet = betCount > 0;
      const allBetsScored = betCount > 0 && scoredCount === betCount;

      const delivered = await env.DB.prepare(
        "SELECT 1 FROM notification_deliveries WHERE user_id = ? AND match_id = ? AND delivery_type = 'result' LIMIT 1"
      ).bind(userId, matchId).first();
      const alreadyDeliveredResult = delivered !== null;

      const blockingReasons: string[] = [];
      if (!matchFinished) blockingReasons.push("match_not_finished");
      if (!hasScores) blockingReasons.push("no_scores");
      if (!hasPushSubscription) blockingReasons.push("no_push_subscription");
      if (!resultAfterGame) blockingReasons.push("result_pref_off");
      if (!hasBet) blockingReasons.push("no_bet");
      else if (!allBetsScored) blockingReasons.push("bets_not_scored");
      if (alreadyDeliveredResult) blockingReasons.push("already_delivered");

      return json({
        type: "result",
        match: {
          id: match.id,
          status: match.status,
          finished: matchFinished,
          has_scores: hasScores,
        },
        user: {
          user_id: userId,
          has_push_subscription: hasPushSubscription,
          result_after_game: resultAfterGame,
          bet_count: betCount,
          all_bets_scored: allBetsScored,
          already_delivered_result: alreadyDeliveredResult,
        },
        eligible_now: blockingReasons.length === 0,
        blocking_reasons: blockingReasons,
      }, 200, origin);
    }

    // type=pre_game (default) — diagnose the pre-game reminder path
    const match = await env.DB.prepare(
      "SELECT id, status, match_date, reminders_done FROM matches WHERE id = ?"
    ).bind(matchId).first<{ id: string; status: string; match_date: number; reminders_done: number }>();
    if (!match) return err("Match not found", 404, origin);

    const now = Math.floor(Date.now() / 1000);
    const kickoffPassed = match.match_date <= now;
    const inWindow = match.match_date > now && match.match_date <= now + 60 * 60;

    // Group membership + how many of the user's groups still lack a bet for this match.
    const groupCount = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM group_members WHERE user_id = ?"
    ).bind(userId).first<{ n: number }>();
    const betGroupCount = await env.DB.prepare(
      "SELECT COUNT(DISTINCT group_id) AS n FROM bets WHERE user_id = ? AND match_id = ?"
    ).bind(userId, matchId).first<{ n: number }>();
    const totalGroups = groupCount?.n ?? 0;
    const groupsWithBet = betGroupCount?.n ?? 0;
    const inGroup = totalGroups > 0;
    const hasBetAllGroups = totalGroups > 0 && groupsWithBet >= totalGroups;

    const sub = await env.DB.prepare(
      "SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1"
    ).bind(userId).first();
    const hasPushSubscription = sub !== null;

    const prefs = await env.DB.prepare(
      "SELECT remind_before_game FROM notification_prefs WHERE user_id = ?"
    ).bind(userId).first<{ remind_before_game: number }>();
    const remindBeforeGame = prefs ? prefs.remind_before_game === 1 : true; // default on

    const delivered = await env.DB.prepare(
      "SELECT 1 FROM notification_deliveries WHERE user_id = ? AND match_id = ? AND delivery_type = 'pre_game' LIMIT 1"
    ).bind(userId, matchId).first();
    const alreadyDeliveredPreGame = delivered !== null;

    const blockingReasons: string[] = [];
    if (match.status !== "scheduled") blockingReasons.push("match_not_scheduled");
    if (kickoffPassed) blockingReasons.push("kickoff_passed");
    else if (!inWindow) blockingReasons.push("outside_window");
    if (match.reminders_done === 1) blockingReasons.push("reminders_done_flag");
    if (!inGroup) blockingReasons.push("not_in_group");
    if (!hasPushSubscription) blockingReasons.push("no_push_subscription");
    if (!remindBeforeGame) blockingReasons.push("reminder_pref_off");
    if (hasBetAllGroups) blockingReasons.push("already_bet_all_groups");
    if (alreadyDeliveredPreGame) blockingReasons.push("already_delivered");

    return json({
      match: {
        id: match.id,
        status: match.status,
        match_date: match.match_date,
        reminders_done: match.reminders_done === 1,
        in_window: inWindow,
        kickoff_passed: kickoffPassed,
      },
      user: {
        user_id: userId,
        in_group: inGroup,
        has_push_subscription: hasPushSubscription,
        remind_before_game: remindBeforeGame,
        has_bet_all_groups: hasBetAllGroups,
        already_delivered_pre_game: alreadyDeliveredPreGame,
      },
      eligible_now: blockingReasons.length === 0,
      blocking_reasons: blockingReasons,
    }, 200, origin);
  }

  return err("Not found", 404, origin);
}
