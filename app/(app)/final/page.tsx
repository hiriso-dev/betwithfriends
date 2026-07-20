"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Flag } from "@/components/flag";
import { TOURNAMENT_RESULTS } from "@/lib/tournament-results";

type Group = { id: string; name: string };
type RankingMember = {
  user_id: string;
  pseudo: string;
  total_points: number;
  rank: number;
  is_me: boolean;
};

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export default function FinalPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<RankingMember[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(false);

  useEffect(() => {
    apiFetch<Group[]>("/api/groups")
      .then((grps) => {
        setGroups(grps);
        if (grps.length > 0) setSelectedGroupId(grps[0].id);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoadingGroups(false));
  }, [router]);

  const loadRanking = useCallback((groupId: string) => {
    setLoadingRanking(true);
    apiFetch<{ members: RankingMember[] }>(`/api/groups/${groupId}/rankings`)
      .then((res) => setMembers(res.members))
      .catch(() => setMembers([]))
      .finally(() => setLoadingRanking(false));
  }, []);

  useEffect(() => {
    if (selectedGroupId) loadRanking(selectedGroupId);
  }, [selectedGroupId, loadRanking]);

  if (loadingGroups) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-40 rounded-2xl bg-surface animate-pulse" />
        <div className="h-14 rounded-xl bg-surface animate-pulse" />
      </div>
    );
  }

  const winner = members.find((m) => m.rank === 1) ?? null;
  const podium = members.slice(0, 3);
  const groupName = groups.find((g) => g.id === selectedGroupId)?.name;

  return (
    <div className="mx-auto max-w-lg lg:max-w-2xl px-4 pt-4 pb-4">
      <div className="mb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">World Cup 2026 · Full time</p>
        <h1 className="mt-1 text-2xl font-black">The Final Standings</h1>
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div className="mb-4 flex justify-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {groups.map((g) => (
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

      {groups.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted">Join a group to see the final standings</div>
      ) : loadingRanking ? (
        <div className="space-y-3">
          <div className="h-44 rounded-3xl bg-surface animate-pulse" />
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted">No predictions in this group</div>
      ) : (
        <>
          {/* Champion hero */}
          {winner && (
            <div className="mb-5 rounded-3xl border border-accent/40 bg-gradient-to-b from-accent/15 to-surface p-6 text-center shadow-[0_0_40px_rgba(250,204,21,0.12)]">
              <div className="text-5xl">🏆</div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-accent">Group Champion</p>
              <p className="mt-1 text-2xl font-black">
                {winner.pseudo}
                {winner.is_me && <span className="ml-1.5 text-sm font-medium text-muted">(you)</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {fmt(winner.total_points)} pts · {groupName}
              </p>
            </div>
          )}

          {/* Podium */}
          {podium.length >= 2 && (
            <div className="mb-6 grid grid-cols-3 items-end gap-2">
              {[podium[1], podium[0], podium[2]].map((m, idx) => {
                if (!m) return <div key={idx} />;
                const place = m.rank;
                const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
                const h = place === 1 ? "h-28" : place === 2 ? "h-20" : "h-16";
                return (
                  <div key={m.user_id} className="flex flex-col items-center">
                    <div className="text-2xl">{medal}</div>
                    <p className={`mt-1 max-w-full truncate text-sm font-semibold ${m.is_me ? "text-accent" : ""}`}>
                      {m.pseudo}
                    </p>
                    <p className="text-xs text-muted">{fmt(m.total_points)} pts</p>
                    <div
                      className={`mt-2 w-full rounded-t-xl border border-b-0 border-border bg-surface ${h} flex items-start justify-center pt-2 text-lg font-black text-muted`}
                    >
                      {place}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full ranking */}
          <div className="mb-6 rounded-2xl border border-border bg-surface overflow-hidden">
            {members.map((m) => {
              const medal = m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : m.rank === 3 ? "🥉" : null;
              return (
                <button
                  key={m.user_id}
                  onClick={() => router.push(`/history?user_id=${m.user_id}&group_id=${selectedGroupId}`)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 transition active:bg-surface-hover ${
                    m.is_me ? "bg-accent/5" : ""
                  }`}
                >
                  <span className={`w-7 shrink-0 text-center font-bold ${medal ? "text-xl" : "text-sm text-muted"}`}>
                    {medal ?? m.rank}
                  </span>
                  <span className={`flex-1 font-medium truncate ${m.is_me ? "text-accent" : ""}`}>
                    {m.pseudo}
                    {m.is_me && <span className="ml-1.5 text-xs text-muted opacity-60">(you)</span>}
                  </span>
                  <span className="font-bold tabular-nums">
                    {fmt(m.total_points)}
                    <span className="ml-0.5 text-xs font-normal text-muted">pts</span>
                  </span>
                  <span className="text-muted text-xs opacity-50">›</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Actual World Cup results */}
      <div className="mb-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">How it ended</h2>
        <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
          {TOURNAMENT_RESULTS.map((r) => (
            <div key={r.type} className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">{r.emoji}</span>
              <span className="w-28 shrink-0 text-sm text-muted">{r.label}</span>
              <Flag code={r.code} />
              <span className="flex-1 font-semibold truncate">{r.value}</span>
              <span className="shrink-0 text-xs text-muted">{r.points}pts</span>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/special/results"
        className="block rounded-2xl border border-border bg-surface px-4 py-3.5 text-center text-sm font-semibold transition active:border-accent active:text-accent"
      >
        See everyone&apos;s special bets →
      </Link>
    </div>
  );
}
