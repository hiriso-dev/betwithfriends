"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Flag } from "@/components/flag";
import { BinocularsIcon } from "@/components/icons";
import { getMatchScoreDisplay, PENDING_SCORE } from "@/lib/match-score";

type Match = {
  id: string;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
  match_date: number;
  home_score: number | null;
  away_score: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
  score_duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" | null;
  status: "scheduled" | "live" | "finished" | "postponed";
  stage: string;
  group_name: string | null;
  preview?: number | null;
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
  { value: "cautious",  emoji: "😬", label: "Cautious", n: 2 },
  { value: "confident", emoji: "👍", label: "Confident", n: 5 },
  { value: "reckless",  emoji: "🔥", label: "Reckless",  n: 10 },
] as const;

const CONFIDENCE_EMOJI: Record<string, string> = {
  cautious: "😬", confident: "👍", reckless: "🔥",
};

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

function fmtDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
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

const MAX_DOUBLE_UPS = 2;

export default function MatchCard({
  match,
  groupId,
  doubleUpsUsed = 0,
  onBet,
  onSaved,
}: {
  match: Match;
  groupId?: string;
  doubleUpsUsed?: number;
  onBet: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();

  const [now, setNow] = useState(() => Date.now());

  const kickoff = match.match_date * 1000;
  const secondsLeft = Math.floor((kickoff - now) / 1000);
  const minutesLeft = Math.floor(secondsLeft / 60);
  const isLocked = secondsLeft <= 0 || match.status !== "scheduled";
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  // Once kickoff has passed the bet is locked, so the group's predictions are
  // revealed via the players control — even while status is still `scheduled`
  // (score sync only flips it to `live` ~105 min after kickoff).
  const betsRevealed = secondsLeft <= 0 || isLive || isFinished;

  const hasBet = !!match.my_bet;
  const canBet = !!groupId && !isLocked && !isFinished && !isLive;

  const [formState, setFormState] = useState({
    quickMode: !hasBet && canBet,
    qHome: match.my_bet?.home_score_pred ?? 0,
    qAway: match.my_bet?.away_score_pred ?? 0,
    qConfidence: match.my_bet?.confidence ?? null,
    qDoubleUp: (match.my_bet?.double_up ?? 0) === 1,
  });
  const { quickMode, qHome, qAway, qConfidence, qDoubleUp } = formState;

  // Double Up cap (max 2 per group). doubleUpsUsed counts every match in the
  // group whose bet uses it — including this one — so add 1 back when this bet
  // already has it on, matching the full BetSheet's remaining calculation.
  const alreadyDoubleUp = (match.my_bet?.double_up ?? 0) === 1;
  const doubleUpsRemaining = MAX_DOUBLE_UPS - doubleUpsUsed + (alreadyDoubleUp ? 1 : 0);
  const canDoubleUp = qDoubleUp || doubleUpsRemaining > 0;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fastRefresh = secondsLeft < 300;
  useEffect(() => {
    if (isLocked) return;
    const id = setInterval(() => setNow(Date.now()), fastRefresh ? 1000 : 60000);
    return () => clearInterval(id);
  }, [isLocked, fastRefresh]);

  // Sync bet state when group changes or API data arrives with new bet info.
  // Using a stable string key so we don't react to every render, only real data changes.
  const betKey = `${groupId ?? ""}:${
    match.my_bet
      ? `${match.my_bet.home_score_pred}|${match.my_bet.away_score_pred}|${match.my_bet.confidence ?? ""}|${match.my_bet.double_up}`
      : "none"
  }`;
  useEffect(() => {
    if (saving) return;
    // Sync form state with match data when bet changes; batched into single setState
    // eslint-disable-next-line
    setFormState(prev => ({
      ...prev,
      quickMode: !match.my_bet && !!groupId && !isLocked && !isFinished && !isLive,
      qHome: match.my_bet?.home_score_pred ?? 0,
      qAway: match.my_bet?.away_score_pred ?? 0,
      qConfidence: match.my_bet?.confidence ?? null,
      qDoubleUp: (match.my_bet?.double_up ?? 0) === 1,
    }));
    setSaveError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betKey]);

  function enterEdit(e?: React.MouseEvent) {
    e?.stopPropagation();
    setFormState(prev => ({
      ...prev,
      quickMode: true,
      qHome: match.my_bet?.home_score_pred ?? 0,
      qAway: match.my_bet?.away_score_pred ?? 0,
      qConfidence: match.my_bet?.confidence ?? null,
      qDoubleUp: (match.my_bet?.double_up ?? 0) === 1,
    }));
  }

  function cancelEdit(e?: React.MouseEvent) {
    e?.stopPropagation();
    setFormState(prev => ({ ...prev, quickMode: false }));
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
      setFormState(prev => ({ ...prev, quickMode: false }));
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
  const scoreDisplay = getMatchScoreDisplay(match);
  const primaryScore = scoreDisplay.primary ?? PENDING_SCORE;

  return (
    <div id={`match-${match.id}`} className={`scroll-mt-24 rounded-2xl border bg-surface transition ${
      isLive ? "border-success/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]" : "border-border"
    } p-4`}>

      {/* Header */}
      <div className="mb-2 flex items-start justify-between text-xs text-muted">
        <div>
          <span className="uppercase tracking-wide font-medium flex items-center gap-1.5">
            {match.group_name ? `Group ${match.group_name}` : match.stage}
            {match.preview === 1 && (
              <span className="normal-case text-[9px] font-bold text-warning bg-warning/10 border border-warning/30 rounded px-1 py-0.5 tracking-normal">Exhibition</span>
            )}
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
            <>
              <span className="hidden lg:inline">{fmtDateTime(match.match_date)}</span>
              <span className="lg:hidden">{fmtTime(match.match_date)}</span>
            </>
          )}
        </span>
      </div>

      {quickMode && canBet ? (
        /* ── QUICK BET MODE (default for unbet matches) ── */
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <button
              className="flex-1 min-w-0 text-center pt-3 active:opacity-60"
              onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.home_team_code}`); }}
            >
              <p className="text-3xl leading-none mb-0.5"><Flag code={match.home_team_code} /></p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{match.home_team_code}</p>
              <p className="text-[11px] text-muted leading-tight line-clamp-2 break-words">{match.home_team}</p>
            </button>

            <div className="flex items-start gap-3">
              <TapScore value={qHome} onChange={(v) => setFormState(prev => ({ ...prev, qHome: v }))} />
              <span className="mt-3.5 text-xl font-black text-muted">–</span>
              <TapScore value={qAway} onChange={(v) => setFormState(prev => ({ ...prev, qAway: v }))} />
            </div>

            <button
              className="flex-1 min-w-0 text-center pt-3 active:opacity-60"
              onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.away_team_code}`); }}
            >
              <p className="text-3xl leading-none mb-0.5"><Flag code={match.away_team_code} /></p>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{match.away_team_code}</p>
              <p className="text-[11px] text-muted leading-tight line-clamp-2 break-words">{match.away_team}</p>
            </button>
          </div>

          {/* Boost section — bordered */}
          <div className="mb-3 rounded-xl border border-border p-3 relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBet(); }}
              className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border border-border text-[9px] font-bold text-muted transition active:border-accent active:text-accent"
              title="Scoring options"
            >
              ?
            </button>
            <p className="mb-3 text-center text-[10px] text-muted">Boost your bet — optional</p>
            <div className="flex items-start justify-center gap-3">
              {CONFIDENCE_OPTIONS.map(({ value, emoji, label, n }) => (
                <div key={value} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFormState(prev => ({ ...prev, qConfidence: prev.qConfidence === value ? null : value })); }}
                    className={`h-10 w-10 rounded-full text-xl border-2 transition active:scale-95 ${
                      qConfidence === value ? "border-accent bg-accent/15" : "border-border bg-surface-hover"
                    }`}
                  >
                    {emoji}
                  </button>
                  <span className={`text-[9px] font-medium transition ${qConfidence === value ? "text-accent" : "text-muted"}`}>{label}</span>
                  <span className={`text-[9px] transition ${qConfidence === value ? "text-accent" : "text-muted"}`}>+{n}/-{n}</span>
                </div>
              ))}

              <div className="w-px self-stretch bg-border/60 mx-1" />

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  disabled={!canDoubleUp}
                  onClick={(e) => { e.stopPropagation(); if (canDoubleUp) setFormState(prev => ({ ...prev, qDoubleUp: !prev.qDoubleUp })); }}
                  className={`rounded-full px-3 h-10 text-sm font-black border-2 transition active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${
                    qDoubleUp ? "bg-accent text-[#0f0f23] border-accent" : "border-border text-muted bg-surface-hover"
                  }`}
                >
                  ×2
                </button>
                <span className={`text-[9px] font-medium transition ${qDoubleUp ? "text-accent" : "text-muted"}`}>
                  {canDoubleUp ? "if positive" : "0 left"}
                </span>
              </div>
            </div>
          </div>

          {/* Save + Cancel + Help */}
          {saveError && (
            <p className="mb-2 text-center text-xs text-danger">{saveError}</p>
          )}
          <div className="flex gap-2 items-center">
            <button
              onClick={saveQuick}
              disabled={saving}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 font-bold text-[#0f0f23] text-sm transition active:scale-95 disabled:opacity-50"
            >
              {saving ? "Saving…" : (
                <span className="flex flex-col items-center gap-1">
                  <span className="block text-[15px] leading-none">Save bet</span>
                  {secondsLeft > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0f0f23]/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0f0f23]">
                      <span aria-hidden="true">⏱</span>
                      <span>Locks in {fmtCountdown(secondsLeft)}</span>
                    </span>
                  )}
                </span>
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
              className="flex-1 min-w-0 text-center active:opacity-60"
              onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.home_team_code}`); }}
            >
              <p className="font-bold leading-tight line-clamp-2 break-words">{match.home_team} <Flag code={match.home_team_code} /></p>
              <p className="text-xs text-muted uppercase tracking-wider">{match.home_team_code}</p>
            </button>

            <div className="flex items-center gap-2 min-w-[80px] justify-center">
              {betsRevealed ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const params = groupId ? `?group_id=${groupId}` : "";
                    router.push(`/matches/${match.id}/bets${params}`);
                  }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 transition active:bg-surface-hover hover:border-accent/50"
                  title="See everyone's bets"
                >
                    <span className="flex flex-col items-center leading-none">
                      <span className="text-2xl font-black tabular-nums">{primaryScore}</span>
                      {scoreDisplay.secondary && (
                        <span className="mt-1 text-[10px] font-medium text-muted">{scoreDisplay.secondary}</span>
                      )}
                    </span>
                  <span className="flex flex-col items-center leading-none text-accent">
                    <BinocularsIcon size={16} />
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">Bets</span>
                  </span>
                </button>
              ) : (
                <span className="rounded-lg border border-dashed border-border px-4 py-1 text-sm text-muted">vs</span>
              )}
            </div>

            <button
              className="flex-1 min-w-0 text-center active:opacity-60"
              onClick={(e) => { e.stopPropagation(); router.push(`/teams/${match.away_team_code}`); }}
            >
              <p className="font-bold leading-tight line-clamp-2 break-words"><Flag code={match.away_team_code} /> {match.away_team}</p>
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
