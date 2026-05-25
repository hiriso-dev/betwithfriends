"use client";
import { useRouter } from "next/navigation";

type Match = {
  id: string;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
  match_date: number;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "finished" | "postponed";
  stage: string;
  group_name: string | null;
  stadium: string | null;
  venue_city: string | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  my_bet?: {
    home_score_pred: number;
    away_score_pred: number;
    points_earned: number | null;
    cote_applied: number | null;
  };
};

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default function MatchCard({
  match,
  groupId,
  onBet,
}: {
  match: Match;
  groupId?: string;
  onBet: () => void;
}) {
  const router = useRouter();
  const now = Date.now();
  const kickoff = match.match_date * 1000;
  const minutesLeft = Math.floor((kickoff - now) / 60000);
  const isLocked = minutesLeft <= 5 || match.status !== "scheduled";
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasBet = !!match.my_bet;

  const betResult = (() => {
    if (!isFinished || !match.my_bet || match.home_score === null) return null;
    const { home_score_pred: hp, away_score_pred: ap } = match.my_bet;
    const hr = match.home_score!;
    const ar = match.away_score!;
    if (hp === hr && ap === ar) return "exact";
    const predResult = hp > ap ? "home" : hp < ap ? "away" : "draw";
    const actResult = hr > ar ? "home" : hr < ar ? "away" : "draw";
    if (predResult === actResult) return hp - ap === hr - ar ? "diff" : "result";
    return "wrong";
  })();

  const resultColor = { exact: "text-success", diff: "text-success", result: "text-warning", wrong: "text-danger", null: "text-muted" }[betResult ?? "null"];
  const resultLabel = { exact: "⭐ Exact!", diff: "✓ Correct +diff", result: "✓ Correct result", wrong: "✗ Wrong", null: "" }[betResult ?? "null"];

  const showOdds = !isFinished && !isLive && (match.home_odds || match.draw_odds || match.away_odds);

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 transition ${
        isLive ? "border-success/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]" :
        isFinished ? "border-border" :
        "border-border active:border-accent/50 active:bg-surface-hover cursor-pointer"
      }`}
      onClick={!isFinished && !isLive ? onBet : undefined}
    >
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between text-xs text-muted">
        <div>
          <span className="uppercase tracking-wide font-medium">
            {match.group_name ? `Group ${match.group_name}` : match.stage}
          </span>
          {(match.stadium || match.venue_city) && (
            <p className="mt-0.5 text-[10px] truncate max-w-[160px]">
              {[match.stadium, match.venue_city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <span className="flex items-center gap-1.5 shrink-0 ml-2">
          {isLive && <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />}
          {isLive ? (
            <span className="font-semibold text-success">LIVE</span>
          ) : isFinished ? (
            <span>Full time</span>
          ) : minutesLeft < 60 ? (
            <span className={minutesLeft <= 5 ? "text-danger font-semibold" : "text-warning"}>
              {minutesLeft <= 5 ? "🔒 Locked" : `⏱ ${minutesLeft}m`}
            </span>
          ) : (
            <span>{fmtTime(match.match_date)}</span>
          )}
        </span>
      </div>

      {/* Odds row */}
      {showOdds && (
        <div className="mb-2 flex gap-3 text-[10px] text-muted">
          <span>H {match.home_odds}×</span>
          <span>D {match.draw_odds}×</span>
          <span>A {match.away_odds}×</span>
        </div>
      )}

      {/* Teams + Score */}
      <div className="flex items-center justify-between gap-2">
        <button
          className="flex-1 text-right active:opacity-60"
          onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.home_team_code}`); }}
        >
          <p className="font-bold leading-tight">{match.home_team}</p>
          <p className="text-xs text-muted uppercase tracking-wider">{match.home_team_code}</p>
        </button>

        <div className="flex items-center gap-2 min-w-[80px] justify-center">
          {isFinished || isLive ? (
            <span className="text-2xl font-black tabular-nums">
              {match.home_score ?? 0} – {match.away_score ?? 0}
            </span>
          ) : (
            <span className="rounded-lg border border-dashed border-border px-4 py-1 text-sm text-muted">vs</span>
          )}
        </div>

        <button
          className="flex-1 text-left active:opacity-60"
          onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.away_team_code}`); }}
        >
          <p className="font-bold leading-tight">{match.away_team}</p>
          <p className="text-xs text-muted uppercase tracking-wider">{match.away_team_code}</p>
        </button>
      </div>

      {/* Bet info */}
      {groupId && (
        <div className="mt-3 pt-3 border-t border-border">
          {hasBet ? (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-muted">
                <span>Your bet:</span>
                <span className="font-semibold text-foreground">
                  {match.my_bet!.home_score_pred} – {match.my_bet!.away_score_pred}
                </span>
                {!isLocked && !isFinished && (
                  <span className="text-xs text-accent underline cursor-pointer" onClick={(e) => { e.stopPropagation(); onBet(); }}>
                    edit
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {isFinished && match.my_bet?.points_earned !== null && (
                  <span className={`font-bold text-sm ${resultColor}`}>
                    {match.my_bet!.points_earned! > 0 ? `+${match.my_bet!.points_earned!.toFixed(1)}pts` : "0pts"}
                  </span>
                )}
                {isFinished && match.my_bet?.cote_applied && (
                  <span className="text-[10px] text-muted">{match.my_bet.cote_applied}×</span>
                )}
                {isFinished && betResult && (
                  <span className={`text-xs ${resultColor}`}>{resultLabel}</span>
                )}
              </div>
            </div>
          ) : (
            !isLocked && (
              <button
                onClick={(e) => { e.stopPropagation(); onBet(); }}
                className="w-full rounded-xl bg-accent/10 border border-accent/30 py-2 text-sm font-semibold text-accent transition active:bg-accent/20"
              >
                Place bet
              </button>
            )
          )}
          {isLocked && !hasBet && !isFinished && (
            <p className="text-center text-xs text-muted">No prediction placed</p>
          )}
        </div>
      )}
    </div>
  );
}
