"use client";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

type Group = { id: string; name: string };
type RankingMember = {
  user_id: string;
  pseudo: string;
  total_points: number;
  rank: number;
  recent_points: number;
  is_me: boolean;
};
type LastMatch = {
  home_team: string;
  away_team: string;
  home_team_code: string | null;
  away_team_code: string | null;
  home_score: number | null;
  away_score: number | null;
  match_date: number;
};
type RankingsResponse = { members: RankingMember[]; last_match: LastMatch | null };

export default function RankingsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<RankingMember[]>([]);
  const [lastMatch, setLastMatch] = useState<LastMatch | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);

  useEffect(() => {
    apiFetch<Group[]>("/api/groups")
      .then(grps => {
        setGroups(grps);
        if (grps.length > 0) setSelectedGroupId(grps[0].id);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoadingGroups(false));
  }, [router]);

  const loadRanking = useCallback((groupId: string) => {
    setLoadingRanking(true);
    apiFetch<RankingsResponse>(`/api/groups/${groupId}/rankings`)
      .then(res => {
        setMembers(res.members);
        setLastMatch(res.last_match);
      })
      .catch(() => {})
      .finally(() => setLoadingRanking(false));
  }, []);

  useEffect(() => {
    if (selectedGroupId) loadRanking(selectedGroupId);
  }, [selectedGroupId, loadRanking]);

  if (loadingGroups) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-10 rounded-xl bg-surface animate-pulse" />
        {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
      </div>
    );
  }

  const lastMatchLabel = lastMatch
    ? `${lastMatch.home_team_code ?? lastMatch.home_team} ${lastMatch.home_score ?? 0}–${lastMatch.away_score ?? 0} ${lastMatch.away_team_code ?? lastMatch.away_team}`
    : null;

  return (
    <div className="mx-auto max-w-lg lg:max-w-2xl px-4 pt-4 pb-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Rankings</h1>
        {lastMatchLabel && (
          <p className="text-sm text-muted mt-0.5">Points from last match · {lastMatchLabel}</p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-muted text-sm">Join a group to see rankings</p>
        </div>
      ) : (
        <>
          {/* Group selector */}
          {groups.length > 1 && (
            <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    selectedGroupId === g.id
                      ? "bg-accent text-[#0f0f23]"
                      : "bg-surface border border-border text-muted"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {loadingRanking ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
            </div>
          ) : members.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted">No predictions yet in this group</div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              {members.map((m) => {
                const recent = m.recent_points;
                const hasRecent = lastMatch !== null;
                const recentColor = recent > 0 ? "text-success" : recent < 0 ? "text-danger" : "text-muted";
                const recentLabel = recent > 0 ? `+${recent % 1 === 0 ? recent : recent.toFixed(1)}` : recent < 0 ? (recent % 1 === 0 ? String(recent) : recent.toFixed(1)) : "—";
                const medal = m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : m.rank === 3 ? "🥉" : null;

                return (
                  <div
                    key={m.user_id}
                    className={`flex items-center gap-3 px-4 py-4 border-b border-border last:border-0 ${m.is_me ? "bg-accent/5" : ""}`}
                  >
                    <span className={`w-7 shrink-0 text-center font-bold ${medal ? "text-xl" : "text-sm text-muted"}`}>
                      {medal ?? m.rank}
                    </span>

                    <span className={`flex-1 font-medium truncate ${m.is_me ? "text-accent" : ""}`}>
                      {m.pseudo}
                      {m.is_me && <span className="ml-1.5 text-xs text-muted opacity-60">(you)</span>}
                    </span>

                    <div className="flex items-center gap-3 shrink-0">
                      {hasRecent && (
                        <span className={`text-sm font-semibold tabular-nums w-12 text-right ${recentColor}`}>
                          {recentLabel}
                        </span>
                      )}
                      <span className="font-bold tabular-nums text-base">
                        {m.total_points % 1 === 0 ? m.total_points : m.total_points.toFixed(1)}
                        <span className="text-xs font-normal text-muted ml-0.5">pts</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
