import { Env, Match } from "../types";
import { processMatchResult } from "./scoring";
import { sendMatchResultNotifications } from "./push-service";

const FOOTBALL_DATA_URL = "https://api.football-data.org/v4";

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
    regularTime: { home: number | null; away: number | null } | null;
    fullTime: { home: number | null; away: number | null };
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

function mapStatus(fdStatus: string): Match["status"] {
  if (fdStatus === "FINISHED") return "finished";
  if (fdStatus === "IN_PLAY" || fdStatus === "PAUSED" || fdStatus === "HALFTIME") return "live";
  if (fdStatus === "POSTPONED" || fdStatus === "CANCELLED" || fdStatus === "SUSPENDED") return "postponed";
  return "scheduled";
}

function mapStage(stage: string): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Group Stage",
    LAST_32: "Round of 32",   // WC2026 first knockout round (48 teams)
    ROUND_OF_16: "Round of 16",
    LAST_16: "Round of 16",
    QUARTER_FINALS: "Quarter-finals",
    SEMI_FINALS: "Semi-finals",
    THIRD_PLACE: "3rd Place",
    FINAL: "Final",
  };
  return map[stage] ?? stage;
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

    // 1. ONE query to fetch all existing matches — avoids N individual SELECTs
    const apiIds = data.matches.map(m => String(m.id));
    const placeholders = apiIds.map(() => "?").join(",");
    const existingRows = await env.DB.prepare(
      `SELECT id, api_match_id, status, home_score, away_score FROM matches WHERE api_match_id IN (${placeholders})`
    ).bind(...apiIds).all<{ id: string; api_match_id: string; status: string; home_score: number | null; away_score: number | null }>();

    const existingMap = new Map(existingRows.results.map(r => [r.api_match_id, r]));

    // 2. Build all UPDATE/INSERT statements in memory, track matches that just finished
    type ExRow = { id: string; api_match_id: string; status: string; home_score: number | null; away_score: number | null };
    const statements: ReturnType<typeof env.DB.prepare>[] = [];
    const justFinished: Array<{ ex: ExRow; homeScore: number; awayScore: number }> = [];
    const firstSeenFinished: Array<{ newId: string }> = [];

    for (const m of data.matches) {
      const matchDate = Math.floor(new Date(m.utcDate).getTime() / 1000);
      const status = mapStatus(m.status);
      // Use regularTime when available (knockout rounds may go to ET/pens — we score on 90-min result)
      const homeScore = m.score.regularTime?.home ?? m.score.fullTime.home;
      const awayScore = m.score.regularTime?.away ?? m.score.fullTime.away;
      const ex = existingMap.get(String(m.id));

      if (ex) {
        const justFin = ex.status !== "finished" && status === "finished";
        statements.push(
          env.DB.prepare(`
            UPDATE matches SET
              home_team = ?, away_team = ?,
              home_team_code = ?, away_team_code = ?,
              match_date = ?,
              status = ?, home_score = ?, away_score = ?,
              stadium = COALESCE(?, stadium), venue_city = COALESCE(?, venue_city),
              updated_at = unixepoch()
            WHERE api_match_id = ?
          `).bind(
            m.homeTeam.name, m.awayTeam.name,
            m.homeTeam.tla, m.awayTeam.tla,
            matchDate, status, homeScore, awayScore,
            m.venue ?? null, m.area?.name ?? null,
            String(m.id)
          )
        );
        if (justFin && homeScore !== null && awayScore !== null) {
          justFinished.push({ ex, homeScore, awayScore });
        }
      } else {
        const newId = crypto.randomUUID();
        statements.push(
          env.DB.prepare(`
            INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code,
              match_date, home_score, away_score, status, stage, group_name, stadium, venue_city)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newId, String(m.id),
            m.homeTeam.name, m.awayTeam.name,
            m.homeTeam.tla, m.awayTeam.tla,
            matchDate, homeScore, awayScore,
            status, mapStage(m.stage), m.group,
            m.venue ?? null, m.area?.name ?? null
          )
        );
        if (status === "finished" && homeScore !== null && awayScore !== null) {
          firstSeenFinished.push({ newId });
        }
      }
    }

    // 3. ONE batch write for all updates/inserts — avoids N individual awaits
    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    // 4. Score bets for matches that just crossed the finish line (rare — only on match end)
    for (const { ex, homeScore, awayScore } of justFinished) {
      const fullMatch = await env.DB.prepare("SELECT * FROM matches WHERE id = ?")
        .bind(ex.id).first<Match>();
      if (fullMatch) {
        await processMatchResult(env, { ...fullMatch, home_score: homeScore, away_score: awayScore });
        await sendMatchResultNotifications(env, { ...fullMatch, home_score: homeScore, away_score: awayScore });
      }
    }
    // Handle first-seen-already-finished (cold start / missed sync window)
    for (const { newId } of firstSeenFinished) {
      const fullMatch = await env.DB.prepare("SELECT * FROM matches WHERE id = ?")
        .bind(newId).first<Match>();
      if (fullMatch) {
        await processMatchResult(env, fullMatch);
        await sendMatchResultNotifications(env, fullMatch);
      }
    }
  } catch (e) {
    console.error("syncScores error:", e);
  }
}

const SCORERS_INTERVAL = 30 * 60; // 30 min

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
    const statements = data.scorers.map(s => {
      const id = `${s.player.name}_${s.team.tla}`.replace(/\s+/g, "_");
      return env.DB.prepare(`
        INSERT INTO top_scorers (id, player_name, team_name, team_code, goals, assists, penalties, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
        ON CONFLICT(player_name, team_code) DO UPDATE SET
          goals = excluded.goals, assists = excluded.assists,
          penalties = excluded.penalties, updated_at = unixepoch()
      `).bind(id, s.player.name, s.team.name, s.team.tla, s.goals ?? 0, s.assists ?? 0, s.penalties ?? 0);
    });
    if (statements.length > 0) await env.DB.batch(statements);
  } catch (e) {
    console.error("syncScorers error:", e);
  }
}
