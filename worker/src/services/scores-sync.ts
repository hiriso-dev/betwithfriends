import { Env, Match } from "../types";
import { processMatchResult } from "./scoring";
import { sendMatchResultNotifications } from "./push-service";

const FOOTBALL_DATA_URL = "https://api.football-data.org/v4";
const WC_COMPETITION_CODE = "WC";

type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  homeTeam: { name: string; tla: string };
  awayTeam: { name: string; tla: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    winner: string | null;
  };
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
    ROUND_OF_16: "Round of 16",
    QUARTER_FINALS: "Quarter-finals",
    SEMI_FINALS: "Semi-finals",
    THIRD_PLACE: "3rd Place",
    FINAL: "Final",
  };
  return map[stage] ?? stage;
}

export async function syncScores(env: Env): Promise<void> {
  try {
    const res = await fetch(`${FOOTBALL_DATA_URL}/competitions/${WC_COMPETITION_CODE}/matches`, {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY },
    });

    if (!res.ok) {
      console.error("Football data API error:", res.status, await res.text());
      return;
    }

    const data = await res.json<{ matches: FDMatch[] }>();

    for (const m of data.matches) {
      const matchDate = Math.floor(new Date(m.utcDate).getTime() / 1000);
      const status = mapStatus(m.status);
      const homeScore = m.score.fullTime.home;
      const awayScore = m.score.fullTime.away;

      const existing = await env.DB.prepare(
        "SELECT id, status, home_score, away_score FROM matches WHERE api_match_id = ?"
      ).bind(String(m.id)).first<{ id: string; status: string; home_score: number | null; away_score: number | null }>();

      if (existing) {
        const justFinished = existing.status !== "finished" && status === "finished";

        await env.DB.prepare(`
          UPDATE matches SET
            status = ?, home_score = ?, away_score = ?, updated_at = unixepoch()
          WHERE api_match_id = ?
        `).bind(status, homeScore, awayScore, String(m.id)).run();

        if (justFinished && homeScore !== null && awayScore !== null) {
          const fullMatch: Match = { ...existing as unknown as Match, status, home_score: homeScore, away_score: awayScore };
          await processMatchResult(env, fullMatch);
          await sendMatchResultNotifications(env, fullMatch);
        }
      } else {
        await env.DB.prepare(`
          INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code,
            match_date, home_score, away_score, status, stage, group_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(), String(m.id),
          m.homeTeam.name, m.awayTeam.name,
          m.homeTeam.tla, m.awayTeam.tla,
          matchDate, homeScore, awayScore,
          status, mapStage(m.stage), m.group
        ).run();
      }
    }
  } catch (e) {
    console.error("syncScores error:", e);
  }
}
