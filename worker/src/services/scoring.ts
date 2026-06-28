import { Env, Match } from "../types";

/*
  Scoring rules:
  - Correct winner/draw:  +10 pts
  - Exact score bonus:    +5 pts (on top, so exact = 15 total)
  - Confidence modifier (applied additively):
      cautious:  +2 if correct / -2 if wrong
      confident: +5 if correct / -5 if wrong
      reckless: +10 if correct / -10 if wrong
  - Double Up: ×2 to total, but ONLY if total > 0
  - Knockout boost: in knockout rounds the *confidence modifier* is doubled
    (cautious ±4 / confident ±10 / reckless ±20). The flat base (+10) and exact
    bonus (+5) are unchanged, so the safe haul everyone shares stays the same —
    only the risk players opt into pays (or costs) more, widening the per-game
    spread so trailing players can catch up. See CLAUDE.md "Scoring system".
*/

const CONFIDENCE: Record<string, { correct: number; wrong: number }> = {
  cautious:  { correct: 2,  wrong: -2  },
  confident: { correct: 5,  wrong: -5  },
  reckless:  { correct: 10, wrong: -10 },
};

// Confidence multiplier applied in knockout rounds (group stage = 1).
export const KNOCKOUT_CONFIDENCE_MULTIPLIER = 2;

// A match is a knockout tie when it belongs to no group. Group-stage rows always
// carry a group_name (seed: "A", synced: "GROUP_A"); knockout rows have null.
// The stage guard is belt-and-suspenders against malformed group rows.
export function isKnockoutMatch(match: { stage: string | null; group_name: string | null }): boolean {
  return match.group_name === null && match.stage !== "Group Stage";
}

function getOutcome(home: number, away: number): "home" | "draw" | "away" {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

export function calcPoints(
  homePred: number,
  awayPred: number,
  homeActual: number,
  awayActual: number,
  confidence: string | null,
  doubleUp: boolean,
  isKnockout = false
): number {
  const isCorrect = getOutcome(homePred, awayPred) === getOutcome(homeActual, awayActual);
  const isExact = homePred === homeActual && awayPred === awayActual;

  let pts = 0;
  if (isCorrect) pts += 10;
  if (isExact) pts += 5;

  if (confidence && CONFIDENCE[confidence]) {
    const mod = isCorrect ? CONFIDENCE[confidence].correct : CONFIDENCE[confidence].wrong;
    pts += isKnockout ? mod * KNOCKOUT_CONFIDENCE_MULTIPLIER : mod;
  }

  if (doubleUp && pts > 0) pts *= 2;

  return Math.round(pts * 10) / 10;
}

export async function processMatchResult(env: Env, match: Match): Promise<void> {
  if (match.home_score === null || match.away_score === null) return;

  const homeActual = match.home_score;
  const awayActual = match.away_score;

  const groupRows = await env.DB.prepare(
    "SELECT DISTINCT group_id FROM bets WHERE match_id = ? AND points_earned IS NULL"
  ).bind(match.id).all<{ group_id: string }>();

  for (const { group_id } of groupRows.results) {
    const allBets = await env.DB.prepare(
      "SELECT id, user_id, home_score_pred, away_score_pred, confidence, double_up FROM bets WHERE match_id = ? AND group_id = ? AND points_earned IS NULL"
    ).bind(match.id, group_id).all<{
      id: string; user_id: string;
      home_score_pred: number; away_score_pred: number;
      confidence: string | null; double_up: number;
    }>();

    if (allBets.results.length === 0) continue;

    // Write a bet's points_earned and its member's total_points together in one
    // D1 transaction (env.DB.batch is atomic). If the two ran as separate
    // statements and the run were interrupted between them, total_points would
    // drift permanently out of sync with the sum of points_earned. Batching per
    // group keeps each group's scoring all-or-nothing; an unscored group is
    // simply retried on the next sync tick (its bets are still points_earned NULL).
    const knockout = isKnockoutMatch(match);
    const statements: D1PreparedStatement[] = [];
    for (const bet of allBets.results) {
      const pts = calcPoints(
        bet.home_score_pred, bet.away_score_pred,
        homeActual, awayActual,
        bet.confidence, bet.double_up === 1,
        knockout
      );

      statements.push(
        env.DB.prepare("UPDATE bets SET points_earned = ? WHERE id = ?").bind(pts, bet.id)
      );

      // Preview matches: show points on the bet card but don't affect the leaderboard
      if (!match.preview) {
        statements.push(
          env.DB.prepare(
            "UPDATE group_members SET total_points = total_points + ? WHERE group_id = ? AND user_id = ?"
          ).bind(pts, group_id, bet.user_id)
        );
      }
    }

    await env.DB.batch(statements);
  }
}
