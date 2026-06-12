export type MatchScoreLike = {
  home_score: number | null;
  away_score: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
  score_duration: string | null;
};

// Shown in place of a score when a match has started/finished but its score
// has not been synced from the football-data API yet. A bare dash reads as
// "result pending" rather than a real 0-0 or a broken null-null value.
export const PENDING_SCORE = "–";

function getFinalScoreSuffix(scoreDuration: string | null): string {
  if (scoreDuration === "PENALTY_SHOOTOUT") return " pens";
  if (scoreDuration === "EXTRA_TIME") return " aet";
  return "";
}

export function getMatchScoreDisplay(match: MatchScoreLike): {
  primary: string | null;
  secondary: string | null;
  inline: string | null;
  pending: boolean;
} {
  if (match.home_score === null || match.away_score === null) {
    return { primary: PENDING_SCORE, secondary: null, inline: PENDING_SCORE, pending: true };
  }

  const primary = `${match.home_score} – ${match.away_score}`;
  const hasDistinctFinal =
    match.final_home_score !== null &&
    match.final_away_score !== null &&
    (match.final_home_score !== match.home_score || match.final_away_score !== match.away_score);

  if (!hasDistinctFinal) {
    return { primary, secondary: null, inline: primary, pending: false };
  }

  const secondary = `(${match.final_home_score} – ${match.final_away_score}${getFinalScoreSuffix(match.score_duration)})`;
  return {
    primary,
    secondary,
    inline: `${primary} ${secondary}`,
    pending: false,
  };
}