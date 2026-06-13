"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import MatchCard from "@/components/match-card";
import { HelpDialog, useHelpDialog } from "@/components/help-dialog";
import { Flag } from "@/components/flag";
import { AdminTestMatch } from "@/components/admin-test-match";
import { useRouter } from "next/navigation";

const ADMIN_EMAIL = "jerome.ladeveze@gmail.com";


const WC_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

type Match = {
  id: string;
  home_team: string; away_team: string;
  home_team_code: string; away_team_code: string;
  match_date: number;
  home_score: number | null; away_score: number | null;
  final_home_score: number | null; final_away_score: number | null;
  score_duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" | null;
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
  const { open: helpOpen, close: closeHelp, openHelp } = useHelpDialog();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [view, setView] = useState<"coming" | "past" | "groups">("coming");
  const [onlyUnbet, setOnlyUnbet] = useState(false);
  const [selectedWcGroup, setSelectedWcGroup] = useState("A");
  const [bettingGroupId, setBettingGroupId] = useState<string>("none");
  const [groups, setGroups] = useState<Group[]>([]);
  const [betTarget, setBetTarget] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = document.getElementById("scroll-main");
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const loadMatches = useCallback((groupId: string) => {
    const path = groupId !== "none" ? `/api/matches?group_id=${groupId}` : "/api/matches";
    return apiFetch<Match[]>(path);
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch<Group[]>("/api/groups"),
      apiFetch<{ email: string }>("/api/auth/me").then(r => r.email).catch(() => null),
    ])
      .then(async ([grps, email]) => {
        setGroups(grps);
        setUserEmail(email);
        const gid = grps[0]?.id ?? "none";
        if (grps.length > 0) setBettingGroupId(gid);
        const matches = await loadMatches(gid);
        setAllMatches(matches);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router, loadMatches]);

  // Auto-refresh every 30s when there are live or very-recent matches
  useEffect(() => {
    const hasLive = allMatches.some(m => m.status === "live");
    if (!hasLive) return;
    const t = setInterval(() => {
      loadMatches(bettingGroupId).then(setAllMatches).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, [allMatches, bettingGroupId, loadMatches]);

  useEffect(() => {
    if (loading) return;
    loadMatches(bettingGroupId).then(setAllMatches).catch(() => {});
  }, [bettingGroupId, loadMatches, loading]);

  // Deep-link from the home countdown: /fixtures?bet=<matchId> scrolls the
  // matching card into view and briefly highlights it so the user can bet.
  // The default "coming" view already renders scheduled matches, so no view
  // switch is needed. A ref guards against re-scrolling on the 30s poll.
  const scrolledToBetRef = useRef(false);
  useEffect(() => {
    if (loading || scrolledToBetRef.current || allMatches.length === 0) return;
    const betId = new URLSearchParams(window.location.search).get("bet");
    if (!betId) return;
    scrolledToBetRef.current = true;
    requestAnimationFrame(() => {
      const el = document.getElementById(`match-${betId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-accent");
      setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 2200);
    });
    window.history.replaceState(null, "", "/fixtures");
  }, [loading, allMatches]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-10 rounded-xl bg-surface animate-pulse" />
        {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-surface animate-pulse" />)}
      </div>
    );
  }

  const GROUP_STAGE = "Group Stage";
  const KNOCKOUT_ROUND_ORDER = ["Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "3rd Place", "Final"];

  const comingMatches = [...allMatches]
    .filter(m => m.status !== "finished")
    .filter(m => !onlyUnbet || !m.my_bet)
    .sort((a, b) => a.match_date - b.match_date);

  const unbetCount = allMatches.filter(m => m.status === "scheduled" && !m.my_bet).length;

  const pastMatches = [...allMatches]
    .filter(m => m.status === "finished")
    .sort((a, b) => b.match_date - a.match_date);

  function groupByDay(matches: Match[]) {
    return matches.reduce((acc, m) => {
      const key = new Date(m.match_date * 1000).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      });
      (acc[key] ??= []).push(m);
      return acc;
    }, {} as Record<string, Match[]>);
  }

  // Split coming matches into group stage (by day) and knockout rounds
  const comingGroupStage = comingMatches.filter(m => m.stage === GROUP_STAGE || m.group_name !== null);
  const comingKnockout = comingMatches.filter(m => m.stage !== GROUP_STAGE && m.group_name === null);
  const knockoutByRound = KNOCKOUT_ROUND_ORDER.reduce((acc, round) => {
    const ms = comingKnockout.filter(m => m.stage === round);
    if (ms.length > 0) acc[round] = ms;
    return acc;
  }, {} as Record<string, Match[]>);
  // Any rounds not in our ordered list (future API additions)
  for (const m of comingKnockout) {
    if (!KNOCKOUT_ROUND_ORDER.includes(m.stage) && !knockoutByRound[m.stage]) {
      knockoutByRound[m.stage] = comingKnockout.filter(x => x.stage === m.stage);
    }
  }

  const comingByDay = Object.entries(groupByDay(comingGroupStage));
  const pastByDay = Object.entries(groupByDay(pastMatches));
  const groupMatches = allMatches.filter(m => m.group_name === `GROUP_${selectedWcGroup}`).sort((a, b) => a.match_date - b.match_date);
  const standings = computeStandings(groupMatches);

  const groupBettingId = bettingGroupId !== "none" ? bettingGroupId : undefined;

  return (
    <div className="mx-auto max-w-lg lg:max-w-none px-4 pt-4 pb-4 lg:px-8 lg:pt-6">
      {/* Admin test match panel */}
      {userEmail === ADMIN_EMAIL && (
        <AdminTestMatch onMatchChange={() => loadMatches(bettingGroupId).then(setAllMatches).catch(() => {})} />
      )}

      {/* Top toolbar — stacks on mobile, single row on desktop */}
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        {groups.length > 1 && (
          <div className="flex rounded-xl bg-surface border border-border p-0.5 gap-0.5 lg:max-w-sm lg:flex-1">
            {groups.map(g => (
              <button key={g.id} onClick={() => setBettingGroupId(g.id)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition truncate ${bettingGroupId === g.id ? "bg-accent text-[#0f0f23]" : "text-muted"}`}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 lg:flex-1 lg:max-w-md">
          <div className="flex flex-1 rounded-xl bg-surface border border-border p-0.5">
            {(["coming", "past", "groups"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${view === v ? "bg-accent text-[#0f0f23]" : "text-muted"}`}
              >
                {v === "coming" ? "Coming" : v === "past" ? "Past" : "Groups"}
              </button>
            ))}
          </div>
          <button
            onClick={openHelp}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-sm font-bold text-muted shrink-0 transition active:border-accent active:text-accent"
            title="How to play"
          >
            ?
          </button>
        </div>
      </div>

      {/* COMING VIEW */}
      {view === "coming" && (
        <div className="space-y-6 lg:space-y-8">
          <div className="flex gap-1.5">
            <button
              onClick={() => setOnlyUnbet(false)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${!onlyUnbet ? "bg-accent text-[#0f0f23]" : "bg-surface border border-border text-muted"}`}
            >
              All
            </button>
            <button
              onClick={() => setOnlyUnbet(true)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${onlyUnbet ? "bg-accent text-[#0f0f23]" : "bg-surface border border-border text-muted"}`}
            >
              To bet {unbetCount > 0 && <span className={`ml-1 ${onlyUnbet ? "opacity-70" : "text-accent"}`}>{unbetCount}</span>}
            </button>
          </div>
          {comingByDay.length === 0 && Object.keys(knockoutByRound).length === 0 && (
            <p className="py-12 text-center text-sm text-muted">
              {onlyUnbet ? "All caught up — you've bet on every upcoming match 🎯" : "No upcoming matches"}
            </p>
          )}
          {comingByDay.map(([day, dayMatches]) => (
            <section key={day}>
              <div className="mb-2 px-1 lg:mb-4 lg:flex lg:items-center lg:gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted lg:text-sm">{day}</p>
                <div className="hidden lg:block flex-1 h-px bg-border" />
                <p className="hidden lg:block text-xs text-muted">{(dayMatches as Match[]).length} match{(dayMatches as Match[]).length === 1 ? "" : "es"}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {(dayMatches as Match[]).map(match => (
                  <MatchCard key={match.id} match={match} groupId={groupBettingId} onBet={() => setBetTarget(match)}
                    onSaved={() => loadMatches(bettingGroupId).then(setAllMatches).catch(() => {})} />
                ))}
              </div>
            </section>
          ))}
          {/* Knockout rounds — separate section per round */}
          {Object.entries(knockoutByRound).map(([round, roundMatches]) => (
            <section key={round}>
              <div className="mb-2 px-1 lg:mb-4 lg:flex lg:items-center lg:gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/10 border border-accent/30 rounded px-2 py-0.5">Knockout</span>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted lg:text-sm">{round}</p>
                </div>
                <div className="hidden lg:block flex-1 h-px bg-border" />
                <p className="hidden lg:block text-xs text-muted">{roundMatches.length} match{roundMatches.length === 1 ? "" : "es"}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {roundMatches.map(match => (
                  <MatchCard key={match.id} match={match} groupId={groupBettingId} onBet={() => setBetTarget(match)}
                    onSaved={() => loadMatches(bettingGroupId).then(setAllMatches).catch(() => {})} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* PAST VIEW — newest first */}
      {view === "past" && (
        <div className="space-y-6 lg:space-y-8">
          {pastByDay.length === 0 && (
            <p className="py-12 text-center text-sm text-muted">No finished matches yet</p>
          )}
          {pastByDay.map(([day, dayMatches]) => (
            <section key={day}>
              <div className="mb-2 px-1 lg:mb-4 lg:flex lg:items-center lg:gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted lg:text-sm">{day}</p>
                <div className="hidden lg:block flex-1 h-px bg-border" />
                <p className="hidden lg:block text-xs text-muted">{(dayMatches as Match[]).length} match{(dayMatches as Match[]).length === 1 ? "" : "es"}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {(dayMatches as Match[]).map(match => (
                  <MatchCard key={match.id} match={match} groupId={groupBettingId} onBet={() => setBetTarget(match)}
                    onSaved={() => loadMatches(bettingGroupId).then(setAllMatches).catch(() => {})} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* GROUPS VIEW — WC group tabs + matches + standings */}
      {view === "groups" && (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {WC_GROUPS.map(g => (
              <button key={g} onClick={() => setSelectedWcGroup(g)}
                className={`shrink-0 h-9 w-9 rounded-xl text-sm font-bold transition ${selectedWcGroup === g ? "bg-accent text-[#0f0f23]" : "bg-surface border border-border text-muted"}`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupMatches.map(match => (
                  <MatchCard key={match.id} match={match} groupId={groupBettingId} onBet={() => setBetTarget(match)}
                    onSaved={() => loadMatches(bettingGroupId).then(setAllMatches).catch(() => {})} />
                ))}
                {groupMatches.length === 0 && (
                  <div className="py-12 text-center text-muted text-sm col-span-full">No matches in Group {selectedWcGroup}</div>
                )}
              </div>
            </div>

            {standings.length > 0 && (
              <div className="lg:col-span-1">
                <div className="rounded-2xl border border-border bg-surface overflow-hidden sticky top-4">
                  <div className="px-4 py-3 border-b border-border">
                    <h2 className="font-semibold text-sm">Group {selectedWcGroup} Standings</h2>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted border-b border-border">
                        <th className="px-3 py-2 text-left w-6">#</th>
                        <th className="px-3 py-2 text-left">Team</th>
                        <th className="px-2 py-2 text-center font-bold">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => (
                        <tr key={s.code}
                          className={`border-b border-border last:border-0 cursor-pointer active:bg-surface-hover transition ${i < 2 ? "bg-accent/5" : ""}`}
                          onClick={() => router.push(`/teams/${s.code}`)}
                        >
                          <td className="px-3 py-2.5"><span className={`font-bold ${i < 2 ? "text-accent" : "text-muted"}`}>{i + 1}</span></td>
                          <td className="px-3 py-2.5"><span className="mr-1"><Flag code={s.code} /></span><span className="font-semibold text-xs">{s.team}</span></td>
                          <td className="px-2 py-2.5 text-center font-bold">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-4 py-2 text-[10px] text-muted border-t border-border">Top 2 advance</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => document.getElementById("scroll-main")?.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-lg text-lg text-muted transition active:scale-90 active:text-accent"
          aria-label="Scroll to top"
        >
          ↑
        </button>
      )}

      {/* Help dialog */}
      {helpOpen && <HelpDialog onClose={closeHelp} />}

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
  const wrong = c.pts.wrong;
  if (doubleUp && correct > 0) correct *= 2;
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
  const [minutesLeft, setMinutesLeft] = useState(() => Math.floor((match.match_date * 1000 - Date.now()) / 60000));

  useEffect(() => {
    const timer = setInterval(() => {
      setMinutesLeft(Math.floor((match.match_date * 1000 - Date.now()) / 60000));
    }, 10000);
    return () => clearInterval(timer);
  }, [match.match_date]);

  const locked = minutesLeft <= 0 || match.status !== "scheduled";

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
      <div data-pull-ignore className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div data-pull-ignore className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto
                      lg:inset-auto lg:top-1/2 lg:left-1/2 lg:right-auto lg:bottom-auto lg:-translate-x-1/2 lg:-translate-y-1/2
                      lg:w-[28rem] lg:max-w-[90vw] lg:rounded-3xl lg:border lg:border-border">
        <div className="mb-1 h-1 w-12 rounded-full bg-border mx-auto lg:hidden" />
        <div className="mb-4 mt-3 text-center">
          <p className="text-xs text-muted uppercase tracking-widest">
            {match.group_name ? `Group ${match.group_name}` : match.stage}
          </p>
          <h3 className="mt-1 text-lg font-bold"><Flag code={match.home_team_code} /> {match.home_team} vs {match.away_team} <Flag code={match.away_team_code} /></h3>
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

        <div className="mb-4 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-center text-[11px] leading-relaxed text-muted">
          Score is taken at the end of <strong className="text-foreground">regular time only</strong>.
          <strong className="text-foreground"> Extra time and penalties do not count</strong>.
        </div>

        {/* Confidence selector */}
        <div className="mb-4">
          <p className="mb-2 text-xs text-muted font-medium uppercase tracking-wide">Confidence <span className="normal-case font-normal opacity-70">— optional</span></p>
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
              <p className="text-[10px] text-muted">Optional · ×2 points if total is positive</p>
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
          {saving ? "Saving…" : locked ? "Locked" : "Save bet"}
        </button>
      </div>
    </>
  );
}

function ScoreInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted max-w-[80px] truncate text-center">{label}</p>
      <button
        type="button"
        onClick={() => onChange(Math.min(20, value + 1))}
        disabled={disabled}
        className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-accent/50 bg-surface-hover text-4xl font-black tabular-nums transition active:scale-95 active:border-accent active:bg-accent/10 disabled:opacity-40 select-none"
      >
        {value}
      </button>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value === 0}
        className={`flex h-7 w-16 items-center justify-center rounded-lg border font-bold text-base transition active:scale-95 ${
          value > 0 && !disabled
            ? "border-border bg-surface-hover text-foreground active:border-accent active:text-accent"
            : "border-transparent opacity-0 pointer-events-none"
        }`}
      >
        −
      </button>
    </div>
  );
}
