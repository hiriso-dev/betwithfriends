"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import GroupInvite from "@/components/group-invite";

type Member = {
  user_id: string;
  pseudo: string;
  total_points: number;
  rank: number;
  recent_points: number;
  is_me: boolean;
};

type GroupDetail = {
  id: string;
  name: string;
  invite_code: string;
  is_admin: boolean;
  member_count: number;
};

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNew = searchParams.get("new") === "1";

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(isNew);

  useEffect(() => {
    Promise.all([
      apiFetch<GroupDetail>(`/api/groups/${params.id}`),
      apiFetch<{ members: Member[]; last_match_day: string | null }>(`/api/groups/${params.id}/rankings`),
    ]).then(([g, rankings]) => {
      setGroup(g);
      setMembers(rankings.members);
    }).catch(() => router.push("/groups"))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-16 rounded-2xl bg-surface animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-sm text-muted transition active:text-accent"
      >
        ← Groups
      </button>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{group.name}</h1>
          <p className="text-sm text-muted">{group.member_count} members</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted transition active:border-accent active:text-accent"
        >
          🔗 Invite
        </button>
      </div>

      {/* Rankings */}
      <div className="rounded-2xl bg-surface border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Rankings</h2>
        </div>
        {members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">No predictions yet</div>
        ) : (
          <div>
            {members.map((m) => (
              <div
                key={m.user_id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 ${
                  m.is_me ? "bg-accent/5" : ""
                }`}
              >
                <span className={`w-7 text-center font-bold ${
                  m.rank === 1 ? "text-yellow-400 text-lg" :
                  m.rank === 2 ? "text-slate-300 text-lg" :
                  m.rank === 3 ? "text-amber-600 text-lg" :
                  "text-muted text-sm"
                }`}>
                  {m.rank === 1 ? "🥇" : m.rank === 2 ? "🥈" : m.rank === 3 ? "🥉" : `${m.rank}`}
                </span>
                <span className={`flex-1 font-medium ${m.is_me ? "text-accent" : ""}`}>
                  {m.pseudo}
                  {m.is_me && <span className="ml-1 text-xs text-muted">(you)</span>}
                </span>
                <span className="font-bold">{Math.round(m.total_points)}pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <GroupInvite
          groupName={group.name}
          inviteCode={group.invite_code}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}
