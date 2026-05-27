"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import GroupInvite from "@/components/group-invite";

type Group = {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
  my_rank: number;
  my_points: number;
};

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteFor, setInviteFor] = useState<Group | null>(null);

  useEffect(() => {
    apiFetch<Group[]>("/api/groups")
      .then(setGroups)
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg lg:max-w-2xl px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Groups</h1>
        <Link
          href="/groups/new"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#0f0f23] transition active:scale-95"
        >
          + New
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="mt-20 text-center">
          <div className="mb-4 text-6xl">👥</div>
          <h2 className="mb-2 text-lg font-bold">No groups yet</h2>
          <p className="mb-6 text-sm text-muted">
            Create a group and invite your friends to start betting together.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/groups/new"
              className="rounded-xl bg-accent py-3.5 text-center font-semibold text-[#0f0f23]"
            >
              Create a group
            </Link>
            <Link
              href="/groups/join"
              className="rounded-xl border border-border py-3.5 text-center font-semibold text-foreground"
            >
              Join with invite code
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {groups.map((g) => (
              <div
                key={g.id}
                className="relative rounded-2xl bg-surface border border-border transition active:scale-98"
              >
                <Link href={`/groups/${g.id}`} className="block p-4 pr-14">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{g.name}</h3>
                      <p className="text-sm text-muted mt-0.5">{g.member_count} members</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-accent">{Math.round(g.my_points)}pts</p>
                      <p className="text-xs text-muted">Rank #{g.my_rank}</p>
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setInviteFor(g);
                  }}
                  aria-label={`Invite friends to ${g.name}`}
                  className="absolute top-2 right-2 rounded-lg p-2 text-muted active:text-accent active:scale-95 transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <Link
            href="/groups/join"
            className="block rounded-xl border border-dashed border-border py-3 text-center text-sm font-medium text-muted transition active:text-accent"
          >
            + Join another group
          </Link>
        </>
      )}

      {inviteFor && (
        <GroupInvite
          groupName={inviteFor.name}
          inviteCode={inviteFor.invite_code}
          onClose={() => setInviteFor(null)}
        />
      )}
    </div>
  );
}
