"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Flag } from "@/components/flag";

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

type Group = { id: string; name: string; my_points: number; my_rank: number; member_count: number };
type SpecialBet = { bet_type: string; bet_value: string; points_earned: number | null };

const WC_START = new Date("2026-06-11T21:00:00Z").getTime();

const SPECIAL_BET_TYPES = [
  { type: "champion",    label: "🏆 World Champion", points: 50, description: "Who lifts the trophy?" },
  { type: "runner_up",   label: "🥈 Runner-up",       points: 20, description: "Who loses the final?" },
  { type: "third_place", label: "🥉 Third place",     points: 15, description: "Who finishes 3rd?" },
  { type: "top_scorer",  label: "⚽ Golden Boot",     points: 30, description: "Top goalscorer" },
];

export default function HomePage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [specialBets, setSpecialBets] = useState<SpecialBet[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [betTarget, setBetTarget] = useState<Match | null>(null);

  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const tournamentStarted = tick >= WC_START;
  const daysLeft = Math.max(0, Math.ceil((WC_START - tick) / 86400000));

  useEffect(() => {
    apiFetch<Group[]>("/api/groups")
      .then(async grps => {
        setGroups(grps);
        const gid = grps[0]?.id ?? "";
        setSelectedGroup(gid);
        const [matches, specials] = await Promise.all([
          gid ? apiFetch<Match[]>(`/api/matches?group_id=${gid}`) : apiFetch<Match[]>("/api/matches"),
          gid ? apiFetch<SpecialBet[]>(`/api/special-bets?group_id=${gid}`) : Promise.resolve<SpecialBet[]>([]),
        ]);
        setMatches(matches);
        setSpecialBets(specials);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!selectedGroup || loading) return;
    apiFetch<Match[]>(`/api/matches?group_id=${selectedGroup}`).then(setMatches).catch(() => {});
    apiFetch<SpecialBet[]>(`/api/special-bets?group_id=${selectedGroup}`).then(setSpecialBets).catch(() => {});
  }, [selectedGroup, loading]);

  const now = Date.now() / 1000;
  const upcoming = matches
    .filter(m => m.status === "scheduled" && m.match_date > now)
    .sort((a, b) => a.match_date - b.match_date);

  const nextUnbet = upcoming.find(m => !m.my_bet);
  const nextMatch = upcoming[0];
  const featured = nextUnbet ?? nextMatch;

  const recentFinished = matches
    .filter(m => m.status === "finished")
    .sort((a, b) => b.match_date - a.match_date)
    .slice(0, 3);

  // Countdown: next bet that closes (soonest lock = match_date - 5min, or WC_START for specials)
  const BET_LOCK_MS = 5 * 60 * 1000;
  const specialsDeadline = !tournamentStarted && specialBets.length < SPECIAL_BET_TYPES.length ? WC_START : Infinity;
  const nextMatchLock = upcoming.length > 0 ? upcoming[0].match_date * 1000 - BET_LOCK_MS : Infinity;
  const nextDeadlineMs = Math.min(specialsDeadline, nextMatchLock);
  const isSpecialDeadline = specialsDeadline <= nextMatchLock && specialsDeadline < Infinity;
  const msUntilClose = Math.max(0, nextDeadlineMs - tick);

  function fmtCountdown(ms: number): string {
    if (ms <= 0) return "Locked";
    const totalSeconds = Math.floor(ms / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  const unplacedSpecials = SPECIAL_BET_TYPES.filter(s => !specialBets.find(b => b.bet_type === s.type));

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 rounded-xl bg-surface animate-pulse w-40" />
        <div className="h-40 rounded-2xl bg-surface animate-pulse" />
        <div className="h-24 rounded-2xl bg-surface animate-pulse" />
      </div>
    );
  }

  // No groups — show onboarding
  if (!loading && groups.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 text-7xl">⚽</div>
        <h1 className="mb-2 text-2xl font-bold">Welcome to BetWithFriends!</h1>
        <p className="mb-2 text-sm text-muted max-w-xs">
          World Cup 2026 is almost here. Bet on every match with your friends and see who knows football best.
        </p>
        <p className="mb-8 text-sm text-muted max-w-xs">
          Start by creating a group — then invite your crew with a link.
        </p>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={() => router.push("/groups/new")}
            className="w-full rounded-2xl bg-accent py-4 font-bold text-[#0f0f23] text-base transition active:scale-95"
          >
            🏆 Create a group
          </button>
          <button
            onClick={() => router.push("/groups/join")}
            className="w-full rounded-2xl border border-border py-4 font-semibold text-foreground transition active:bg-surface-hover"
          >
            Join with invite code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">World Cup 2026</h1>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">🇺🇸🇨🇦🇲🇽</span>
      </div>

      {/* Group selector (if multiple groups) */}
      {groups.length > 1 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                selectedGroup === g.id ? "bg-accent text-[#0f0f23]" : "bg-surface border border-border text-muted"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Countdown to next bet close */}
      {groups.length > 0 && nextDeadlineMs < Infinity && msUntilClose > 0 && (
        <button
          onClick={() => isSpecialDeadline ? router.push("/special") : featured && setBetTarget(featured)}
          className="mb-4 w-full rounded-2xl border border-accent/40 bg-surface px-4 py-3 text-left transition active:bg-surface-hover"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-0.5">
                {isSpecialDeadline ? "⭐ Special bets close in" : "🔒 Next bet locks in"}
              </p>
              <p className="font-black text-xl tabular-nums">{fmtCountdown(msUntilClose)}</p>
            </div>
            <div className="text-right">
              {isSpecialDeadline ? (
                <p className="text-sm font-semibold text-accent">Place specials →</p>
              ) : featured ? (
                <>
                  <p className="text-sm font-semibold">{featured.home_team} vs {featured.away_team}</p>
                  <p className="text-xs text-muted">{featured.group_name ? `Group ${featured.group_name}` : featured.stage} · Bet now →</p>
                </>
              ) : null}
            </div>
          </div>
        </button>
      )}

      {/* Special bets compact CTA */}
      {groups.length > 0 && !tournamentStarted && unplacedSpecials.length > 0 && (
        <button
          onClick={() => router.push("/special")}
          className="mb-4 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left transition active:bg-surface-hover"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">⭐ Special Bets</p>
              <p className="text-xs text-muted mt-0.5">
                {unplacedSpecials.length} of {SPECIAL_BET_TYPES.length} not placed · locks June 11
              </p>
            </div>
            <span className="text-accent font-semibold text-sm">Place →</span>
          </div>
        </button>
      )}
      {groups.length > 0 && !tournamentStarted && unplacedSpecials.length === 0 && (
        <div className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">⭐ Special Bets</p>
            <span className="text-success text-sm font-semibold">✓ All placed</span>
          </div>
        </div>
      )}

      {/* Next bet CTA */}
      {featured ? (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            {nextUnbet ? "⚡ Next bet to place" : "🗓 Next match"}
          </p>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex-1 text-right">
              <p className="font-bold">{featured.home_team} <Flag code={featured.home_team_code} /></p>
              <p className="text-xs text-muted uppercase">{featured.home_team_code}</p>
            </div>
            <span className="mx-2 text-sm font-bold text-muted">vs</span>
            <div className="flex-1 text-left">
              <p className="font-bold"><Flag code={featured.away_team_code} /> {featured.away_team}</p>
              <p className="text-xs text-muted uppercase">{featured.away_team_code}</p>
            </div>
          </div>
          <p className="mb-1 text-center text-xs text-muted">
            {new Date(featured.match_date * 1000).toLocaleString("en-US", {
              weekday: "short", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit", timeZoneName: "short",
            })}
          </p>
          {featured.group_name && (
            <p className="mb-3 text-center text-[10px] text-muted">Group {featured.group_name}{featured.stadium ? ` · ${featured.stadium}` : ""}</p>
          )}

          {nextUnbet && featured.my_bet === undefined ? (
            <button
              onClick={() => setBetTarget(featured)}
              className="w-full rounded-xl bg-accent py-3 font-bold text-[#0f0f23] transition active:scale-95"
            >
              Place bet →
            </button>
          ) : featured.my_bet ? (
            <div className="text-center text-sm text-muted">
              ✓ Bet placed: <span className="font-semibold text-foreground">
                {featured.my_bet.home_score_pred} – {featured.my_bet.away_score_pred}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-8 text-center text-muted text-sm">
          No upcoming matches
        </div>
      )}

      {/* My Groups */}
      {groups.length > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">My Groups</h2>
          </div>
          {groups.map(g => (
            <div
              key={g.id}
              className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 cursor-pointer active:bg-surface-hover"
              onClick={() => router.push(`/groups/${g.id}`)}
            >
              <div>
                <p className="font-semibold text-sm">{g.name}</p>
                <p className="text-xs text-muted">{g.member_count} members</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-accent">{g.my_points.toFixed(1)}pts</p>
                <p className="text-xs text-muted">Rank #{g.my_rank}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent results */}
      {recentFinished.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Recent Results</h2>
          </div>
          {recentFinished.map(m => {
            const bet = m.my_bet;
            const betResult = bet
              ? bet.home_score_pred === m.home_score && bet.away_score_pred === m.away_score ? "exact"
              : (bet.home_score_pred > bet.away_score_pred) === (m.home_score! > m.away_score!) || (bet.home_score_pred === bet.away_score_pred) === (m.home_score === m.away_score) ? "result"
              : "wrong"
              : null;
            const color = betResult === "exact" ? "text-success" : betResult === "result" ? "text-warning" : betResult === "wrong" ? "text-danger" : "text-muted";
            return (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.home_team} <Flag code={m.home_team_code} /> {m.home_score} – {m.away_score} <Flag code={m.away_team_code} /> {m.away_team}</p>
                  <p className="text-[10px] text-muted">Group {m.group_name}</p>
                </div>
                {bet && (
                  <div className="text-right ml-2">
                    <p className={`text-sm font-bold ${color}`}>
                      {bet.points_earned !== null && bet.points_earned > 0 ? `+${bet.points_earned.toFixed(1)}pts` : "0pts"}
                    </p>
                    <p className="text-[10px] text-muted">{bet.home_score_pred}–{bet.away_score_pred}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Match bet sheet */}
      {betTarget && (() => {
        const doubleUpsUsed = matches.filter(m => m.my_bet?.double_up === 1 && m.id !== betTarget.id).length;
        return (
          <BetSheet
            match={betTarget}
            groupId={selectedGroup || groups[0]?.id}
            doubleUpsUsed={doubleUpsUsed}
            onClose={() => setBetTarget(null)}
            onSaved={() => {
              setBetTarget(null);
              apiFetch<Match[]>(`/api/matches?group_id=${selectedGroup}`).then(setMatches).catch(() => {});
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

function BetSheet({ match, groupId, doubleUpsUsed, onClose, onSaved }: {
  match: Match; groupId: string; doubleUpsUsed: number; onClose: () => void; onSaved: () => void;
}) {
  const [home, setHome] = useState(match.my_bet?.home_score_pred ?? 0);
  const [away, setAway] = useState(match.my_bet?.away_score_pred ?? 0);
  const [confidence, setConfidence] = useState<string | null>(match.my_bet?.confidence ?? null);
  const [doubleUp, setDoubleUp] = useState(match.my_bet?.double_up === 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const minutesLeft = Math.floor((match.match_date * 1000 - Date.now()) / 60000);
  const locked = minutesLeft <= 5 || match.status !== "scheduled";

  const alreadyDoubleUp = match.my_bet?.double_up === 1;
  const doubleUpsRemaining = 2 - doubleUpsUsed + (alreadyDoubleUp ? 1 : 0);

  const c = CONFIDENCE_OPTIONS.find(o => o.value === confidence)!;
  let previewCorrect = 10 + c.pts.correct;
  const previewWrong = c.pts.wrong;
  if (doubleUp && previewCorrect > 0) previewCorrect *= 2;

  async function save() {
    setSaving(true); setError("");
    try {
      await apiFetch("/api/bets", {
        method: "POST",
        body: JSON.stringify({ match_id: match.id, group_id: groupId, home_score_pred: home, away_score_pred: away, confidence, double_up: doubleUp }),
      });
      if (navigator.vibrate) navigator.vibrate(50);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-1 h-1 w-12 rounded-full bg-border mx-auto" />
        <div className="mb-4 mt-3 text-center">
          <h3 className="text-lg font-bold"><Flag code={match.home_team_code} /> {match.home_team} vs {match.away_team} <Flag code={match.away_team_code} /></h3>
          <p className="mt-1 text-xs text-muted">
            {new Date(match.match_date * 1000).toLocaleString("en-US", {
              weekday: "short", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit", timeZoneName: "short",
            })}
          </p>
          {!locked && minutesLeft < 60 && <p className="mt-1 text-xs text-warning">⚡ Locks in {minutesLeft}m</p>}
        </div>

        <div className="mb-6 flex items-center justify-center gap-6">
          <ScoreInput label={match.home_team} value={home} onChange={setHome} disabled={locked} />
          <span className="text-2xl font-bold text-muted">-</span>
          <ScoreInput label={match.away_team} value={away} onChange={setAway} disabled={locked} />
        </div>

        {/* Confidence */}
        <div className="mb-4">
          <p className="mb-2 text-xs text-muted font-medium uppercase tracking-wide">Confidence <span className="normal-case font-normal opacity-70">— optional</span></p>
          <div className="grid grid-cols-4 gap-2">
            {CONFIDENCE_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                disabled={locked}
                onClick={() => setConfidence(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition ${
                  confidence === opt.value ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-hover text-muted"
                } disabled:opacity-40`}
              >
                <span className="text-lg leading-none">{opt.emoji}</span>
                <span className="font-medium">{opt.label}</span>
                {opt.value && <span className="text-[10px] opacity-70">+{opt.pts.correct}/{opt.pts.wrong}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Double Up */}
        <div className="mb-4">
          <button
            disabled={locked || (!doubleUp && doubleUpsRemaining <= 0)}
            onClick={() => setDoubleUp(v => !v)}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition ${
              doubleUp ? "border-accent bg-accent/10" : "border-border bg-surface-hover"
            } disabled:opacity-40`}
          >
            <div className="text-left">
              <p className={`font-semibold text-sm ${doubleUp ? "text-accent" : "text-foreground"}`}>🎲 Double Up</p>
              <p className="text-[10px] text-muted">Optional · ×2 points if total is positive</p>
            </div>
            <p className={`text-xs font-medium ${doubleUp ? "text-accent" : "text-muted"}`}>{doubleUpsRemaining} remaining</p>
          </button>
        </div>

        {/* Preview */}
        <div className="mb-5 flex gap-2 text-xs">
          <div className="flex-1 rounded-xl bg-success/10 border border-success/20 p-3 text-center">
            <p className="text-muted mb-0.5">If correct</p>
            <p className="font-bold text-success text-base">+{previewCorrect} pts</p>
            <p className="text-[10px] text-muted">+{doubleUp ? previewCorrect + 10 : previewCorrect + 5} if exact</p>
          </div>
          <div className="flex-1 rounded-xl bg-danger/10 border border-danger/20 p-3 text-center">
            <p className="text-muted mb-0.5">If wrong</p>
            <p className={`font-bold text-base ${previewWrong < 0 ? "text-danger" : "text-muted"}`}>
              {previewWrong < 0 ? previewWrong : "0"} pts
            </p>
            <p className="text-[10px] text-muted">{previewWrong < 0 ? "confidence penalty" : "no penalty"}</p>
          </div>
        </div>

        {error && <p className="mb-3 text-center text-sm text-danger">{error}</p>}
        <button onClick={save} disabled={saving || locked} className="w-full rounded-xl bg-accent py-4 font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50">
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
