import { Env, Match, ScoreDuration } from "../types";
import { processMatchResult } from "./scoring";
import { sendMatchResultNotifications } from "./push-service";

const FOOTBALL_DATA_URL = "https://api.football-data.org/v4";
const TRACKED_MATCH_LOOKAHEAD_SECONDS = 30 * 60;
const TRACKED_MATCH_LOOKBACK_SECONDS = 6 * 60 * 60;
const TRACKED_MATCH_SYNC_INTERVAL_SECONDS = 50;
const MAX_TRACKED_MATCH_CALLS_PER_TICK = 8;
const MAX_CATCH_UP_FINALIZATIONS_PER_TICK = 20;

/**
 * True when at least one tracked match needs an external refresh or a local
 * catch-up finalization pass. The tracked refresh path works by `api_match_id`
 * so non-WC matches can still move through live/finished states.
 */
export async function hasMatchNeedingScoreSync(env: Env): Promise<boolean> {
  const dueMatches = await getDueTrackedMatches(env, 1);
  if (dueMatches.length > 0) return true;

  return await hasPendingFinishedFinalization(env);
}

type FDScoreLine = {
  home: number | null;
  away: number | null;
};

type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  venue?: string;
  area?: { name: string };
  homeTeam: { name: string; tla: string };
  awayTeam: { name: string; tla: string };
  score: {
    duration?: string | null;
    regularTime: FDScoreLine | null;
    fullTime: FDScoreLine;
    extraTime?: FDScoreLine | null;
    penalties?: FDScoreLine | null;
    winner: string | null;
  };
};

type FDScorer = {
  player: { name: string };
  team: { name: string; tla: string };
  goals: number;
  assists: number;
  penalties: number;
};

type TrackedMatchRow = Pick<
  Match,
  "id" | "api_match_id" | "status" | "match_date" | "last_api_sync_at" | "home_score" | "away_score"
>;

type StoredMatchScores = {
  homeScore: number | null;
  awayScore: number | null;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
  scoreDuration: ScoreDuration;
};

function mapStatus(fdStatus: string): Match["status"] {
  if (fdStatus === "FINISHED") return "finished";
  if (fdStatus === "IN_PLAY" || fdStatus === "PAUSED" || fdStatus === "HALFTIME") return "live";
  if (fdStatus === "POSTPONED" || fdStatus === "CANCELLED" || fdStatus === "SUSPENDED") return "postponed";
  return "scheduled";
}

function mapStage(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    LAST_32: "Round of 32",
    ROUND_OF_16: "Round of 16",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-finals",
    SEMI_FINALS: "Semi-finals",
    THIRD_PLACE: "3rd Place",
    FINAL: "Final",
  };
  return map[stage] ?? stage;
}

function isNumericApiMatchId(apiMatchId: string): boolean {
  return /^\d+$/.test(apiMatchId);
}

function isSupportedScoreDuration(value: string | null | undefined): value is Exclude<ScoreDuration, null> {
  return value === "REGULAR" || value === "EXTRA_TIME" || value === "PENALTY_SHOOTOUT";
}

function getStoredMatchScores(match: FDMatch, status: Match["status"]): StoredMatchScores {
  const regularHomeScore = match.score.regularTime?.home ?? match.score.fullTime.home;
  const regularAwayScore = match.score.regularTime?.away ?? match.score.fullTime.away;
  const currentHomeScore = regularHomeScore ?? match.score.fullTime.home;
  const currentAwayScore = regularAwayScore ?? match.score.fullTime.away;

  if (status !== "finished") {
    return {
      homeScore: currentHomeScore,
      awayScore: currentAwayScore,
      finalHomeScore: null,
      finalAwayScore: null,
      scoreDuration: null,
    };
  }

  const finalHomeScore = match.score.fullTime.home;
  const finalAwayScore = match.score.fullTime.away;
  const hasDistinctFinalScore =
    regularHomeScore !== null &&
    regularAwayScore !== null &&
    finalHomeScore !== null &&
    finalAwayScore !== null &&
    (regularHomeScore !== finalHomeScore || regularAwayScore !== finalAwayScore);

  return {
    homeScore: currentHomeScore,
    awayScore: currentAwayScore,
    finalHomeScore: hasDistinctFinalScore ? finalHomeScore : null,
    finalAwayScore: hasDistinctFinalScore ? finalAwayScore : null,
    scoreDuration: currentHomeScore !== null && currentAwayScore !== null
      ? (isSupportedScoreDuration(match.score.duration) ? match.score.duration : "REGULAR")
      : null,
  };
}

