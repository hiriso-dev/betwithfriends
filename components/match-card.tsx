"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Flag } from "@/components/flag";

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

const CONFIDENCE_OPTIONS = [
  { value: "cautious",  emoji: "😬", label: "Cautious", pts: "±2" },
  { value: "confident", emoji: "👍", label: "Confident", pts: "±5" },
  { value: "reckless",  emoji: "🔥", label: "Reckless",  pts: "±10" },
] as const;

const CONFIDENCE_EMOJI: Record<string, string> = {
  cautious: "😬", confident: "👍", reckless: "🔥",
};

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return "";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function TapScore({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(value + 1); }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-accent/50 bg-surface-hover text-3xl font-black tabular-nums transition active:scale-95 active:border-accent active:bg-accent/10 select-none"
      >
        {value}
      </button>
      {/* Decrement — always takes space, hidden at 0 */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - 1)); }}
        className={`flex h-7 w-14 items-center justify-center rounded-lg border font-bold text-base transition active:scale-95 ${
          value > 0
            ? "border-border bg-surface-hover text-foreground active:border-accent active:text-accent"
            : "border-transparent opacity-0 pointer-events-none"
        }`}
      >
        −
      </button>
    </div>
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

  const now = Date.now();
  const kickoff = match.match_date * 1000;
  const secondsLeft = Math.floor((kickoff - now) / 1000);
  const minutesLeft = Math.floor(secondsLeft / 60);
  const isLocked = secondsLeft <= 0 || match.status !== "scheduled";
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasBet = !!match.my_bet;
  const canBet = !!groupId && !isLocked && !isFinished && !isLive;

  // Show bet inputs immediately for unbet bettable matches — no tap required
  const [quickMode, setQuickMode] = useState(!hasBet && canBet);
  const [qHome, setQHome] = useState(match.my_bet?.home_score_pred ?? 0);
  const [qAway, setQAway] = useState(match.my_bet?.away_score_pred ?? 0);
  const [qConfidence, setQConfidence] = useState<string | null>(match.my_bet?.confidence ?? null);
  const [qDoubleUp, setQDoubleUp] = useState((match.my_bet?.double_up ?? 0) === 1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const fastRefresh = secondsLeft < 300;
  useEffect(() => {
    if (isLocked) return;
    const id = setInterval(() => setTick(n => n + 1), fastRefresh ? 1000 : 60000);
    return () => clearInterval(id);
  }, [isLocked, fastRefresh]);

  function enterEdit(e?: React.MouseEvent) {
    e?.stopPropagation();
    setQHome(match.my_bet?.home_score_pred ?? 0);
    setQAway(match.my_bet?.away_score_pred ?? 0);
    setQConfidence(match.my_bet?.confidence ?? null);
    setQDoubleUp((match.my_bet?.double_up ?? 0) === 1);
    setQuickMode(true);
  }

  function cancelEdit(e?: React.MouseEvent) {
    e?.stopPropagation();
    setQuickMode(false);
  }

  async function saveQuick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!groupId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch("/api/bets", {
        method: "POST",
        body: JSON.stringify({
          group_id: groupId,
          match_id: match.id,
          home_score_pred: qHome,
          away_score_pred: qAway,
          confidence: qConfidence,
          double_up: qDoubleUp ? 1 : 0,
        }),
      });
      setQuickMode(false);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save bet");
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
    <div className={`rounded-2xl border bg-surface transition ${
      isLive ? "border-success/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]" : "border-border"
    } p-4`}>

      {/* Header */}
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
          ) : secondsLeft < 3600 ? (
            <span className={isLocked ? "text-danger font-semibold" : "text-warning"}>
              {isLocked ? "🔒 Locked" : secondsLeft < 60 ? `⏱ ${secondsLeft}s` : `⏱ ${minutesLeft}m`}
            </span>
          ) : (
            <span>{fmtTime(match.match_date)}</span>
          )}
        </span>
      </div>

      {quickMode && canBet ? (
        /* ── QUICK BET MODE (default for unbet matches) ── */
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <button
              className="flex-1 text-right pt-3 active:opacity-60"
              onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.home_team_code}`); }}
            >
              <p className="text-3xl leading-none mb-0.5"><Flag code={match.home_team_code} /></p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{match.home_team_code}</p>
              <p className="text-[11px] text-muted leading-tight truncate">{match.home_team}</p>
            </button>

            <div className="flex items-start gap-3">
              <TapScore value={qHome} onChange={setQHome} />
              <span className="mt-3.5 text-xl font-black text-muted">–</span>
              <TapScore value={qAway} onChange={setQAway} />
            </div>

            <button
              className="flex-1 text-left pt-3 active:opacity-60"
              onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.away_team_code}`); }}
            >
              <p className="text-3xl leading-none mb-0.5"><Flag code={match.away_team_code} /></p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{match.away_team_code}</p>
              <p className="text-[11px] text-muted leading-tight truncate">{match.away_team}</p>
            </button>
          </div>

          {/* Confidence + Double Up */}
          <div className="mb-1 flex items-center justify-center gap-2">
            {CONFIDENCE_OPTIONS.map(({ value, emoji }) => (
              <button
                key={value}
                type="button"
                onClick={(e) => { e.stopPropagation(); setQConfidence(qConfidence === value ? null : value); }}
                className={`h-10 w-10 rounded-full text-xl border-2 transition active:scale-95 ${
                  qConfidence === value
                    ? "border-accent bg-accent/15"
                    : "border-border bg-surface-hover"
                }`}
              >
                {emoji}
              </button>
            ))}
            <div className="w-px h-6 bg-border mx-1" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setQDoubleUp(d => !d); }}
              className={`rounded-full px-3.5 h-10 text-sm font-black border-2 transition active:scale-95 ${
                qDoubleUp
                  ? "bg-accent text-[#0f0f23] border-accent"
                  : "border-border text-muted bg-surface-hover"
              }`}
            >
              ×2
            </button>
          </div>

          {/* Icon legend */}
          <div className="mb-4 flex items-center justify-center gap-2 text-[10px] text-muted">
            {CONFIDENCE_OPTIONS.map(({ value, label, pts }) => (
              <span key={value} className={`transition ${qConfidence === value ? "text-accent font-semibold" : ""}`}>
                {label} {pts}
              </span>
            ))}
            <span className="mx-0.5 text-border">|</span>
            <span className={qDoubleUp ? "text-accent font-semibold" : ""}>×2 if positive</span>
          </div>

          {/* Save + Cancel + Help */}
          {saveError && (
            <p className="mb-2 text-center text-xs text-danger">{saveError}</p>
          )}
          <div className="flex gap-2 items-center">
            <button
              onClick={saveQuick}
              disabled={saving}
              className="flex-1 rounded-xl bg-accent py-2 font-bold text-[#0f0f23] text-sm transition active:scale-95 disabled:opacity-50"
            >
              {saving ? "Saving…" : (
                <>
                  <span className="block">Save bet</span>
                  {secondsLeft > 0 && (
                    <span className="block text-[10px] font-normal opacity-60">⏱ {fmtCountdown(secondsLeft)}</span>
                  )}
                </>
              )}
            </button>
            {hasBet && (
              <button
                onClick={cancelEdit}
                className="rounded-xl border border-border px-4 py-3 text-sm text-muted transition active:bg-surface-hover"
              >
                ✕
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setQuickMode(false); onBet(); }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-sm font-bold text-muted transition active:border-accent active:text-accent"
              title="Scoring options"
            >
              ?
            </button>
          </div>
        </div>
      ) : (
        /* ── NORMAL VIEW ── */
        <>
          {/* Teams + Score */}
          <div
            className={`flex items-center justify-between gap-2 ${hasBet && canBet ? "cursor-pointer" : ""}`}
            onClick={hasBet && canBet ? enterEdit : undefined}
          >
            <button
              className="flex-1 text-right active:opacity-60"
              onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.home_team_code}`); }}
            >
              <p className="font-bold leading-tight">{match.home_team} <Flag code={match.home_team_code} /></p>
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
              <p className="font-bold leading-tight"><Flag code={match.away_team_code} /> {match.away_team}</p>
              <p className="text-xs text-muted uppercase tracking-wider">{match.away_team_code}</p>
            </button>
          </div>

          {/* Bet area */}
          {groupId && (
            <div className="mt-3 pt-3 border-t border-border">
              {hasBet ? (
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
                      <span className="text-xs bg-accent/15 text-accent rounded px-1 font-bold">×2</span>
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
                        {betResult && <span className={`text-xs ${resultColor}`}>{resultLabel}</span>}
                      </div>
                    ) : !isLocked ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); enterEdit(e); }}
                        className="text-xs text-muted border border-border rounded-lg px-2.5 py-1 transition active:bg-surface-hover"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : isLocked ? (
                <p className="text-center text-xs text-muted">No prediction placed</p>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
