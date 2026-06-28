"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

type BroadcastResult = { subscriptions: number; sent: number; failed: number };

// Reusable announcement templates — one per stage. Pick a round and the
// title/message fields are filled in; both stay editable for custom tweaks.
const BROADCAST_TEMPLATES: { label: string; title: string; body: string }[] = [
  { label: "Round of 32", title: "⚽ Round of 32 is live!", body: "All Round of 32 games are ready! 🔥 New knockout boosters: confidence points are doubled + 2 extra Double Ups. Check them out and place your bets!" },
  { label: "Round of 16", title: "⚽ Round of 16 is live!", body: "All Round of 16 games are ready — place your bets now 🔥" },
  { label: "Quarter-finals", title: "⚽ Quarter-finals are live!", body: "All quarter-final games are ready — place your bets now 🔥" },
  { label: "Semi-finals", title: "⚽ Semi-finals are live!", body: "All semi-final games are ready — place your bets now 🔥" },
  { label: "3rd Place", title: "🥉 Third-place playoff is live!", body: "The third-place playoff is ready — place your bet now 🔥" },
  { label: "Final", title: "🏆 The Final is live!", body: "The World Cup final is ready — place your bet now 🔥" },
  { label: "Custom", title: "", body: "" },
];

export function AdminTestMatch({ onMatchChange }: { onMatchChange: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [competition, setCompetition] = useState("CL");
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("bwf-admin-collapsed") === "1"
  );

  // Broadcast announcement state
  const [bcTitle, setBcTitle] = useState(BROADCAST_TEMPLATES[0].title);
  const [bcBody, setBcBody] = useState(BROADCAST_TEMPLATES[0].body);
  const [bcTemplate, setBcTemplate] = useState(BROADCAST_TEMPLATES[0].label);
  const [sending, setSending] = useState(false);
  const [bcResult, setBcResult] = useState<string | null>(null);

  function applyTemplate(label: string) {
    setBcTemplate(label);
    const tpl = BROADCAST_TEMPLATES.find(t => t.label === label);
    if (tpl && label !== "Custom") {
      setBcTitle(tpl.title);
      setBcBody(tpl.body);
    }
  }

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

  async function broadcast() {
    if (!bcTitle.trim() || !bcBody.trim()) {
      setBcResult("✗ Title and message are required");
      return;
    }
    if (!confirm("Send this push notification to all subscribed users?")) return;
    setSending(true);
    setBcResult(null);
    try {
      const r = await apiFetch<BroadcastResult>("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({ title: bcTitle.trim(), body: bcBody.trim() }),
      });
      setBcResult(`✓ Sent to ${r.sent}/${r.subscriptions} device${r.subscriptions === 1 ? "" : "s"}${r.failed ? ` · ${r.failed} failed` : ""}`);
    } catch (e) {
      setBcResult(e instanceof Error ? `✗ ${e.message}` : "✗ Failed");
    } finally {
      setSending(false);
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

          {/* Broadcast announcement to all subscribed users */}
          <div className="mt-3 pt-3 border-t border-accent/20 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Broadcast Notification</p>
            <p className="text-[10px] text-muted leading-relaxed">
              Push a one-off announcement to everyone with notifications enabled. Pick a round to fill the message, then edit if needed. Tapping it opens the games screen.
            </p>
            <select
              value={bcTemplate}
              onChange={e => applyTemplate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
            >
              {BROADCAST_TEMPLATES.map(t => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
            <input
              value={bcTitle}
              onChange={e => { setBcTitle(e.target.value); setBcTemplate("Custom"); }}
              placeholder="Title"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
            />
            <textarea
              value={bcBody}
              onChange={e => { setBcBody(e.target.value); setBcTemplate("Custom"); }}
              placeholder="Message"
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs resize-none"
            />
            <button
              onClick={broadcast}
              disabled={sending}
              className="w-full rounded-xl bg-accent px-4 py-1.5 text-sm font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send to all users"}
            </button>
            {bcResult && (
              <p className={`text-[10px] ${bcResult.startsWith("✓") ? "text-success" : "text-danger"}`}>
                {bcResult}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
