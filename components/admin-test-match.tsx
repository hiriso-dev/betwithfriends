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
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m ${diff % 60}s`;
}

export function AdminTestMatch({ onMatchChange }: { onMatchChange: () => void }) {
  const [matches, setMatches] = useState<TestMatch[]>([]);
  const [creating, setCreating] = useState(false);
  const [offsetMinutes, setOffsetMinutes] = useState(3);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    apiFetch<TestMatch[]>("/api/admin/test-matches")
      .then(setMatches)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tick every second to keep countdown fresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

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

  async function finishMatch(id: string) {
    setFinishingId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/test-matches/${id}/finish`, {
        method: "POST",
        body: JSON.stringify({ home_score: homeScore, away_score: awayScore }),
      });
      load();
      onMatchChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finish");
    } finally {
      setFinishingId(null);
    }
  }

  async function deleteMatch(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/test-matches/${id}`, { method: "DELETE" });
      load();
      onMatchChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  async function reschedule(id: string, minutes: number) {
    setError(null);
    try {
      await apiFetch(`/api/admin/test-matches/${id}/kickoff`, {
        method: "POST",
        body: JSON.stringify({ kickoff_offset_minutes: minutes }),
      });
      load();
      onMatchChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reschedule");
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-accent">Admin — Test Match</p>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {/* Create form */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-[10px] text-muted mb-1">Kickoff in (minutes)</label>
          <input
            type="number"
            value={offsetMinutes}
            onChange={e => setOffsetMinutes(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
            min={-60}
            max={120}
          />
        </div>
        <button
          onClick={createMatch}
          disabled={creating}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
        >
          {creating ? "…" : "+ Create"}
        </button>
      </div>

      {/* Existing test matches */}
      {matches.length > 0 && (
        <div className="space-y-3">
          {matches.map(m => {
            const isFinished = m.status === "finished";
            const countdown = fmtCountdown(m.match_date);
            const locked = countdown === "locked" || isFinished;

            return (
              <div key={m.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{m.home_team} vs {m.away_team}</span>
                  <div className="flex items-center gap-1.5">
                    {isFinished ? (
                      <span className="text-xs text-success font-semibold">
                        {m.home_score}–{m.away_score} ✓
                      </span>
                    ) : (
                      <span className={`text-xs font-semibold ${locked ? "text-danger" : "text-warning"}`}>
                        {locked ? "🔒 locked" : `⏱ ${countdown}`}
                      </span>
                    )}
                    <button
                      onClick={() => deleteMatch(m.id)}
                      disabled={deletingId === m.id}
                      className="rounded-lg border border-border px-2 py-0.5 text-xs text-danger transition active:bg-danger/10 disabled:opacity-40"
                    >
                      {deletingId === m.id ? "…" : "✕"}
                    </button>
                  </div>
                </div>

                {!isFinished && (
                  <>
                    {/* Quick reschedule buttons */}
                    <div className="mb-2 flex gap-1.5 flex-wrap">
                      {[[-2, "Lock now"], [2, "+2m"], [5, "+5m"]].map(([mins, label]) => (
                        <button
                          key={label}
                          onClick={() => reschedule(m.id, mins as number)}
                          className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-medium text-muted transition active:border-accent active:text-accent"
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Finish form */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={homeScore}
                        onChange={e => setHomeScore(Number(e.target.value))}
                        className="w-14 rounded-lg border border-border bg-surface-hover px-2 py-1.5 text-center text-sm font-bold"
                        min={0} max={20}
                      />
                      <span className="text-muted font-bold">–</span>
                      <input
                        type="number"
                        value={awayScore}
                        onChange={e => setAwayScore(Number(e.target.value))}
                        className="w-14 rounded-lg border border-border bg-surface-hover px-2 py-1.5 text-center text-sm font-bold"
                        min={0} max={20}
                      />
                      <button
                        onClick={() => finishMatch(m.id)}
                        disabled={finishingId === m.id}
                        className="flex-1 rounded-xl bg-success/20 border border-success/40 py-1.5 text-xs font-bold text-success transition active:scale-95 disabled:opacity-40"
                      >
                        {finishingId === m.id ? "Scoring…" : "Finish + score"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {matches.length === 0 && (
        <p className="text-center text-xs text-muted">No test matches — create one above</p>
      )}
    </div>
  );
}
