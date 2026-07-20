"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Flag } from "@/components/flag";
import { TOURNAMENT_RESULTS, RESULT_BY_TYPE, isCorrectPick } from "@/lib/tournament-results";

type Pick = { value: string; points: number | null };
type MemberSpecials = {
  user_id: string;
  pseudo: string;
  total_special: number;
  picks: Record<string, Pick>;
};
type Group = { id: string; name: string };

const ORDER = TOURNAMENT_RESULTS.map((r) => r.type);

export default function SpecialResultsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [members, setMembers] = useState<MemberSpecials[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    apiFetch<Group[]>("/api/groups")
      .then((g) => {
        setGroups(g);
        if (g.length > 0) setSelectedGroup(g[0].id);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!selectedGroup) return;
    setLoadingRows(true);
    apiFetch<{ members: MemberSpecials[] }>(`/api/special-bets/all?group_id=${selectedGroup}`)
      .then((r) => setMembers(r.members))
      .catch(() => setMembers([]))
      .finally(() => setLoadingRows(false));
  }, [selectedGroup]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-8 w-48 rounded-xl bg-surface animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg lg:max-w-3xl px-4 pt-4 pb-4">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/special" className="text-muted text-sm active:text-accent">←</Link>
        <div>
          <h1 className="text-xl font-bold">Special Bets · Results</h1>
          <p className="text-sm text-muted mt-0.5">How everyone did on the tournament specials</p>
        </div>
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                selectedGroup === g.id
                  ? "bg-accent text-[#0f0f23]"
                  : "bg-surface text-muted border border-border"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Official results */}
      <div className="mb-5 grid grid-cols-2 gap-2">
        {TOURNAMENT_RESULTS.map((r) => (
          <div key={r.type} className="rounded-2xl border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{r.emoji} {r.label}</span>
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                {r.points}pts
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 font-semibold">
              <Flag code={r.code} />
              <span className="truncate">{r.value}</span>
            </div>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="mt-20 text-center text-muted">Join or create a group first</div>
      )}

      {loadingRows ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface animate-pulse" />)}
        </div>
      ) : members.length === 0 && groups.length > 0 ? (
        <div className="py-16 text-center text-sm text-muted">No special bets in this group</div>
      ) : (
        <div className="space-y-2.5">
          {members.map((m, i) => (
            <div key={m.user_id} className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-hover/40">
                <div className="flex items-center gap-2 font-semibold truncate">
                  <span className="w-5 shrink-0 text-center text-xs text-muted">{i + 1}</span>
                  <span className="truncate">{m.pseudo}</span>
                </div>
                <span className="shrink-0 font-bold tabular-nums text-accent">
                  +{m.total_special % 1 === 0 ? m.total_special : m.total_special.toFixed(1)}
                  <span className="ml-0.5 text-xs font-normal text-muted">pts</span>
                </span>
              </div>
              <div className="divide-y divide-border">
                {ORDER.map((type) => {
                  const result = RESULT_BY_TYPE[type];
                  const pick = m.picks[type];
                  const correct = pick && isCorrectPick(type, pick.value);
                  return (
                    <div key={type} className="flex items-center gap-2 px-4 py-2 text-sm">
                      <span className="w-6 shrink-0 text-center">{result.emoji}</span>
                      <span className="w-20 shrink-0 text-xs text-muted">{result.label}</span>
                      <span className={`flex-1 truncate ${pick ? "" : "text-muted italic"}`}>
                        {pick ? pick.value : "no pick"}
                      </span>
                      {pick && (
                        <span
                          className={`shrink-0 text-xs font-bold tabular-nums ${
                            correct ? "text-success" : "text-danger"
                          }`}
                        >
                          {correct ? `✓ +${result.points}` : "✗ 0"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
