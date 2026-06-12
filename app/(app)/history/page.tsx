"use client";
import { Suspense, useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Flag } from "@/components/flag";
import { getMatchScoreDisplay } from "@/lib/match-score";

type BetHistoryItem = {
  id: string;
  group_id: string;
  group_name: string;
  match_id: string;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
  match_date: number;
  home_score_pred: number;
  away_score_pred: number;
  confidence: string | null;
  double_up: number;
  home_score: number | null;
  away_score: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
  score_duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" | null;
  points_earned: number | null;
  match_status: "scheduled" | "live" | "finished" | "postponed";
  stage: string;
};

type Group = { id: string; name: string };

const CONFIDENCE_EMOJI: Record<string, string> = {
  cautious: "😬", confident: "👍", reckless: "🔥",
};

function getOutcome(item: BetHistoryItem): { label: string; color: string } | null {
  if (item.match_status !== "finished" || item.home_score === null || item.away_score === null) {
    return item.match_status === "live" ? { label: "Live", color: "text-success" } : { label: "Pending", color: "text-muted" };
  }
  const hp = item.home_score_pred;
  const ap = item.away_score_pred;
  const hr = item.home_score;
  const ar = item.away_score;
  if (hp === hr && ap === ar) return { label: "⭐ Exact", color: "text-success" };
  const predResult = hp > ap ? "home" : hp < ap ? "away" : "draw";
  const actResult = hr > ar ? "home" : hr < ar ? "away" : "draw";
  if (predResult === actResult) return { label: "✓ Correct", color: "text-warning" };
  return { label: "✗ Wrong", color: "text-danger" };
}

const PAGE_SIZE = 50;

function BetHistoryFallback() {
  return (
    <div className="mx-auto max-w-lg lg:max-w-2xl px-4 pt-4 pb-8 space-y-3">
      <div className="h-8 w-36 rounded-xl bg-surface animate-pulse" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />
      ))}
    </div>
  );
}

function BetHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get("group_id") ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [bets, setBets] = useState<BetHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Load groups once
  useEffect(() => {
    apiFetch<Group[]>("/api/groups")
      .then(grps => {
        setGroups(grps);
        if (!initialGroupId && grps.length > 0) setSelectedGroupId("");
      })
      .catch(() => router.push("/login"));
  }, [initialGroupId, router]);

  const loadBets = useCallback(async (groupId: string, newOffset: number, append: boolean) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(newOffset) });
    if (groupId) params.set("group_id", groupId);
    try {
      const data = await apiFetch<{ bets: BetHistoryItem[]; total: number }>(
        `/api/bets/history?${params}`
      );
      if (append) {
        setBets(prev => [...prev, ...data.bets]);
      } else {
        setBets(data.bets);
      }
      setTotal(data.total);
      setOffset(newOffset + data.bets.length);
    } catch {
      // silently fail — user will see empty state
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: "0" });
    if (selectedGroupId) params.set("group_id", selectedGroupId);

    void apiFetch<{ bets: BetHistoryItem[]; total: number }>(`/api/bets/history?${params}`)
      .then((data) => {
        if (cancelled) return;
        setBets(data.bets);
        setTotal(data.total);
        setOffset(data.bets.length);
      })
      .catch(() => {
        if (cancelled) return;
        setBets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  function selectGroup(groupId: string) {
    if (groupId === selectedGroupId) return;
    setLoading(true);
    setOffset(0);
    setBets([]);
    setSelectedGroupId(groupId);
  }

  async function loadMore() {
    setLoadingMore(true);
    await loadBets(selectedGroupId, offset, true);
    setLoadingMore(false);
  }

  const hasMore = bets.length < total;

  function fmtDate(ts: number) {
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg lg:max-w-2xl px-4 pt-4 pb-8 space-y-3">
        <div className="h-8 w-36 rounded-xl bg-surface animate-pulse" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg lg:max-w-2xl px-4 pt-4 pb-8">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-xs text-muted active:text-accent"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Bet History</h1>
        {total > 0 && (
          <span className="ml-auto text-xs text-muted">{total} total</span>
        )}
      </div>

      {/* Group filter */}
      {groups.length > 1 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => selectGroup("")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              !selectedGroupId ? "bg-accent text-[#0f0f23]" : "bg-surface border border-border text-muted"
            }`}
          >
            All groups
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => selectGroup(g.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selectedGroupId === g.id ? "bg-accent text-[#0f0f23]" : "bg-surface border border-border text-muted"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {bets.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-5xl mb-4">🎯</p>
          <p className="text-sm text-muted mb-4">No bets placed yet — go to Fixtures to place your first bet.</p>
          <button
            onClick={() => router.push("/fixtures")}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0f0f23] transition active:scale-95"
          >
            Go to Fixtures
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {bets.map(item => {
            const outcome = getOutcome(item);
            const isFinished = item.match_status === "finished";
                const actualScoreDisplay = getMatchScoreDisplay(item);
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-surface px-3 py-2.5 flex items-center gap-3"
              >
                {/* Match + group */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate flex items-center gap-1">
                    <Flag code={item.home_team_code} />
                    <span>{item.home_team}</span>
                    <span className="text-muted mx-0.5">vs</span>
                    <span>{item.away_team}</span>
                    <Flag code={item.away_team_code} />
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                    <span>{fmtDate(item.match_date)}</span>
                    {groups.length > 1 && (
                      <>
                        <span>·</span>
                        <span>{item.group_name}</span>
                      </>
                    )}
                  </div>
                  {/* Prediction + boosts */}
                  <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                    <span className="font-black tabular-nums">
                      {item.home_score_pred} – {item.away_score_pred}
                    </span>
                    {item.confidence && (
                      <span>{CONFIDENCE_EMOJI[item.confidence]}</span>
                    )}
                    {item.double_up === 1 && (
                      <span className="rounded bg-accent/15 px-1 text-[9px] font-bold text-accent">×2</span>
                    )}
                    {isFinished && !actualScoreDisplay.pending && actualScoreDisplay.inline && (
                      <span className="text-muted ml-1">
                        (actual: {actualScoreDisplay.inline})
                      </span>
                    )}
                  </div>
                </div>

                {/* Outcome + points */}
                <div className="text-right shrink-0">
                  {outcome && (
                    <p className={`text-xs font-semibold ${outcome.color}`}>{outcome.label}</p>
                  )}
                  {isFinished && item.points_earned !== null ? (
                    <p className={`font-bold text-sm tabular-nums ${
                      item.points_earned > 0 ? "text-success" : item.points_earned < 0 ? "text-danger" : "text-muted"
                    }`}>
                      {item.points_earned > 0 ? "+" : ""}{item.points_earned.toFixed(1)}pts
                    </p>
                  ) : isFinished ? (
                    <p className="text-xs text-muted">–</p>
                  ) : (
                    <p className="text-xs text-muted">–</p>
                  )}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full mt-2 rounded-xl border border-border py-3 text-sm text-muted transition active:bg-surface-hover disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : `Load more (${total - bets.length} remaining)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function BetHistoryPage() {
  return (
    <Suspense fallback={<BetHistoryFallback />}>
      <BetHistoryContent />
    </Suspense>
  );
}
