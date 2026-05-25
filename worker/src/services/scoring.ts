import { Env, Match } from "../types";

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
    return Math.round(10 * cote * 10) / 10;
  }
  const predOutcome = getOutcome(homePred, awayPred);
  const actOutcome = getOutcome(homeActual, awayActual);
  if (predOutcome !== actOutcome) return 0;

  const predDiff = homePred - awayPred;
  const actDiff = homeActual - awayActual;
  if (predDiff === actDiff) {
    return Math.round(6 * cote * 10) / 10;
  }
  return Math.round(3 * cote * 10) / 10;
}

export async function processMatchResult(env: Env, match: Match): Promise<void> {
  if (match.home_score === null || match.away_score === null) return;

  const homeActual = match.home_score;
  const awayActual = match.away_score;
  const outcome = getOutcome(homeActual, awayActual);

  // Use external odds as côte; fall back to 1.5 if not yet fetched
  const rawOdds =
    outcome === "home" ? match.home_odds :
    outcome === "away" ? match.away_odds :
    match.draw_odds;
  const cote = rawOdds
    ? Math.min(6.0, Math.max(1.1, Math.round(rawOdds * 10) / 10))
    : 1.5;

  const groupRows = await env.DB.prepare(
    "SELECT DISTINCT group_id FROM bets WHERE match_id = ? AND points_earned IS NULL"
  ).bind(match.id).all<{ group_id: string }>();

  for (const { group_id } of groupRows.results) {
    const allBets = await env.DB.prepare(
      "SELECT id, user_id, home_score_pred, away_score_pred FROM bets WHERE match_id = ? AND group_id = ? AND points_earned IS NULL"
    ).bind(match.id, group_id).all<{
      id: string;
      user_id: string;
      home_score_pred: number;
      away_score_pred: number;
    }>();

    for (const bet of allBets.results) {
      const pts = calcPoints(bet.home_score_pred, bet.away_score_pred, homeActual, awayActual, cote);

      await env.DB.prepare(
        "UPDATE bets SET points_earned = ?, cote_applied = ? WHERE id = ?"
      ).bind(pts, cote, bet.id).run();

      await env.DB.prepare(
        "UPDATE group_members SET total_points = total_points + ? WHERE group_id = ? AND user_id = ?"
      ).bind(pts, group_id, bet.user_id).run();
    }
  }
}
