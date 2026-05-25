"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import MatchCard from "@/components/match-card";
import { useRouter } from "next/navigation";

type Match = {
  id: string;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
  match_date: number;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "finished" | "postponed";
  stage: string;
  group_name: string | null;
  my_bet?: { home_score_pred: number; away_score_pred: number; points_earned: number | null };
};

type MatchesByDay = Record<string, Match[]>;

export default function FixturesPage() {
  const router = useRouter();
  const [matchesByDay, setMatchesByDay] = useState<MatchesByDay>({});
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [betTarget, setBetTarget] = useState<Match | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Match[]>(`/api/matches?group_id=${selectedGroup}`),
      apiFetch<{ id: string; name: string }[]>("/api/groups"),
    ]).then(([matches, grps]) => {
      setGroups(grps);
      const byDay: MatchesByDay = {};
      for (const m of matches) {
        const day = new Date(m.match_date * 1000).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        byDay[day] = byDay[day] || [];
        byDay[day].push(m);
      }
      setMatchesByDay(byDay);
    }).catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [selectedGroup, router]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-10 rounded-xl bg-surface animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">World Cup 2026</h1>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
          🇺🇸🇨🇦🇲🇽
        </span>
      </div>

      {/* Group selector */}
      {groups.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedGroup("all")}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              selectedGroup === "all"
                ? "bg-accent text-[#0f0f23]"
                : "bg-surface text-muted border border-border"
            }`}
          >
            All
          </button>
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

      {/* Matches by day */}
      {Object.entries(matchesByDay).map(([day, matches]) => (
        <div key={day} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            {day}
          </h2>
          <div className="space-y-3">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                groupId={selectedGroup === "all" ? undefined : selectedGroup}
                onBet={() => setBetTarget(match)}
              />
            ))}
          </div>
        </div>
      ))}

      {Object.keys(matchesByDay).length === 0 && (
        <div className="mt-20 text-center">
          <div className="mb-3 text-5xl">🗓️</div>
          <p className="text-muted">No fixtures yet</p>
        </div>
      )}

      {/* Bet sheet */}
      {betTarget && (
        <BetSheet
          match={betTarget}
          groupId={selectedGroup === "all" ? groups[0]?.id : selectedGroup}
          onClose={() => setBetTarget(null)}
          onSaved={() => {
            setBetTarget(null);
            setLoading(true);
            apiFetch<Match[]>(`/api/matches?group_id=${selectedGroup}`)
              .then((matches) => {
                const byDay: MatchesByDay = {};
                for (const m of matches) {
                  const day = new Date(m.match_date * 1000).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric",
                  });
                  byDay[day] = byDay[day] || [];
                  byDay[day].push(m);
                }
                setMatchesByDay(byDay);
              })
              .finally(() => setLoading(false));
          }}
        />
      )}
    </div>
  );
}

function BetSheet({
  match,
  groupId,
  onClose,
  onSaved,
}: {
  match: Match;
  groupId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [home, setHome] = useState(match.my_bet?.home_score_pred ?? 0);
  const [away, setAway] = useState(match.my_bet?.away_score_pred ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const minutesLeft = Math.floor((match.match_date * 1000 - Date.now()) / 60000);
  const locked = minutesLeft <= 5 || match.status !== "scheduled";

  async function save() {
    if (!groupId) { setError("Select a group first"); return; }
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/bets", {
        method: "POST",
        body: JSON.stringify({ match_id: match.id, group_id: groupId, home_score_pred: home, away_score_pred: away }),
      });
      if (navigator.vibrate) navigator.vibrate(50);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-surface p-6 shadow-2xl">
        <div className="mb-1 h-1 w-12 rounded-full bg-border mx-auto" />
        <div className="mb-6 mt-3 text-center">
          <p className="text-xs text-muted uppercase tracking-widest">{match.stage}</p>
          <h3 className="mt-1 text-lg font-bold">
            {match.home_team} vs {match.away_team}
          </h3>
          {!locked && minutesLeft < 60 && (
            <p className="mt-1 text-xs text-warning">
              ⚡ Locks in {minutesLeft}m
            </p>
          )}
          {locked && <p className="mt-1 text-xs text-danger">🔒 Betting closed</p>}
        </div>

        <div className="mb-6 flex items-center justify-center gap-6">
          <ScoreInput label={match.home_team} value={home} onChange={setHome} disabled={locked} />
          <span className="text-2xl font-bold text-muted">-</span>
          <ScoreInput label={match.away_team} value={away} onChange={setAway} disabled={locked} />
        </div>

        {error && <p className="mb-3 text-center text-sm text-danger">{error}</p>}

        <button
          onClick={save}
          disabled={saving || locked}
          className="w-full rounded-xl bg-accent py-4 font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
        >
          {saving ? "Saving…" : locked ? "Locked" : "Save prediction"}
        </button>
      </div>
    </>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted max-w-[80px] truncate text-center">{label}</p>
      <button
        onClick={() => onChange(Math.min(20, value + 1))}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-lg disabled:opacity-30 transition active:scale-90"
      >
        +
      </button>
      <span className="text-4xl font-bold w-12 text-center">{value}</span>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-lg disabled:opacity-30 transition active:scale-90"
      >
        −
      </button>
    </div>
  );
}