async function getDueTrackedMatches(env: Env, limit: number): Promise<TrackedMatchRow[]> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await env.DB.prepare(
    `SELECT id, api_match_id, status, match_date, last_api_sync_at, home_score, away_score
     FROM matches
     WHERE api_match_id GLOB '[0-9]*'
       AND (
         (match_date BETWEEN ? AND ?)
         OR EXISTS (
           SELECT 1 FROM bets b
           WHERE b.match_id = matches.id AND b.points_earned IS NULL
         )
       )
       AND (
         last_api_sync_at IS NULL
         OR last_api_sync_at <= ?
       )
     ORDER BY
       CASE
         WHEN status = 'live' THEN 0
         WHEN status != 'finished' AND match_date <= ? THEN 1
         WHEN EXISTS (
           SELECT 1 FROM bets b
           WHERE b.match_id = matches.id AND b.points_earned IS NULL
         ) THEN 2
         ELSE 3
       END,
       COALESCE(last_api_sync_at, 0) ASC,
       match_date ASC
     LIMIT ?`
  ).bind(
    now - TRACKED_MATCH_LOOKBACK_SECONDS,
    now + TRACKED_MATCH_LOOKAHEAD_SECONDS,
    now - TRACKED_MATCH_SYNC_INTERVAL_SECONDS,
    now,
    limit
  ).all<TrackedMatchRow>();

  return rows.results.filter((row) => isNumericApiMatchId(row.api_match_id));
}

async function hasPendingFinishedFinalization(env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1
     FROM matches m
     JOIN bets b ON b.match_id = m.id AND b.points_earned IS NULL
     WHERE m.status = 'finished'
       AND m.home_score IS NOT NULL
       AND m.away_score IS NOT NULL
     LIMIT 1`
  ).first();

  return row !== null;
}

async function fetchMatchByApiId(env: Env, apiMatchId: string): Promise<FDMatch | null> {
  const res = await fetch(`${FOOTBALL_DATA_URL}/matches/${apiMatchId}`, {
    headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY as string },
  });

  if (!res.ok) {
    console.error(`Football data match API error for ${apiMatchId}:`, res.status, await res.text());
    return null;
  }

  return await res.json<FDMatch>();
}

async function upsertMatchFromApiMatch(env: Env, match: FDMatch, existingId?: string): Promise<string> {
  const matchDate = Math.floor(new Date(match.utcDate).getTime() / 1000);
  const status = mapStatus(match.status);
  const scores = getStoredMatchScores(match, status);

  let matchId = existingId;
  if (!matchId) {
    const existing = await env.DB.prepare(
      "SELECT id FROM matches WHERE api_match_id = ?"
    ).bind(String(match.id)).first<{ id: string }>();
    matchId = existing?.id ?? crypto.randomUUID();
  }

  const existingRow = await env.DB.prepare(
    "SELECT id FROM matches WHERE id = ?"
  ).bind(matchId).first<{ id: string }>();

  if (existingRow) {
    await env.DB.prepare(`
      UPDATE matches SET
        home_team = ?, away_team = ?,
        home_team_code = ?, away_team_code = ?,
        match_date = ?,
        home_score = ?, away_score = ?,
        final_home_score = ?, final_away_score = ?, score_duration = ?,
        status = ?, stage = ?, group_name = ?,
        stadium = COALESCE(?, stadium), venue_city = COALESCE(?, venue_city),
        last_api_sync_at = unixepoch(),
        updated_at = unixepoch()
      WHERE id = ?
    `).bind(
      match.homeTeam.name,
      match.awayTeam.name,
      match.homeTeam.tla,
      match.awayTeam.tla,
      matchDate,
      scores.homeScore,
      scores.awayScore,
      scores.finalHomeScore,
      scores.finalAwayScore,
      scores.scoreDuration,
      status,
      mapStage(match.stage),
      match.group,
      match.venue ?? null,
      match.area?.name ?? null,
      matchId
    ).run();

    return matchId;
  }

  await env.DB.prepare(`
    INSERT INTO matches (
      id, api_match_id, home_team, away_team, home_team_code, away_team_code,
      match_date, home_score, away_score, final_home_score, final_away_score,
      score_duration, status, stage, group_name, stadium, venue_city,
      last_api_sync_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
  `).bind(
    matchId,
    String(match.id),
    match.homeTeam.name,
    match.awayTeam.name,
    match.homeTeam.tla,
    match.awayTeam.tla,
    matchDate,
    scores.homeScore,
    scores.awayScore,
    scores.finalHomeScore,
    scores.finalAwayScore,
    scores.scoreDuration,
    status,
    mapStage(match.stage),
    match.group,
    match.venue ?? null,
    match.area?.name ?? null
  ).run();

  return matchId;
}

async function finalizeMatchIfReady(env: Env, matchId: string): Promise<void> {
  const match = await env.DB.prepare("SELECT * FROM matches WHERE id = ?")
    .bind(matchId)
    .first<Match>();

  if (!match || match.status !== "finished" || match.home_score === null || match.away_score === null) {
    return;
  }

  const unresolvedBet = await env.DB.prepare(
    "SELECT 1 FROM bets WHERE match_id = ? AND points_earned IS NULL LIMIT 1"
  ).bind(matchId).first();

  if (unresolvedBet) {
    await processMatchResult(env, match);
  }

  await sendMatchResultNotifications(env, match);
}

export async function finalizePendingFinishedMatches(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT DISTINCT m.id
     FROM matches m
     JOIN bets b ON b.match_id = m.id AND b.points_earned IS NULL
     WHERE m.status = 'finished'
       AND m.home_score IS NOT NULL
       AND m.away_score IS NOT NULL
     LIMIT ?`
  ).bind(MAX_CATCH_UP_FINALIZATIONS_PER_TICK).all<{ id: string }>();

  for (const row of rows.results) {
    await finalizeMatchIfReady(env, row.id);
  }
}

