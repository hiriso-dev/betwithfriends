"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Flag } from "@/components/flag";
import { BinocularsIcon } from "@/components/icons";
import { getMatchScoreDisplay, PENDING_SCORE } from "@/lib/match-score";

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

type Group = { id: string; name: string; my_points: number; my_rank: number; member_count: number };
type SpecialBet = { bet_type: string; bet_value: string; points_earned: number | null };

const WC_START = new Date("2026-06-11T21:00:00Z").getTime();

const CONFIDENCE_EMOJI: Record<string, string> = {
  cautious: "😬", confident: "👍", reckless: "🔥",
};

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

  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(() => Date.now());
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

  // Live score ticker — poll every 60s when any match is live
  useEffect(() => {
    const hasLive = matches.some(m => m.status === "live");
    if (!hasLive || !selectedGroup) return;
    const t = setInterval(() => {
      apiFetch<Match[]>(`/api/matches?group_id=${selectedGroup}`).then(setMatches).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, [matches, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup || loading) return;
    apiFetch<Match[]>(`/api/matches?group_id=${selectedGroup}`).then(setMatches).catch(() => {});
    apiFetch<SpecialBet[]>(`/api/special-bets?group_id=${selectedGroup}`).then(setSpecialBets).catch(() => {});
  }, [selectedGroup, loading]);

  const now = tick / 1000;
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

  // Matches currently in progress — kept fresh by the 30s live poller above.
  const liveMatches = matches
    .filter(m => m.status === "live")
    .sort((a, b) => a.match_date - b.match_date);

  // Countdown: next bet that closes (soonest lock = match_date - 5min, or WC_START for specials)
  const BET_LOCK_MS = 0;
  const specialsDeadline = !tournamentStarted && specialBets.length < SPECIAL_BET_TYPES.length ? WC_START : Infinity;
  const nextMatchLock = nextUnbet ? nextUnbet.match_date * 1000 - BET_LOCK_MS : Infinity;
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
    <div className="mx-auto max-w-lg lg:max-w-7xl px-4 pt-4 pb-4 lg:px-8 lg:pt-6">
      <div className="mb-4 lg:mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold">World Cup 2026</h1>
          <p className="hidden lg:block text-sm text-muted mt-1">Dashboard · {tournamentStarted ? "Tournament live" : `${daysLeft} days until kick-off`}</p>
        </div>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">🇺🇸🇨🇦🇲🇽</span>
      </div>

      {/* Group selector (if multiple groups) */}
      {groups.length > 1 && (
        <div className="mb-4 lg:mb-6 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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

      {/* Dashboard grid: stacks on mobile, 3-column on desktop */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* LEFT / MAIN COLUMN — primary actions */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Live now — matches in progress; tap a row to see everyone's bets */}
          {liveMatches.length > 0 && (
            <div className="rounded-2xl border border-success/40 bg-surface overflow-hidden shadow-[0_0_20px_rgba(34,197,94,0.08)]">
              <div className="px-4 py-3 lg:px-6 lg:py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm lg:text-base flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  Live now
                </h2>
                <span className="text-[10px] uppercase tracking-widest font-semibold text-success">
                  {liveMatches.length} playing
                </span>
              </div>
              {liveMatches.map(m => {
                const scoreDisplay = getMatchScoreDisplay(m);
                const primaryScore = scoreDisplay.primary ?? PENDING_SCORE;
                const bet = m.my_bet;
                return (
                  <button
                    key={m.id}
                    onClick={() => router.push(`/matches/${m.id}/bets${selectedGroup ? `?group_id=${selectedGroup}` : ""}`)}
                    title="See everyone's bets"
                    className="w-full flex flex-col gap-2 px-4 py-3 lg:px-6 lg:py-4 border-b border-border last:border-0 text-left transition active:bg-surface-hover hover:bg-surface-hover"
                  >
                    <div className="flex w-full items-center gap-3">
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-bold leading-tight truncate">{m.home_team} <Flag code={m.home_team_code} /></p>
                        <p className="text-[10px] text-muted uppercase tracking-wider">{m.home_team_code}</p>
                      </div>
                      <div className="flex flex-col items-center min-w-[64px]">
                        <span className="text-xl font-black tabular-nums leading-none">{primaryScore}</span>
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-success whitespace-nowrap">
                          ● Live · {new Date(m.match_date * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-bold leading-tight truncate"><Flag code={m.away_team_code} /> {m.away_team}</p>
                        <p className="text-[10px] text-muted uppercase tracking-wider">{m.away_team_code}</p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-accent">
                        <BinocularsIcon size={13} />
                        Bets
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted flex-wrap">
                      {bet ? (
                        <>
                          <span>Your bet:</span>
                          <span className="font-semibold text-foreground">{bet.home_score_pred} – {bet.away_score_pred}</span>
                          {bet.confidence && <span className="text-sm">{CONFIDENCE_EMOJI[bet.confidence]}</span>}
                          {bet.double_up === 1 && <span className="text-[10px] bg-accent/15 text-accent rounded px-1 font-bold">×2</span>}
                        </>
                      ) : (
                        <span>No prediction placed</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Countdown to next bet close */}
          {groups.length > 0 && nextDeadlineMs < Infinity && msUntilClose > 0 && (
            <button
              onClick={() => {
                if (isSpecialDeadline) { router.push("/special"); return; }
                const id = nextUnbet?.id ?? featured?.id;
                router.push(id ? `/fixtures?bet=${id}` : "/fixtures");
              }}
              className="w-full rounded-2xl border border-accent/40 bg-surface px-4 py-3 lg:px-6 lg:py-5 text-left transition active:bg-surface-hover hover:border-accent/60"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-0.5">
                    {isSpecialDeadline ? "⭐ Special bets close in" : "🔒 Not yet bet · locks in"}
                  </p>
                  <p className="font-black text-xl lg:text-3xl tabular-nums">{fmtCountdown(msUntilClose)}</p>
                </div>
                <div className="text-right">
                  {isSpecialDeadline ? (
                    <p className="text-sm font-semibold text-accent">Place specials →</p>
                  ) : featured ? (
                    <>
                      <p className="text-sm lg:text-base font-semibold">{featured.home_team} vs {featured.away_team}</p>
                      <p className="text-xs font-semibold text-accent">Click to bet →</p>
                    </>
                  ) : null}
                </div>
              </div>
            </button>
          )}

          {/* Next game — soonest upcoming kickoff with a live countdown.
              Hidden while a match is live (the "Live now" section takes over). */}
          {nextMatch && liveMatches.length === 0 && (
            <button
              onClick={() => router.push(`/fixtures?bet=${nextMatch.id}`)}
              className="w-full rounded-2xl border border-border bg-surface p-4 lg:p-6 text-left transition active:bg-surface-hover hover:border-accent/40"
            >
              <div className="mb-3 lg:mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">🗓 Next game</p>
                <p className="text-xs text-muted">
                  {new Date(nextMatch.match_date * 1000).toLocaleString("en-US", {
                    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="mb-3 lg:mb-4 flex items-center justify-between gap-2 lg:gap-6">
                <div className="flex-1 text-right">
                  <p className="font-bold lg:text-xl">{nextMatch.home_team} <Flag code={nextMatch.home_team_code} /></p>
                  <p className="text-xs text-muted uppercase">{nextMatch.home_team_code}</p>
                </div>
                <span className="mx-2 text-sm lg:text-base font-bold text-muted">vs</span>
                <div className="flex-1 text-left">
                  <p className="font-bold lg:text-xl"><Flag code={nextMatch.away_team_code} /> {nextMatch.away_team}</p>
                  <p className="text-xs text-muted uppercase">{nextMatch.away_team_code}</p>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-hover px-4 py-2.5 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-0.5">Kicks off in</p>
                <p className="font-black text-xl lg:text-2xl tabular-nums">{fmtCountdown(nextMatch.match_date * 1000 - tick)}</p>
              </div>
              <p className="mt-3 text-center text-xs text-muted">
                {nextMatch.my_bet ? (
                  <>✓ Your bet: <span className="font-semibold text-foreground">{nextMatch.my_bet.home_score_pred}–{nextMatch.my_bet.away_score_pred}</span></>
                ) : (
                  <span className="font-semibold text-accent">Place your bet →</span>
                )}
              </p>
            </button>
          )}

          {/* Recent results — shown in main column on desktop */}
          {recentFinished.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="px-4 py-3 lg:px-6 lg:py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm lg:text-base">Recent Results</h2>
                <button
                  onClick={() => router.push("/fixtures")}
                  className="hidden lg:block text-xs text-accent hover:underline"
                >
                  See all →
                </button>
              </div>
              {recentFinished.map(m => {
                const bet = m.my_bet;
                const scoreDisplay = getMatchScoreDisplay(m);
                const betResult = bet
                  ? bet.home_score_pred === m.home_score && bet.away_score_pred === m.away_score ? "exact"
                  : (bet.home_score_pred > bet.away_score_pred) === (m.home_score! > m.away_score!) || (bet.home_score_pred === bet.away_score_pred) === (m.home_score === m.away_score) ? "result"
                  : "wrong"
                  : null;
                const color = betResult === "exact" ? "text-success" : betResult === "result" ? "text-warning" : betResult === "wrong" ? "text-danger" : "text-muted";
                return (
                  <button
                    key={m.id}
                    onClick={() => router.push(`/matches/${m.id}/bets${selectedGroup ? `?group_id=${selectedGroup}` : ""}`)}
                    title="See everyone's bets"
                    className="w-full flex items-center gap-3 px-4 py-3 lg:px-6 lg:py-4 border-b border-border last:border-0 text-left transition active:bg-surface-hover hover:bg-surface-hover"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{m.home_team} <Flag code={m.home_team_code} /> {scoreDisplay.inline} <Flag code={m.away_team_code} /> {m.away_team}</p>
                      <p className="text-[10px] text-muted">
                        {new Date(m.match_date * 1000).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {m.group_name && <> · Group {m.group_name}</>}
                      </p>
                    </div>
                    {bet && (
                      <div className="text-right ml-2">
                        <p className={`text-sm font-bold ${color}`}>
                          {bet.points_earned !== null && bet.points_earned > 0 ? `+${bet.points_earned.toFixed(1)}pts` : "0pts"}
                        </p>
                        <p className="text-[10px] text-muted">{bet.home_score_pred}–{bet.away_score_pred}</p>
                      </div>
                    )}
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-accent">
                      <BinocularsIcon size={13} />
                      Bets
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT / SIDE COLUMN — secondary info */}
        <div className="space-y-4 lg:space-y-6 mt-4 lg:mt-0">
          {/* Special bets compact CTA */}
          {groups.length > 0 && !tournamentStarted && unplacedSpecials.length > 0 && (
            <button
              onClick={() => router.push("/special")}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 lg:px-5 lg:py-4 text-left transition active:bg-surface-hover hover:border-accent/40"
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
            <div className="rounded-2xl border border-border bg-surface px-4 py-3 lg:px-5 lg:py-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">⭐ Special Bets</p>
                <span className="text-success text-sm font-semibold">✓ All placed</span>
              </div>
            </div>
          )}

          {/* My Groups */}
          {groups.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="px-4 py-3 lg:px-5 lg:py-4 border-b border-border">
                <h2 className="font-semibold text-sm">My Groups</h2>
              </div>
              {groups.map(g => (
                <div
                  key={g.id}
                  className="flex items-center justify-between px-4 py-3 lg:px-5 lg:py-4 border-b border-border last:border-0 cursor-pointer active:bg-surface-hover hover:bg-surface-hover transition"
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
        </div>
      </div>
    </div>
  );
}
