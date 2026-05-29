"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Flag } from "@/components/flag";
import { GOLDEN_BOOT_PLAYERS } from "@/lib/golden-boot-players";
import { AdminResolveSpecial } from "@/components/admin-resolve-special";

const ADMIN_EMAIL = "jerome.ladeveze@gmail.com";

const SPECIAL_BET_TYPES = [
  { type: "champion", label: "🏆 World Champion", points: 50, description: "Which team will lift the trophy?" },
  { type: "runner_up", label: "🥈 Runner-up", points: 20, description: "Who reaches the final but loses?" },
  { type: "third_place", label: "🥉 Third place", points: 15, description: "Who finishes in 3rd?" },
  { type: "top_scorer", label: "⚽ Golden Boot", points: 30, description: "Top goalscorer of the tournament" },
];

const WC_TEAMS = [
  { name: "Argentina",     code: "ARG" }, { name: "Australia",    code: "AUS" },
  { name: "Belgium",       code: "BEL" }, { name: "Brazil",       code: "BRA" },
  { name: "Cameroon",      code: "CMR" }, { name: "Canada",       code: "CAN" },
  { name: "Chile",         code: "CHI" }, { name: "Colombia",     code: "COL" },
  { name: "Croatia",       code: "CRO" }, { name: "Denmark",      code: "DEN" },
  { name: "Ecuador",       code: "ECU" }, { name: "Egypt",        code: "EGY" },
  { name: "England",       code: "ENG" }, { name: "France",       code: "FRA" },
  { name: "Germany",       code: "GER" }, { name: "Ghana",        code: "GHA" },
  { name: "Greece",        code: "GRE" }, { name: "Honduras",     code: "HON" },
  { name: "Hungary",       code: "HUN" }, { name: "Iran",         code: "IRN" },
  { name: "Israel",        code: "ISR" }, { name: "Italy",        code: "ITA" },
  { name: "Japan",         code: "JPN" }, { name: "South Korea",  code: "KOR" },
  { name: "Mexico",        code: "MEX" }, { name: "Morocco",      code: "MAR" },
  { name: "Netherlands",   code: "NED" }, { name: "Nigeria",      code: "NGA" },
  { name: "New Zealand",   code: "NZL" }, { name: "Panama",       code: "PAN" },
  { name: "Paraguay",      code: "PAR" }, { name: "Peru",         code: "PER" },
  { name: "Poland",        code: "POL" }, { name: "Portugal",     code: "POR" },
  { name: "Saudi Arabia",  code: "KSA" }, { name: "Senegal",      code: "SEN" },
  { name: "Serbia",        code: "SRB" }, { name: "South Africa", code: "RSA" },
  { name: "Spain",         code: "ESP" }, { name: "Switzerland",  code: "SUI" },
  { name: "Turkey",        code: "TUR" }, { name: "Ukraine",      code: "UKR" },
  { name: "United States", code: "USA" }, { name: "Uruguay",      code: "URU" },
  { name: "Venezuela",     code: "VEN" }, { name: "Wales",        code: "WAL" },
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
  const [playerSearch, setPlayerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // WC 2026 starts June 11, 2026
    const wcStart = new Date("2026-06-11T21:00:00Z").getTime();
    setTournamentStarted(Date.now() >= wcStart);

    apiFetch<{ email: string }>("/api/auth/me").then((r) => setUserEmail(r.email)).catch(() => {});

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

  function openEditor(type: string, value: string) {
    setEditingType(type);
    setSelectedValue(value);
    setPlayerSearch("");
  }

  return (
    <div className="mx-auto max-w-lg lg:max-w-2xl px-4 pt-4">
      {userEmail === ADMIN_EMAIL && <AdminResolveSpecial />}

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
          const openable = !locked && !!selectedGroup;

          return (
            <div
              key={spec.type}
              onClick={openable ? () => openEditor(spec.type, existing?.bet_value ?? "") : undefined}
              className={`rounded-2xl bg-surface border border-border p-4 ${
                openable ? "cursor-pointer transition active:border-accent" : ""
              }`}
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
                {openable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditor(spec.type, existing?.bet_value ?? "");
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
          <div data-pull-ignore className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={() => setEditingType(null)} />
          <div data-pull-ignore className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-surface shadow-2xl max-h-[75vh] flex flex-col">
            {/* Scrollable picker */}
            <div className="overflow-y-auto flex-1 px-6 pt-6 pb-2">
              <div className="mb-1 h-1 w-12 rounded-full bg-border mx-auto" />
              <h3 className="mt-3 mb-4 text-lg font-bold">
                {SPECIAL_BET_TYPES.find((s) => s.type === editingType)?.label}
              </h3>

              {editingType === "top_scorer" ? (
                <>
                  <div className="sticky top-0 z-10 -mx-6 -mt-2 bg-surface px-6 pb-3 pt-2">
                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="Search player or country…"
                      className="w-full rounded-xl border border-border bg-surface-hover px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    {GOLDEN_BOOT_PLAYERS.filter((p) => {
                      const q = playerSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.country.toLowerCase().includes(q)
                      );
                    }).map((p) => {
                      const active = selectedValue === p.name;
                      return (
                        <button
                          key={p.rank}
                          onClick={() => setSelectedValue(p.name)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                            active
                              ? "bg-accent text-[#0f0f23]"
                              : "bg-surface-hover text-foreground border border-border active:border-accent"
                          }`}
                        >
                          <span className={`w-6 shrink-0 text-xs font-bold ${active ? "text-[#0f0f23]/70" : "text-muted"}`}>
                            {p.rank}
                          </span>
                          <Flag code={p.code} />
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className={`shrink-0 text-xs ${active ? "text-[#0f0f23]/70" : "text-muted"}`}>
                            {p.odds}
                          </span>
                        </button>
                      );
                    })}

                    {/* Other — none of the 100 players above */}
                    <button
                      onClick={() => setSelectedValue("Other")}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                        selectedValue === "Other"
                          ? "bg-accent text-[#0f0f23]"
                          : "bg-surface-hover text-foreground border border-border active:border-accent"
                      }`}
                    >
                      <span className={`w-6 shrink-0 text-center ${selectedValue === "Other" ? "text-[#0f0f23]/70" : "text-muted"}`}>—</span>
                      <span className="flex-1">Other (none of the above)</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {WC_TEAMS.map(({ name, code: tCode }) => (
                    <button
                      key={name}
                      onClick={() => setSelectedValue(name)}
                      className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        selectedValue === name
                          ? "bg-accent text-[#0f0f23]"
                          : "bg-surface-hover text-foreground border border-border active:border-accent"
                      }`}
                    >
                      <Flag code={tCode} /> {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Sticky confirm button — always visible, never buried under scroll or nav */}
            <div className="px-6 py-4 pb-safe border-t border-border bg-surface">
              <button
                onClick={saveBet}
                disabled={saving || !selectedValue}
                className="w-full rounded-xl bg-accent py-4 font-bold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
              >
                {saving ? "Saving…" : `Confirm: ${selectedValue || "—"}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
