"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

const SPECIAL_BET_TYPES = [
  { type: "champion", label: "🏆 World Champion", points: 50, description: "Which team will lift the trophy?" },
  { type: "runner_up", label: "🥈 Runner-up", points: 20, description: "Who reaches the final but loses?" },
  { type: "third_place", label: "🥉 Third place", points: 15, description: "Who finishes in 3rd?" },
  { type: "top_scorer", label: "⚽ Golden Boot", points: 30, description: "Top goalscorer of the tournament" },
];

const WC_TEAMS = [
  "Argentina", "Australia", "Belgium", "Brazil", "Cameroon",
  "Canada", "Chile", "Colombia", "Croatia", "Denmark", "Ecuador",
  "Egypt", "England", "France", "Germany", "Ghana", "Greece",
  "Honduras", "Hungary", "Iran", "Israel", "Italy", "Japan",
  "South Korea", "Mexico", "Morocco", "Netherlands", "Nigeria",
  "New Zealand", "Panama", "Paraguay", "Peru", "Poland", "Portugal",
  "Saudi Arabia", "Senegal", "Serbia", "South Africa", "Spain",
  "Switzerland", "Turkey", "Ukraine", "United States", "Uruguay",
  "Venezuela", "Wales",
];

type SpecialBet = {
  bet_type: string;
  bet_value: string;
  points_earned: number | null;
};

type Group = { id: string; name: string };

export default function SpecialPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [bets, setBets] = useState<SpecialBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [tournamentStarted, setTournamentStarted] = useState(false);

  useEffect(() => {
    // WC 2026 starts June 11, 2026
    const wcStart = new Date("2026-06-11T21:00:00Z").getTime();
    setTournamentStarted(Date.now() >= wcStart);

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
    apiFetch<SpecialBet[]>(`/api/special-bets?group_id=${selectedGroup}`)
      .then(setBets)
      .catch(() => setBets([]));
  }, [selectedGroup]);

  async function saveBet() {
    if (!editingType || !selectedValue || !selectedGroup) return;
    setSaving(true);
    try {
      await apiFetch("/api/special-bets", {
        method: "POST",
        body: JSON.stringify({ group_id: selectedGroup, bet_type: editingType, bet_value: selectedValue }),
      });
      setBets((prev) => {
        const updated = prev.filter((b) => b.bet_type !== editingType);
        return [...updated, { bet_type: editingType, bet_value: selectedValue, points_earned: null }];
      });
      setEditingType(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  const myBet = (type: string) => bets.find((b) => b.bet_type === type);

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Special Bets</h1>
        <p className="text-sm text-muted mt-0.5">
          {tournamentStarted
            ? "Tournament has started — special bets are locked"
            : "Lock in before June 11 · earn bonus points"}
        </p>
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
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

      {groups.length === 0 && (
        <div className="mt-20 text-center">
          <p className="text-muted">Join or create a group first</p>
        </div>
      )}

      <div className="space-y-3">
        {SPECIAL_BET_TYPES.map((spec) => {
          const existing = myBet(spec.type);
          const locked = tournamentStarted || !!existing?.points_earned;

          return (
            <div
              key={spec.type}
              className="rounded-2xl bg-surface border border-border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{spec.label}</h3>
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                      +{spec.points}pts
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{spec.description}</p>
                  {existing && (
                    <p className="mt-2 text-sm">
                      <span className="text-foreground font-medium">Your pick: </span>
                      <span className="text-accent">{existing.bet_value}</span>
                      {existing.points_earned !== null && (
                        <span className={`ml-2 font-bold ${existing.points_earned > 0 ? "text-success" : "text-danger"}`}>
                          {existing.points_earned > 0 ? `+${existing.points_earned}pts` : "0pts"}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                {!locked && selectedGroup && (
                  <button
                    onClick={() => {
                      setEditingType(spec.type);
                      setSelectedValue(existing?.bet_value ?? "");
                    }}
                    className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-muted transition active:border-accent active:text-accent"
                  >
                    {existing ? "Change" : "Pick"}
                  </button>
                )}
                {locked && !existing && <span className="text-sm text-muted">🔒</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit sheet */}
      {editingType && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setEditingType(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-surface p-6 shadow-2xl max-h-[70vh] overflow-y-auto">
            <div className="mb-1 h-1 w-12 rounded-full bg-border mx-auto" />
            <h3 className="mt-3 mb-4 text-lg font-bold">
              {SPECIAL_BET_TYPES.find((s) => s.type === editingType)?.label}
            </h3>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {WC_TEAMS.map((team) => (
                <button
                  key={team}
                  onClick={() => setSelectedValue(team)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    selectedValue === team
                      ? "bg-accent text-[#0f0f23]"
                      : "bg-surface-hover text-foreground border border-border active:border-accent"
                  }`}
                >
                  {team}
                </button>
              ))}
            </div>
            <button
              onClick={saveBet}
              disabled={saving || !selectedValue}
              className="w-full rounded-xl bg-accent py-4 font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
            >
              {saving ? "Saving…" : `Confirm: ${selectedValue || "—"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