export async function syncTrackedMatches(env: Env): Promise<void> {
  if (!env.FOOTBALL_DATA_API_KEY) {
    console.log("syncTrackedMatches: no API key set, skipping");
    return;
  }

  try {
    const dueMatches = await getDueTrackedMatches(env, MAX_TRACKED_MATCH_CALLS_PER_TICK);

    for (const dueMatch of dueMatches) {
      const remoteMatch = await fetchMatchByApiId(env, dueMatch.api_match_id);
      if (!remoteMatch) continue;

      const matchId = await upsertMatchFromApiMatch(env, remoteMatch, dueMatch.id);
      await finalizeMatchIfReady(env, matchId);
    }

    await finalizePendingFinishedMatches(env);
  } catch (error) {
    console.error("syncTrackedMatches error:", error);
  }
}

export async function syncScores(env: Env, competitionCode = "WC"): Promise<void> {
  if (!env.FOOTBALL_DATA_API_KEY) {
    console.log("syncScores: no API key set, skipping");
    return;
  }

  try {
    const res = await fetch(`${FOOTBALL_DATA_URL}/competitions/${competitionCode}/matches`, {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
    });
    if (!res.ok) {
      console.error("Football data API error:", res.status, await res.text());
      return;
    }

    const data = await res.json<{ matches: FDMatch[] }>();
    if (!data.matches?.length) return;

    for (const match of data.matches) {
      const matchId = await upsertMatchFromApiMatch(env, match);
      if (mapStatus(match.status) === "finished") {
        await finalizeMatchIfReady(env, matchId);
      }
    }

    await finalizePendingFinishedMatches(env);
  } catch (error) {
    console.error("syncScores error:", error);
  }
}

const SCORERS_INTERVAL = 30 * 60;

export async function syncScorers(env: Env): Promise<void> {
  if (!env.FOOTBALL_DATA_API_KEY) return;

  const recent = await env.DB.prepare(
    "SELECT MAX(updated_at) as last FROM top_scorers"
  ).first<{ last: number | null }>();
  if (recent?.last && recent.last > Math.floor(Date.now() / 1000) - SCORERS_INTERVAL) return;

  try {
    const res = await fetch(`${FOOTBALL_DATA_URL}/competitions/WC/scorers`, {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
    });
    if (!res.ok) return;

    const data = await res.json<{ scorers: FDScorer[] }>();
    const statements = data.scorers.map((scorer) => {
      const id = `${scorer.player.name}_${scorer.team.tla}`.replace(/\s+/g, "_");
      return env.DB.prepare(`
        INSERT INTO top_scorers (id, player_name, team_name, team_code, goals, assists, penalties, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
        ON CONFLICT(player_name, team_code) DO UPDATE SET
          goals = excluded.goals, assists = excluded.assists,
          penalties = excluded.penalties, updated_at = unixepoch()
      `).bind(
        id,
        scorer.player.name,
        scorer.team.name,
        scorer.team.tla,
        scorer.goals ?? 0,
        scorer.assists ?? 0,
        scorer.penalties ?? 0
      );
    });
    if (statements.length > 0) await env.DB.batch(statements);
  } catch (error) {
    console.error("syncScorers error:", error);
  }
}
