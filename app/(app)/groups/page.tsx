"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

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
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="block rounded-2xl bg-surface border border-border p-4 transition active:scale-98"
              >
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
    </div>
  );
}
