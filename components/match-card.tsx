"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

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
  my_bet?: {
    home_score_pred: number;
    away_score_pred: number;
    points_earned: number | null;
    confidence: string | null;
    double_up: number;
  };
};

const CONFIDENCE_EMOJI: Record<string, string> = {
  cautious: "😬",
  confident: "👍",
  reckless: "🔥",
};

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function ScoreBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover border border-border text-sm font-bold active:bg-accent/20 transition"
    >
      {children}
    </button>
  );
}

export default function MatchCard({
  match,
  groupId,
  onBet,
  onSaved,
}: {
  match: Match;
  groupId?: string;
  onBet: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [quickMode, setQuickMode] = useState(false);
  const [qHome, setQHome] = useState(match.my_bet?.home_score_pred ?? 0);
  const [qAway, setQAway] = useState(match.my_bet?.away_score_pred ?? 0);
  const [saving, setSaving] = useState(false);

  const now = Date.now();
  const kickoff = match.match_date * 1000;
  const minutesLeft = Math.floor((kickoff - now) / 60000);
  const isLocked = minutesLeft <= 5 || match.status !== "scheduled";
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasBet = !!match.my_bet;
  const canBet = !!groupId && !isLocked && !isFinished && !isLive;

  function enterQuick(e?: React.MouseEvent) {
    e?.stopPropagation();
    setQHome(match.my_bet?.home_score_pred ?? 0);
    setQAway(match.my_bet?.away_score_pred ?? 0);
    setQuickMode(true);
  }

  function cancelQuick(e?: React.MouseEvent) {
    e?.stopPropagation();
    setQuickMode(false);
  }

  async function saveQuick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!groupId) return;
    setSaving(true);
    try {
      await apiFetch("/api/bets", {
        method: "POST",
        body: JSON.stringify({
          group_id: groupId,
          match_id: match.id,
          home_score_pred: qHome,
          away_score_pred: qAway,
          confidence: match.my_bet?.confidence ?? null,
          double_up: match.my_bet?.double_up ?? 0,
        }),
      });
      setQuickMode(false);
      onSaved?.();
    } catch {
      // silent — user can retry or open full sheet
    } finally {
      setSaving(false);
    }
  }

  const betResult = (() => {
    if (!isFinished || !match.my_bet || match.home_score === null) return null;
    const { home_score_pred: hp, away_score_pred: ap } = match.my_bet;
    const hr = match.home_score!;
    const ar = match.away_score!;
    if (hp === hr && ap === ar) return "exact";
    const predResult = hp > ap ? "home" : hp < ap ? "away" : "draw";
    const actResult = hr > ar ? "home" : hr < ar ? "away" : "draw";
    if (predResult === actResult) return "result";
    return "wrong";
  })();

  const resultColor = { exact: "text-success", result: "text-warning", wrong: "text-danger", null: "text-muted" }[betResult ?? "null"];
  const resultLabel = { exact: "⭐ Exact!", result: "✓ Correct result", wrong: "✗ Wrong", null: "" }[betResult ?? "null"];

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 transition ${
        isLive ? "border-success/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]" :
        isFinished ? "border-border" :
        canBet ? "border-border active:border-accent/50 active:bg-surface-hover cursor-pointer" :
        "border-border"
      }`}
      onClick={canBet && !quickMode ? enterQuick : undefined}
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

      {/* Bet area */}
      {groupId && (
        <div className="mt-3 pt-3 border-t border-border">
          {quickMode ? (
            /* Quick bet entry */
            <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5">
                <ScoreBtn onClick={() => setQHome(Math.max(0, qHome - 1))}>−</ScoreBtn>
                <span className="w-6 text-center font-black tabular-nums text-lg">{qHome}</span>
                <ScoreBtn onClick={() => setQHome(qHome + 1)}>+</ScoreBtn>
              </div>
              <span className="text-muted font-semibold">–</span>
              <div className="flex items-center gap-1.5">
                <ScoreBtn onClick={() => setQAway(Math.max(0, qAway - 1))}>−</ScoreBtn>
                <span className="w-6 text-center font-black tabular-nums text-lg">{qAway}</span>
                <ScoreBtn onClick={() => setQAway(qAway + 1)}>+</ScoreBtn>
              </div>
              <div className="flex items-center gap-2 ml-1">
                <button
                  onClick={saveQuick}
                  disabled={saving}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[#0f0f23] font-bold text-sm transition active:scale-95 disabled:opacity-50"
                >
                  {saving ? "…" : "✓"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); cancelQuick(); onBet(); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover border border-border text-sm transition active:scale-95"
                  title="Full bet sheet"
                >
                  ⚙
                </button>
                <button
                  onClick={cancelQuick}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover border border-border text-xs text-muted transition active:scale-95"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : hasBet ? (
            /* Existing bet display */
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-muted flex-wrap">
                <span>Your bet:</span>
                <span className="font-semibold text-foreground">
                  {match.my_bet!.home_score_pred} – {match.my_bet!.away_score_pred}
                </span>
                {match.my_bet!.confidence && (
                  <span className="text-base">{CONFIDENCE_EMOJI[match.my_bet!.confidence]}</span>
                )}
                {match.my_bet!.double_up === 1 && (
                  <span className="text-xs bg-accent/15 text-accent rounded px-1">×2</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isFinished ? (
                  <div className="flex flex-col items-end gap-0.5">
                    {match.my_bet?.points_earned !== null && (
                      <span className={`font-bold text-sm ${resultColor}`}>
                        {(match.my_bet!.points_earned! > 0 ? "+" : "") + match.my_bet!.points_earned!.toFixed(1) + "pts"}
                      </span>
                    )}
                    {betResult && (
                      <span className={`text-xs ${resultColor}`}>{resultLabel}</span>
                    )}
                  </div>
                ) : !isLocked ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); enterQuick(e); }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover border border-border text-xs transition active:scale-95"
                      title="Quick edit"
                    >
                      ✏
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onBet(); }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover border border-border text-xs transition active:scale-95"
                      title="Full bet sheet"
                    >
                      ⚙
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : !isLocked ? (
            /* No bet yet — tap to quick-bet */
            <button
              onClick={(e) => { e.stopPropagation(); enterQuick(e); }}
              className="w-full rounded-xl bg-accent/10 border border-accent/30 py-2 text-sm font-semibold text-accent transition active:bg-accent/20"
            >
              Tap to bet quickly · ⚙ for full options
            </button>
          ) : (
            <p className="text-center text-xs text-muted">No prediction placed</p>
          )}
        </div>
      )}
    </div>
  );
}
