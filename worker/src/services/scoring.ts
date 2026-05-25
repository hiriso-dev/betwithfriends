import { Env, Match } from "../types";

type BetDistribution = { home: number; draw: number; away: number; total: number };

function calcCote(dist: BetDistribution, outcome: "home" | "draw" | "away"): number {
  const count = dist[outcome];
  if (dist.total === 0 || count === 0) return 1.5; // neutral cote
  const raw = dist.total / count;
  return Math.min(6.0, Math.max(1.1, Math.round(raw * 10) / 10));
}

function getOutcome(home: number, away: number): "home" | "draw" | "away" {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function calcPoints(
  homePred: number,
  awayPred: number,
  homeActual: number,
  awayActual: number,
  cote: number
): number {
  if (homePred === homeActual && awayPred === awayActual) {
    return Math.round(10 * cote * 10) / 10; // exact score
  }
  const predOutcome = getOutcome(homePred, awayPred);
  const actOutcome = getOutcome(homeActual, awayActual);
  if (predOutcome !== actOutcome) return 0;

  const predDiff = homePred - awayPred;
  const actDiff = homeActual - awayActual;
  if (predDiff === actDiff) {
    return Math.round(6 * cote * 10) / 10; // correct result + goal diff
  }
  return Math.round(3 * cote * 10) / 10; // correct result only
}

export async function processMatchResult(env: Env, match: Match): Promise<void> {
  if (match.home_score === null || match.away_score === null) return;

  const homeActual = match.home_score;
  const awayActual = match.away_score;
  const outcome = getOutcome(homeActual, awayActual);

  // Get all groups that have bets on this match
  const groupRows = await env.DB.prepare(
    "SELECT DISTINCT group_id FROM bets WHERE match_id = ? AND points_earned IS NULL"
  ).bind(match.id).all<{ group_id: string }>();

  for (const { group_id } of groupRows.results) {
    // Get bet distribution for this group + match
    const betRows = await env.DB.prepare(
      "SELECT home_score_pred, away_score_pred FROM bets WHERE match_id = ? AND group_id = ?"
    ).bind(match.id, group_id).all<{ home_score_pred: number; away_score_pred: number }>();

    const dist: BetDistribution = { home: 0, draw: 0, away: 0, total: betRows.results.length };
    for (const b of betRows.results) {
      dist[getOutcome(b.home_score_pred, b.away_score_pred)]++;
    }

    const cote = calcCote(dist, outcome);

    // Award points for all bets in this group
    const allBets = await env.DB.prepare(
      "SELECT id, user_id, home_score_pred, away_score_pred FROM bets WHERE match_id = ? AND group_id = ? AND points_earned IS NULL"
    ).bind(match.id, group_id).all<{ id: string; user_id: string; home_score_pred: number; away_score_pred: number }>();

    for (const bet of allBets.results) {
      const pts = calcPoints(bet.home_score_pred, bet.away_score_pred, homeActual, awayActual, cote);
      await env.DB.prepare(
        "UPDATE bets SET points_earned = ?, cote_applied = ? WHERE id = ?"
      ).bind(pts, cote, bet.id).run();

      // Update member total_points
      await env.DB.prepare(
        "UPDATE group_members SET total_points = total_points + ? WHERE group_id = ? AND user_id = ?"
      ).bind(pts, group_id, bet.user_id).run();
    }
  }
}
