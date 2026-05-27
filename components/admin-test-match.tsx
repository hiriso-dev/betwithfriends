"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export function AdminTestMatch({ onMatchChange }: { onMatchChange: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [competition, setCompetition] = useState("CL");
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("bwf-admin-collapsed") === "1"
  );

  function toggleCollapse() {
    setCollapsed(v => {
      const next = !v;
      localStorage.setItem("bwf-admin-collapsed", next ? "1" : "0");
      return next;
    });
  }

  async function sync() {
    setSyncing(true);
    setResult(null);
    try {
      await apiFetch("/api/admin/sync", {
        method: "POST",
        body: JSON.stringify({ competition }),
      });
      setResult(`✓ Synced ${competition} — matches added to schedule`);
      onMatchChange();
    } catch (e) {
      setResult(e instanceof Error ? `✗ ${e.message}` : "✗ Failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/5">
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Admin — Sync Matches</p>
        <span className="text-muted text-sm">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[10px] text-muted leading-relaxed">
            Pull real matches from football-data.org. New matches are added to the schedule; existing ones updated.
          </p>
          <div className="flex gap-2">
            <select
              value={competition}
              onChange={e => setCompetition(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
            >
              <option value="WC">WC — World Cup 2026</option>
              <option value="CL">CL — Champions League</option>
              <option value="PL">PL — Premier League</option>
              <option value="FL1">FL1 — Ligue 1</option>
              <option value="BL1">BL1 — Bundesliga</option>
              <option value="SA">SA — Serie A</option>
              <option value="PD">PD — La Liga</option>
            </select>
            <button
              onClick={sync}
              disabled={syncing}
              className="rounded-xl bg-accent px-4 py-1.5 text-sm font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
          {result && (
            <p className={`text-[10px] ${result.startsWith("✓") ? "text-success" : "text-danger"}`}>
              {result}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
