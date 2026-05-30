export type MatchScoreLike = {
  home_score: number | null;
  away_score: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
  score_duration: string | null;
};

function getFinalScoreSuffix(scoreDuration: string | null): string {
  if (scoreDuration === "PENALTY_SHOOTOUT") return " pens";
  if (scoreDuration === "EXTRA_TIME") return " aet";
  return "";
}

export function getMatchScoreDisplay(match: MatchScoreLike): {
  primary: string | null;
  secondary: string | null;
  inline: string | null;
} {
  if (match.home_score === null || match.away_score === null) {
    return { primary: null, secondary: null, inline: null };
  }

  const primary = `${match.home_score} – ${match.away_score}`;
  const hasDistinctFinal =
    match.final_home_score !== null &&
    match.final_away_score !== null &&
    (match.final_home_score !== match.home_score || match.final_away_score !== match.away_score);

  if (!hasDistinctFinal) {
    return { primary, secondary: null, inline: primary };
  }

  const secondary = `(${match.final_home_score} – ${match.final_away_score}${getFinalScoreSuffix(match.score_duration)})`;
  return {
    primary,
    secondary,
    inline: `${primary} ${secondary}`,
  };
}