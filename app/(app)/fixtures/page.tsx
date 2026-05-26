"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import MatchCard from "@/components/match-card";
import { useRouter } from "next/navigation";

const WC_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

type Match = {
  id: string;
  home_team: string; away_team: string;
  home_team_code: string; away_team_code: string;
  match_date: number;
  home_score: number | null; away_score: number | null;
  status: "scheduled" | "live" | "finished" | "postponed";
  stage: string; group_name: string | null;
  stadium: string | null; venue_city: string | null;
  my_bet?: { home_score_pred: number; away_score_pred: number; points_earned: number | null; confidence: string | null; double_up: number };
};

type Standing = { team: string; code: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number };
type Group = { id: string; name: string };

function computeStandings(matches: Match[]): Standing[] {
  const map = new Map<string, Standing>();
  for (const m of matches) {
    for (const [team, code] of [[m.home_team, m.home_team_code], [m.away_team, m.away_team_code]] as [string, string][]) {
      if (!map.has(code)) map.set(code, { team, code, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
    }
    if (m.status !== "finished" || m.home_score === null || m.away_score === null) continue;
    const h = map.get(m.home_team_code)!;
    const a = map.get(m.away_team_code)!;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score)      { h.won++; h.points += 3; a.lost++; }
    else if (m.home_score < m.away_score) { a.won++; a.points += 3; h.lost++; }
    else                                  { h.drawn++; h.points++; a.drawn++; a.points++; }
  }
  return [...map.values()]
    .map(t => ({ ...t, gd: t.gf - t.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
}

export default function FixturesPage() {
  const router = useRouter();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [selectedWcGroup, setSelectedWcGroup] = useState("A");
  const [bettingGroupId, setBettingGroupId] = useState<string>("none");
  const [groups, setGroups] = useState<Group[]>([]);
  const [betTarget, setBetTarget] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMatches = useCallback((groupId: string) => {
    const path = groupId !== "none" ? `/api/matches?group_id=${groupId}` : "/api/matches";
    return apiFetch<Match[]>(path);
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch<Group[]>("/api/groups"),
      loadMatches("none"),
    ]).then(([grps, matches]) => {
      setGroups(grps);
      setAllMatches(matches);
      if (grps.length > 0) {
        setBettingGroupId(grps[0].id);
        loadMatches(grps[0].id).then(setAllMatches).catch(() => {});
      }
    }).catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router, loadMatches]);

  useEffect(() => {
    if (loading) return;
    loadMatches(bettingGroupId).then(setAllMatches).catch(() => {});
  }, [bettingGroupId, loadMatches, loading]);

  const groupMatches = allMatches.filter(m => m.group_name === selectedWcGroup);
  const standings = computeStandings(groupMatches);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-10 rounded-xl bg-surface animate-pulse" />
        {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-surface animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-4">
      {/* WC Group tabs */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {WC_GROUPS.map(g => (
          <button
            key={g}
            onClick={() => setSelectedWcGroup(g)}
            className={`shrink-0 h-9 w-9 rounded-xl text-sm font-bold transition ${
              selectedWcGroup === g
                ? "bg-accent text-[#0f0f23]"
                : "bg-surface border border-border text-muted"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Betting group selector */}
      {groups.length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted shrink-0">Bets:</span>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => setBettingGroupId("none")}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                bettingGroupId === "none" ? "bg-accent text-[#0f0f23]" : "bg-surface border border-border text-muted"
              }`}
            >
              None
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setBettingGroupId(g.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                  bettingGroupId === g.id ? "bg-accent text-[#0f0f23]" : "bg-surface border border-border text-muted"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matches */}
      <div className="space-y-3 mb-6">
        {groupMatches.sort((a, b) => a.match_date - b.match_date).map(match => (
          <MatchCard
            key={match.id}
            match={match}
            groupId={bettingGroupId !== "none" ? bettingGroupId : undefined}
            onBet={() => setBetTarget(match)}
          />
        ))}
        {groupMatches.length === 0 && (
          <div className="py-12 text-center text-muted text-sm">No matches in Group {selectedWcGroup}</div>
        )}
      </div>

      {/* Group Standings */}
      {standings.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Group {selectedWcGroup} Standings</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="px-3 py-2 text-left w-6">#</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-2 py-2 text-center">P</th>
                <th className="px-2 py-2 text-center">W</th>
                <th className="px-2 py-2 text-center">D</th>
                <th className="px-2 py-2 text-center">L</th>
                <th className="px-2 py-2 text-center">GD</th>
                <th className="px-2 py-2 text-center font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.code}
                  className={`border-b border-border last:border-0 cursor-pointer active:bg-surface-hover transition ${i < 2 ? "bg-accent/5" : ""}`}
                  onClick={() => router.push(`/teams/${s.code}`)}
                >
                  <td className="px-3 py-2.5">
                    <span className={`font-bold ${i < 2 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold">{s.team}</span>
                    <span className="ml-1 text-[10px] text-muted uppercase">{s.code}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.played}</td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.won}</td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.drawn}</td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.lost}</td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                  <td className="px-2 py-2.5 text-center font-bold">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[10px] text-muted border-t border-border">Top 2 advance · Highlighted in blue</p>
        </div>
      )}

      {/* Bet sheet */}
      {betTarget && (() => {
        const doubleUpsUsed = allMatches.filter(m => m.my_bet?.double_up === 1 && m.id !== betTarget.id).length;
        return (
          <BetSheet
            match={betTarget}
            groupId={bettingGroupId !== "none" ? bettingGroupId : groups[0]?.id}
            doubleUpsUsed={doubleUpsUsed}
            onClose={() => setBetTarget(null)}
            onSaved={() => {
              setBetTarget(null);
              loadMatches(bettingGroupId).then(setAllMatches).catch(() => {});
            }}
          />
        );
      })()}
    </div>
  );
}

const CONFIDENCE_OPTIONS = [
  { value: null,        label: "None",     emoji: "—",  pts: { correct: 0, wrong: 0 } },
  { value: "cautious",  label: "Cautious", emoji: "😬", pts: { correct: 2, wrong: -2 } },
  { value: "confident", label: "Confident",emoji: "👍", pts: { correct: 5, wrong: -5 } },
  { value: "reckless",  label: "Reckless", emoji: "🔥", pts: { correct: 10, wrong: -10 } },
];

function calcPreview(confidence: string | null, doubleUp: boolean) {
  const c = CONFIDENCE_OPTIONS.find(o => o.value === confidence)!;
  let correct = 10 + c.pts.correct;
  let wrong = c.pts.wrong;
  if (doubleUp && correct > 0) correct *= 2;
  if (doubleUp && wrong < 0) wrong *= 2;
  return { correctMin: correct, wrong };
}

function BetSheet({
  match, groupId, doubleUpsUsed, onClose, onSaved,
}: {
  match: Match;
  groupId: string | undefined;
  doubleUpsUsed: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [home, setHome] = useState(match.my_bet?.home_score_pred ?? 0);
  const [away, setAway] = useState(match.my_bet?.away_score_pred ?? 0);
  const [confidence, setConfidence] = useState<string | null>(match.my_bet?.confidence ?? null);
  const [doubleUp, setDoubleUp] = useState(match.my_bet?.double_up === 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const minutesLeft = Math.floor((match.match_date * 1000 - Date.now()) / 60000);
  const locked = minutesLeft <= 5 || match.status !== "scheduled";

  // How many double ups are still available (editing: if already set, it's still "used" by this bet)
  const alreadyDoubleUp = match.my_bet?.double_up === 1;
  const doubleUpsRemaining = 2 - doubleUpsUsed + (alreadyDoubleUp ? 1 : 0);
  const canDoubleUp = doubleUp || doubleUpsRemaining > 0;

  const preview = calcPreview(confidence, doubleUp);

  async function save() {
    if (!groupId) { setError("Select a betting group first"); return; }
    setSaving(true); setError("");
    try {
      await apiFetch("/api/bets", {
        method: "POST",
        body: JSON.stringify({ match_id: match.id, group_id: groupId, home_score_pred: home, away_score_pred: away, confidence, double_up: doubleUp }),
      });
      if (navigator.vibrate) navigator.vibrate(50);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-1 h-1 w-12 rounded-full bg-border mx-auto" />
        <div className="mb-4 mt-3 text-center">
          <p className="text-xs text-muted uppercase tracking-widest">
            {match.group_name ? `Group ${match.group_name}` : match.stage}
          </p>
          <h3 className="mt-1 text-lg font-bold">{match.home_team} vs {match.away_team}</h3>
          <p className="mt-1 text-xs text-muted">
            {new Date(match.match_date * 1000).toLocaleString("en-US", {
              weekday: "short", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit", timeZoneName: "short",
            })}
          </p>
          {match.stadium && <p className="text-[10px] text-muted">{match.stadium}{match.venue_city ? `, ${match.venue_city}` : ""}</p>}
          {!locked && minutesLeft < 60 && <p className="mt-1 text-xs text-warning">⚡ Locks in {minutesLeft}m</p>}
          {locked && <p className="mt-1 text-xs text-danger">🔒 Betting closed</p>}
        </div>

        {/* Score inputs */}
        <div className="mb-6 flex items-center justify-center gap-6">
          <ScoreInput label={match.home_team} value={home} onChange={setHome} disabled={locked} />
          <span className="text-2xl font-bold text-muted">-</span>
          <ScoreInput label={match.away_team} value={away} onChange={setAway} disabled={locked} />
        </div>

        {/* Confidence selector */}
        <div className="mb-4">
          <p className="mb-2 text-xs text-muted font-medium uppercase tracking-wide">Confidence</p>
          <div className="grid grid-cols-4 gap-2">
            {CONFIDENCE_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                disabled={locked}
                onClick={() => setConfidence(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition ${
                  confidence === opt.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface-hover text-muted"
                } disabled:opacity-40`}
              >
                <span className="text-lg leading-none">{opt.emoji}</span>
                <span className="font-medium">{opt.label}</span>
                {opt.value && (
                  <span className="text-[10px] opacity-70">
                    {opt.pts.correct > 0 ? `+${opt.pts.correct}` : opt.pts.correct}/{opt.pts.wrong}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Double Up toggle */}
        <div className="mb-4">
          <button
            disabled={locked || (!canDoubleUp)}
            onClick={() => setDoubleUp(v => !v)}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition ${
              doubleUp ? "border-accent bg-accent/10" : "border-border bg-surface-hover"
            } disabled:opacity-40`}
          >
            <div className="text-left">
              <p className={`font-semibold text-sm ${doubleUp ? "text-accent" : "text-foreground"}`}>
                🎲 Double Up
              </p>
              <p className="text-[10px] text-muted">×2 points if total is positive</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium ${doubleUp ? "text-accent" : "text-muted"}`}>
                {doubleUpsRemaining} remaining
              </p>
            </div>
          </button>
        </div>

        {/* Scoring preview */}
        <div className="mb-5 flex gap-2 text-xs">
          <div className="flex-1 rounded-xl bg-success/10 border border-success/20 p-3 text-center">
            <p className="text-muted mb-0.5">If correct</p>
            <p className="font-bold text-success text-base">+{preview.correctMin} pts</p>
            <p className="text-[10px] text-muted">+{doubleUp ? preview.correctMin + 10 : preview.correctMin + 5} if exact</p>
          </div>
          <div className="flex-1 rounded-xl bg-danger/10 border border-danger/20 p-3 text-center">
            <p className="text-muted mb-0.5">If wrong</p>
            <p className={`font-bold text-base ${preview.wrong < 0 ? "text-danger" : "text-muted"}`}>
              {preview.wrong < 0 ? preview.wrong : "0"} pts
            </p>
            <p className="text-[10px] text-muted">{preview.wrong < 0 ? "confidence penalty" : "no penalty"}</p>
          </div>
        </div>

        {error && <p className="mb-3 text-center text-sm text-danger">{error}</p>}
        <button
          onClick={save}
          disabled={saving || locked}
          className="w-full rounded-xl bg-accent py-4 font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
        >
          {saving ? "Saving…" : locked ? "Locked" : "Save prediction"}
        </button>
      </div>
    </>
  );
}

function ScoreInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted max-w-[80px] truncate text-center">{label}</p>
      <button onClick={() => onChange(Math.min(20, value + 1))} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-lg disabled:opacity-30 transition active:scale-90">+</button>
      <span className="text-4xl font-bold w-12 text-center">{value}</span>
      <button onClick={() => onChange(Math.max(0, value - 1))} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-lg disabled:opacity-30 transition active:scale-90">−</button>
    </div>
  );
}
