// Official World Cup 2026 final results — the answers to the four special bets.
// These are the canonical values the admin settled with (must match the pick
// text / GOLDEN_BOOT_PLAYERS name exactly, case-insensitively) so the results
// pages can mark each pick right or wrong and show the true outcome even when
// nobody in a group picked it.

export type SpecialResult = {
  type: "champion" | "runner_up" | "third_place" | "top_scorer";
  label: string;
  emoji: string;
  points: number;
  value: string; // winning team name or player name
  code: string;  // FIFA 3-letter flag code
};

export const TOURNAMENT_RESULTS: SpecialResult[] = [
  { type: "champion",    label: "World Champion", emoji: "🏆", points: 50, value: "Spain",         code: "ESP" },
  { type: "runner_up",   label: "Runner-up",      emoji: "🥈", points: 20, value: "Argentina",     code: "ARG" },
  { type: "third_place", label: "Third place",    emoji: "🥉", points: 15, value: "England",        code: "ENG" },
  { type: "top_scorer",  label: "Golden Boot",    emoji: "⚽", points: 30, value: "Kylian Mbappé", code: "FRA" },
];

export const RESULT_BY_TYPE: Record<string, SpecialResult> = Object.fromEntries(
  TOURNAMENT_RESULTS.map((r) => [r.type, r])
);

// A pick matches the official result if its trimmed text equals the result
// value case-insensitively — same rule the resolve-special endpoint uses.
export function isCorrectPick(betType: string, value: string | undefined | null): boolean {
  const result = RESULT_BY_TYPE[betType];
  if (!result || !value) return false;
  return value.trim().toLowerCase() === result.value.trim().toLowerCase();
}
