"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Flag } from "@/components/flag";
import { getMatchScoreDisplay, PENDING_SCORE } from "@/lib/match-score";

type MatchInfo = {
  id: string;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
  match_date: number;
  home_score: number | null;
  away_score: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
  score_duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" | null;
  status: "scheduled" | "live" | "finished" | "postponed";
  stage: string;
  group_name: string | null;
};

type BetRow = {
  user_id: string;
  pseudo: string;
  home_score_pred: number | null;
  away_score_pred: number | null;
  confidence: string | null;
  double_up: number | null;
  points_earned: number | null;
};

type Group = { id: string; name: string };

const CONFIDENCE_EMOJI: Record<string, string> = {
  cautious: "😬",
  confident: "👍",
  reckless: "🔥",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  cautious: "Cautious",
  confident: "Confident",
  reckless: "Reckless",
};

function betResultLabel(
  match: MatchInfo,
  bet: BetRow
): { label: string; color: string } | null {
  if (match.status !== "finished" || match.home_score === null || match.away_score === null) return null;
  if (bet.home_score_pred === null || bet.away_score_pred === null) return null;
  const hp = bet.home_score_pred;
  const ap = bet.away_score_pred;
  const hr = match.home_score;
  const ar = match.away_score;
  if (hp === hr && ap === ar) return { label: "⭐ Exact", color: "text-success" };
  const predResult = hp > ap ? "home" : hp < ap ? "away" : "draw";
  const actResult = hr > ar ? "home" : hr < ar ? "away" : "draw";
  if (predResult === actResult) return { label: "✓ Result", color: "text-warning" };
  return { label: "✗ Wrong", color: "text-danger" };
}

function MatchBetsFallback() {
  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 lg:max-w-2xl lg:px-8 lg:pt-6 space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
    </div>
  );
}

function MatchBetsContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get("group_id");

  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's groups once
  useEffect(() => {
    apiFetch<Group[]>("/api/groups")
      .then(grps => {
        setGroups(grps);
        const start = initialGroupId && grps.some(g => g.id === initialGroupId)
          ? initialGroupId
          : grps[0]?.id ?? null;
        if (start) {
          setLoading(true);
          setError(null);
        } else {
          setLoading(false);
        }
        setActiveGroupId(start);
      })
      .catch(() => router.push("/login"));
  }, [initialGroupId, router]);

  const loadBets = useCallback(async (groupId: string) => {
    try {
      const data = await apiFetch<{ match: MatchInfo; bets: BetRow[] }>(
        `/api/matches/${id}/bets?group_id=${groupId}`
      );
      setMatch(data.match);
      setBets(data.bets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bets");
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!activeGroupId) return;
    let cancelled = false;

    void apiFetch<{ match: MatchInfo; bets: BetRow[] }>(`/api/matches/${id}/bets?group_id=${activeGroupId}`)
      .then((data) => {
        if (cancelled) return;
        setMatch(data.match);
        setBets(data.bets);
        setError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setError(error instanceof Error ? error.message : "Failed to load bets");
        setBets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeGroupId, id]);

  function selectGroup(groupId: string) {
    if (groupId === activeGroupId) return;
    setLoading(true);
    setError(null);
    setActiveGroupId(groupId);
  }

  // Auto-refresh while the match is live
  useEffect(() => {
    if (!match || match.status !== "live" || !activeGroupId) return;
    const t = setInterval(() => loadBets(activeGroupId), 30_000);
    return () => clearInterval(t);
  }, [match, activeGroupId, loadBets]);

  const isFinished = match?.status === "finished";

  const sortedBets = (() => {
    const placed = bets.filter(b => b.home_score_pred !== null);
    const empty = bets.filter(b => b.home_score_pred === null);
    if (isFinished) {
      // Scored bets rank by points (desc). Bets still awaiting scoring
      // (points_earned === null) go last — never treated as 0, which would
      // otherwise float them above players who legitimately lost points.
      placed.sort((a, b) => {
        const aScored = a.points_earned !== null;
        const bScored = b.points_earned !== null;
        if (aScored !== bScored) return aScored ? -1 : 1;
        if (aScored && bScored) return b.points_earned! - a.points_earned!;
        return a.pseudo.localeCompare(b.pseudo);
      });
    } else {
      placed.sort((a, b) => a.pseudo.localeCompare(b.pseudo));
    }
    empty.sort((a, b) => a.pseudo.localeCompare(b.pseudo));
    return { placed, empty };
  })();

  if (!activeGroupId && groups.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted">
        <p>You need to be in a group to view bets.</p>
        <button onClick={() => router.push("/groups")} className="mt-3 rounded-xl bg-accent px-4 py-2 text-[#0f0f23] text-sm font-semibold">
          Go to groups
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8 lg:max-w-2xl lg:px-8 lg:pt-6">
      <button
        onClick={() => router.back()}
        className="mb-3 text-xs text-muted active:text-accent"
      >
        ← Back
      </button>

      {/* Match header */}
      {match && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
          {(() => {
            const scoreDisplay = getMatchScoreDisplay(match);
            const primaryScore = scoreDisplay.primary ?? PENDING_SCORE;
            const showPending = scoreDisplay.pending && (match.status === "live" || match.status === "finished");

            return (
              <>
          <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
            {match.group_name ? `Group ${match.group_name}` : match.stage}
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-center min-w-0">
              <p className="text-3xl leading-none mb-1"><Flag code={match.home_team_code} /></p>
              <p className="text-sm font-bold leading-tight line-clamp-2 break-words">{match.home_team}</p>
            </div>
            <div className="flex flex-col items-center px-2">
              <span className="text-3xl font-black tabular-nums">{primaryScore}</span>
              {scoreDisplay.secondary && (
                <span className="mt-1 text-[10px] font-medium text-muted">{scoreDisplay.secondary}</span>
              )}
              {showPending && (
                <span className="mt-1 text-[10px] font-medium text-muted">Pending result</span>
              )}
              <span className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${
                match.status === "live" ? "text-success" : "text-muted"
              }`}>
                {match.status === "live" ? "● Live" : match.status === "finished" ? "Full time" : match.status}
              </span>
            </div>
            <div className="flex-1 text-center min-w-0">
              <p className="text-3xl leading-none mb-1"><Flag code={match.away_team_code} /></p>
              <p className="text-sm font-bold leading-tight line-clamp-2 break-words">{match.away_team}</p>
            </div>
          </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Group tabs */}
      {groups.length > 1 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => selectGroup(g.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeGroupId === g.id
                  ? "bg-accent text-[#0f0f23]"
                  : "bg-surface border border-border text-muted"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
        </div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-danger">{error}</p>
      ) : (
        <>
          {isFinished && sortedBets.placed.length > 0 && (
            <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-muted">
              Ranked by points
            </p>
          )}

          <div className="space-y-2">
            {sortedBets.placed.map((bet, i) => {
              const result = match ? betResultLabel(match, bet) : null;
              return (
                <div
                  key={bet.user_id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  {isFinished && (
                    <span className={`w-5 text-center text-sm font-bold tabular-nums ${
                      bet.points_earned === null ? "text-muted" : i < 3 ? "text-accent" : "text-muted"
                    }`}>
                      {bet.points_earned === null ? "–" : i + 1}
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{bet.pseudo}</p>
                    {(bet.confidence || bet.double_up === 1) && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                        {bet.confidence && (
                          <span>
                            {CONFIDENCE_EMOJI[bet.confidence]} {CONFIDENCE_LABEL[bet.confidence]}
                          </span>
                        )}
                        {bet.double_up === 1 && (
                          <span className="rounded bg-accent/15 px-1 font-bold text-accent">×2</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-black text-lg tabular-nums leading-none">
                      {bet.home_score_pred} – {bet.away_score_pred}
                    </p>
                    {isFinished && (
                      <div className="mt-1 flex items-center justify-end gap-1.5">
                        {bet.points_earned === null ? (
                          // Match is finished but this bet hasn't been scored yet —
                          // show a pending state instead of a result with no points.
                          <span className="text-[10px] text-muted">⏳ Scoring…</span>
                        ) : (
                          <>
                            {result && <span className={`text-[10px] ${result.color}`}>{result.label}</span>}
                            <span className={`text-xs font-bold ${
                              bet.points_earned > 0 ? "text-success" :
                              bet.points_earned < 0 ? "text-danger" : "text-muted"
                            }`}>
                              {bet.points_earned > 0 ? "+" : ""}{bet.points_earned.toFixed(1)}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sortedBets.empty.length > 0 && (
              <>
                <p className="mt-4 mb-1 px-1 text-[10px] uppercase tracking-widest text-muted">
                  No bet placed
                </p>
                {sortedBets.empty.map(bet => (
                  <div
                    key={bet.user_id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 opacity-60"
                  >
                    <p className="font-semibold text-sm truncate">{bet.pseudo}</p>
                    <span className="text-xs text-muted">—</span>
                  </div>
                ))}
              </>
            )}

            {sortedBets.placed.length === 0 && sortedBets.empty.length === 0 && (
              <p className="py-12 text-center text-sm text-muted">No members in this group</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function MatchBetsPage() {
  return (
    <Suspense fallback={<MatchBetsFallback />}>
      <MatchBetsContent />
    </Suspense>
  );
}
