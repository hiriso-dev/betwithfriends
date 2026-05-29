"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { GOLDEN_BOOT_PLAYERS } from "@/lib/golden-boot-players";
import { WC_TEAMS } from "@/lib/wc-teams";

const BET_TYPES = [
  { type: "champion", label: "🏆 World Champion", points: 50 },
  { type: "runner_up", label: "🥈 Runner-up", points: 20 },
  { type: "third_place", label: "🥉 Third place", points: 15 },
  { type: "top_scorer", label: "⚽ Golden Boot", points: 30 },
] as const;

type Summary = Record<string, { winners: number; settled: number }>;

export function AdminResolveSpecial() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("bwf-admin-resolve-collapsed") !== "0"
  );

  function toggleCollapse() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("bwf-admin-resolve-collapsed", next ? "1" : "0");
      return next;
    });
  }

  async function resolve() {
    const results = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)
    );
    if (Object.keys(results).length === 0) {
      setError("Enter at least one winning value");
      return;
    }
    setSaving(true);
    setError(null);
    setSummary(null);
    try {
      const res = await apiFetch<{ ok: boolean; summary: Summary }>("/api/admin/resolve-special", {
        method: "POST",
        body: JSON.stringify({ results }),
      });
      setSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/5">
      <button onClick={toggleCollapse} className="w-full flex items-center justify-between px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin — Settle Special Bets</p>
        <span className="text-muted text-sm">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[10px] text-muted leading-relaxed">
            Enter the winning value for each special bet (must match the pick text exactly — names/teams
            are matched case-insensitively). Awards points to every correct pick across all groups and
            adds them to the leaderboard. Safe to re-run: re-submitting recomputes and only applies the
            difference. Leave a field blank to skip it.
          </p>

          <div className="space-y-2">
            {BET_TYPES.map((bt) => {
              const isPlayer = bt.type === "top_scorer";
              return (
                <div key={bt.type} className="flex items-center gap-2">
                  <label className="w-32 shrink-0 text-xs text-foreground">
                    {bt.label}
                    <span className="ml-1 text-muted">+{bt.points}</span>
                  </label>
                  <select
                    value={values[bt.type] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [bt.type]: e.target.value }))}
                    className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
                  >
                    <option value="">— {isPlayer ? "Select player" : "Select team"} —</option>
                    {isPlayer
                      ? GOLDEN_BOOT_PLAYERS.map((p) => (
                          <option key={p.rank} value={p.name}>
                            {p.name} ({p.country})
                          </option>
                        ))
                      : WC_TEAMS.map((t) => (
                          <option key={t.code} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                  </select>
                </div>
              );
            })}
          </div>

          <button
            onClick={resolve}
            disabled={saving}
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
          >
            {saving ? "Settling…" : "Settle special bets"}
          </button>

          {error && <p className="text-[10px] text-danger">✗ {error}</p>}

          {summary && (
            <div className="space-y-1 text-[10px] text-success">
              {Object.entries(summary).map(([type, s]) => {
                const label = BET_TYPES.find((b) => b.type === type)?.label ?? type;
                return (
                  <p key={type}>
                    ✓ {label}: {s.winners} winner{s.winners === 1 ? "" : "s"} of {s.settled} pick
                    {s.settled === 1 ? "" : "s"}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
