"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

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
  const [specialTarget, setSpecialTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tournamentStarted = Date.now() >= WC_START;
  const daysLeft = Math.max(0, Math.ceil((WC_START - Date.now()) / 86400000));

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

      {/* Special bets — show first, priority */}
      {groups.length > 0 && (
        <div className="mb-6 rounded-2xl border bg-surface overflow-hidden" style={{ borderColor: tournamentStarted ? undefined : "rgba(var(--color-accent),0.4)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h2 className="font-semibold text-sm">⭐ Special Bets</h2>
              <p className="text-[10px] text-muted mt-0.5">
                {tournamentStarted
                  ? "Tournament started — locked"
                  : `${daysLeft}d left · lock in before June 11`}
              </p>
            </div>
            {!tournamentStarted && (
              <span className="text-xs font-semibold text-accent">
                {specialBets.length}/4 placed
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {SPECIAL_BET_TYPES.map(spec => {
              const existing = specialBets.find(b => b.bet_type === spec.type);
              return (
                <div key={spec.type} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{spec.label}</p>
                    {existing ? (
                      <p className="text-xs text-accent font-semibold truncate">{existing.bet_value}</p>
                    ) : (
                      <p className="text-xs text-muted">{spec.description}</p>
                    )}
                  </div>
                  <div className="ml-3 flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-accent">+{spec.points}pts</span>
                    {!tournamentStarted ? (
                      <button
                        onClick={() => setSpecialTarget(spec.type)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          existing
                            ? "border border-border text-muted active:text-accent"
                            : "bg-accent text-[#0f0f23] active:opacity-80"
                        }`}
                      >
                        {existing ? "Edit" : "Pick"}
                      </button>
                    ) : existing ? (
                      <span className="text-success text-sm">✓</span>
                    ) : (
                      <span className="text-muted text-sm">🔒</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Next bet CTA */}
      {featured ? (
        <div className="mb-6 rounded-2xl border border-accent/40 bg-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
            {nextUnbet ? "⚡ Next bet to place" : "🗓 Next match"}
          </p>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex-1 text-right">
              <p className="font-bold">{featured.home_team}</p>
              <p className="text-xs text-muted uppercase">{featured.home_team_code}</p>
            </div>
            <span className="mx-2 text-sm font-bold text-muted">vs</span>
            <div className="flex-1 text-left">
              <p className="font-bold">{featured.away_team}</p>
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
                  <p className="text-sm font-semibold truncate">{m.home_team} {m.home_score} – {m.away_score} {m.away_team}</p>
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

      {/* Special bet sheet */}
      {specialTarget && (
        <SpecialBetSheet
          betType={specialTarget}
          groupId={selectedGroup}
          existing={specialBets.find(b => b.bet_type === specialTarget)?.bet_value}
          onClose={() => setSpecialTarget(null)}
          onSaved={(type, value) => {
            setSpecialBets(prev => [...prev.filter(b => b.bet_type !== type), { bet_type: type, bet_value: value, points_earned: null }]);
            setSpecialTarget(null);
          }}
        />
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

const WC_TEAMS = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Cameroon",
  "Canada", "Chile", "Colombia", "Costa Rica", "Croatia", "Denmark", "Ecuador",
  "Egypt", "England", "France", "Germany", "Ghana", "Honduras", "Iran",
  "Ireland", "Italy", "Ivory Coast", "Japan", "Mexico", "Morocco",
  "Netherlands", "New Zealand", "Nigeria", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Saudi Arabia", "Scotland", "Senegal", "Serbia",
  "South Africa", "South Korea", "Spain", "Sweden", "Switzerland", "Turkey",
  "Uruguay", "USA", "Venezuela", "Wales",
];

function SpecialBetSheet({ betType, groupId, existing, onClose, onSaved }: {
  betType: string; groupId: string; existing?: string;
  onClose: () => void; onSaved: (type: string, value: string) => void;
}) {
  const spec = SPECIAL_BET_TYPES.find(s => s.type === betType)!;
  const isScorer = betType === "top_scorer";
  const [selected, setSelected] = useState(existing ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!selected.trim()) return;
    setSaving(true); setError("");
    try {
      await apiFetch("/api/special-bets", {
        method: "POST",
        body: JSON.stringify({ group_id: groupId, bet_type: betType, bet_value: selected.trim() }),
      });
      if (navigator.vibrate) navigator.vibrate(50);
      onSaved(betType, selected.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-surface p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="mb-1 h-1 w-12 rounded-full bg-border mx-auto" />
        <div className="mb-4 mt-3">
          <h3 className="text-lg font-bold">{spec.label}</h3>
          <p className="text-xs text-muted mt-0.5">{spec.description} · <span className="text-accent font-semibold">+{spec.points}pts</span></p>
        </div>

        {isScorer ? (
          <input
            type="text"
            value={selected}
            onChange={e => setSelected(e.target.value)}
            placeholder="Player name…"
            className="w-full mb-4 rounded-xl border border-border bg-surface-hover px-4 py-3 text-sm outline-none focus:border-accent"
          />
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {WC_TEAMS.map(team => (
              <button
                key={team}
                onClick={() => setSelected(team)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition text-left ${
                  selected === team
                    ? "bg-accent text-[#0f0f23]"
                    : "bg-surface-hover border border-border text-foreground active:border-accent"
                }`}
              >
                {team}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mb-3 text-center text-sm text-danger">{error}</p>}
        <button
          onClick={save}
          disabled={saving || !selected.trim()}
          className="w-full rounded-xl bg-accent py-4 font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
        >
          {saving ? "Saving…" : `Confirm: ${selected || "—"}`}
        </button>
      </div>
    </>
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
  let previewWrong = c.pts.wrong;
  if (doubleUp && previewCorrect > 0) previewCorrect *= 2;
  if (doubleUp && previewWrong < 0) previewWrong *= 2;

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
          <h3 className="text-lg font-bold">{match.home_team} vs {match.away_team}</h3>
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
          <p className="mb-2 text-xs text-muted font-medium uppercase tracking-wide">Confidence</p>
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
              <p className="text-[10px] text-muted">×2 points if total is positive</p>
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
