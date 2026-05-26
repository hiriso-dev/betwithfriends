"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

type TestMatch = {
  id: string;
  home_team: string;
  away_team: string;
  match_date: number;
  status: "scheduled" | "live" | "finished";
  home_score: number | null;
  away_score: number | null;
};

function fmtCountdown(matchDate: number): string {
  const diff = Math.floor((matchDate * 1000 - Date.now()) / 1000);
  if (diff <= 0) return "locked";
  if (diff < 60) return `${diff}s left to bet`;
  return `${Math.floor(diff / 60)}m ${diff % 60}s left to bet`;
}

function MatchRow({
  m,
  onFinish,
  onLock,
  onDelete,
}: {
  m: TestMatch;
  onFinish: (id: string, home: number, away: number) => Promise<void>;
  onLock: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [homeScore, setHomeScore] = useState(1);
  const [awayScore, setAwayScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const isFinished = m.status === "finished";
  const countdown = fmtCountdown(m.match_date);
  const isLocked = countdown === "locked";
  const bettingOpen = !isLocked && !isFinished;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="font-semibold text-sm">{m.home_team} vs {m.away_team}</span>
        <button
          onClick={() => run(() => onDelete(m.id))}
          disabled={busy}
          className="text-xs text-danger border border-danger/30 rounded-lg px-2 py-0.5 transition active:bg-danger/10 disabled:opacity-40"
        >
          {busy ? "…" : "Delete all"}
        </button>
      </div>

      {isFinished ? (
        /* ── DONE ── */
        <div className="px-3 py-3 space-y-1">
          <p className="text-sm font-bold text-success text-center">
            ✓ Finished {m.home_score} – {m.away_score}
          </p>
          <p className="text-xs text-muted text-center">
            Check your bet in the schedule below to see points earned
          </p>
        </div>
      ) : (
        <div className="px-3 py-3 space-y-3">

          {/* Step 1 — Bet window */}
          <div className={`rounded-lg px-3 py-2 ${bettingOpen ? "bg-warning/10 border border-warning/30" : "bg-surface-hover border border-border opacity-60"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-warning mb-0.5">
              Step 1 — Place your bet
            </p>
            {bettingOpen ? (
              <p className="text-xs text-warning font-semibold">⏱ {countdown}</p>
            ) : (
              <p className="text-xs text-muted">🔒 Betting closed</p>
            )}
            {bettingOpen && (
              <p className="text-[10px] text-muted mt-0.5">Find the match in the schedule below and bet on it</p>
            )}
          </div>

          {/* Step 2 — Close betting */}
          {bettingOpen && (
            <div className="rounded-lg px-3 py-2 bg-surface-hover border border-border">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
                Step 2 — Close betting when ready
              </p>
              <button
                onClick={() => run(() => onLock(m.id))}
                disabled={busy}
                className="w-full rounded-lg border border-danger/40 bg-danger/10 py-1.5 text-xs font-bold text-danger transition active:scale-95 disabled:opacity-40"
              >
                {busy ? "…" : "🔒 Close betting now"}
              </button>
            </div>
          )}

          {/* Step 3 — Set final score */}
          <div className={`rounded-lg px-3 py-2 border ${!bettingOpen ? "bg-success/5 border-success/30" : "bg-surface-hover border-border opacity-50"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">
              Step 3 — Set final score &amp; calculate points
            </p>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 text-center">
                <p className="text-[10px] text-muted mb-1">Test FC</p>
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => setHomeScore(v => Math.max(0, v - 1))} className="h-7 w-7 rounded-lg bg-surface border border-border text-base font-bold transition active:scale-90">−</button>
                  <span className="w-8 text-center text-xl font-black">{homeScore}</span>
                  <button onClick={() => setHomeScore(v => Math.min(20, v + 1))} className="h-7 w-7 rounded-lg bg-surface border border-border text-base font-bold transition active:scale-90">+</button>
                </div>
              </div>
              <span className="text-lg font-black text-muted">–</span>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-muted mb-1">Dev United</p>
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => setAwayScore(v => Math.max(0, v - 1))} className="h-7 w-7 rounded-lg bg-surface border border-border text-base font-bold transition active:scale-90">−</button>
                  <span className="w-8 text-center text-xl font-black">{awayScore}</span>
                  <button onClick={() => setAwayScore(v => Math.min(20, v + 1))} className="h-7 w-7 rounded-lg bg-surface border border-border text-base font-bold transition active:scale-90">+</button>
                </div>
              </div>
            </div>
            <button
              onClick={() => run(() => onFinish(m.id, homeScore, awayScore))}
              disabled={busy || bettingOpen}
              className="w-full rounded-xl bg-success/20 border border-success/40 py-2 text-xs font-bold text-success transition active:scale-95 disabled:opacity-40"
            >
              {busy ? "Calculating…" : bettingOpen ? "Close betting first" : "Finish & calculate points ✓"}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

export function AdminTestMatch({ onMatchChange }: { onMatchChange: () => void }) {
  const [matches, setMatches] = useState<TestMatch[]>([]);
  const [creating, setCreating] = useState(false);
  const [offsetMinutes, setOffsetMinutes] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<TestMatch[]>("/api/admin/test-matches")
      .then(setMatches)
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createMatch() {
    setCreating(true);
    setError(null);
    try {
      await apiFetch("/api/admin/test-matches", {
        method: "POST",
        body: JSON.stringify({ kickoff_offset_minutes: offsetMinutes }),
      });
      load();
      onMatchChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function finishMatch(id: string, home: number, away: number) {
    await apiFetch(`/api/admin/test-matches/${id}/finish`, {
      method: "POST",
      body: JSON.stringify({ home_score: home, away_score: away }),
    });
    load();
    onMatchChange();
  }

  async function lockMatch(id: string) {
    await apiFetch(`/api/admin/test-matches/${id}/kickoff`, {
      method: "POST",
      body: JSON.stringify({ kickoff_offset_minutes: -2 }),
    });
    load();
    onMatchChange();
  }

  async function deleteMatch(id: string) {
    await apiFetch(`/api/admin/test-matches/${id}`, { method: "DELETE" });
    load();
    onMatchChange();
  }

  return (
    <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">Admin — Test Match</p>
      <p className="mb-3 text-[10px] text-muted">Create a fake match, bet on it, then finish it to see your points</p>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {/* Create */}
      {matches.filter(m => m.status !== "finished").length === 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-[10px] text-muted mb-1">Minutes to bet before kickoff</label>
            <input
              type="number"
              value={offsetMinutes}
              onChange={e => setOffsetMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              min={1} max={60}
            />
          </div>
          <button
            onClick={createMatch}
            disabled={creating}
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
          >
            {creating ? "…" : "Create"}
          </button>
        </div>
      )}

      {/* Match list */}
      {matches.length > 0 ? (
        <div className="space-y-3">
          {matches.map(m => (
            <MatchRow
              key={m.id}
              m={m}
              onFinish={finishMatch}
              onLock={lockMatch}
              onDelete={deleteMatch}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-muted py-2">No test match yet</p>
      )}
    </div>
  );
}
