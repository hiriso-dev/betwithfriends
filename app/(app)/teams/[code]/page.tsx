"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { Flag } from "@/components/flag";

type Match = {
  id: string;
  home_team: string; away_team: string;
  home_team_code: string; away_team_code: string;
  match_date: number;
  home_score: number | null; away_score: number | null;
  status: "scheduled" | "live" | "finished" | "postponed";
  stage: string; group_name: string | null;
  stadium: string | null; venue_city: string | null;
};

type Standing = { team: string; code: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number };

export default function TeamPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Match[]>("/api/matches")
      .then(all => {
        const mine = all.filter(m => m.home_team_code === code || m.away_team_code === code)
          .sort((a, b) => a.match_date - b.match_date);
        setTeamMatches(mine);
        const wc_group = mine[0]?.group_name;
        if (wc_group) {
          return apiFetch<Standing[]>(`/api/standings?wc_group=${wc_group}`);
        }
        return [];
      })
      .then(s => setStandings(Array.isArray(s) ? s : []))
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [code, router]);

  const teamName = teamMatches[0]
    ? teamMatches[0].home_team_code === code ? teamMatches[0].home_team : teamMatches[0].away_team
    : code;
  const wcGroup = teamMatches[0]?.group_name;
  const myStanding = standings.find(s => s.code === code);
  const myRank = standings.findIndex(s => s.code === code) + 1;

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-12 rounded-xl bg-surface animate-pulse" />
        <div className="h-32 rounded-2xl bg-surface animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-4">
      <button onClick={() => router.back()} className="mb-4 flex items-center gap-2 text-sm text-muted transition active:text-accent">
        ← Back
      </button>

      {/* Team header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold"><Flag code={code} /> {teamName}</h1>
          <p className="text-sm text-muted">{wcGroup ? `Group ${wcGroup}` : "—"}</p>
        </div>
        {myStanding && (
          <div className="text-right">
            <p className={`text-2xl font-black ${myRank <= 2 ? "text-accent" : "text-muted"}`}>#{myRank}</p>
            <p className="text-xs text-muted">{myStanding.points}pts · {myStanding.gd > 0 ? "+" : ""}{myStanding.gd} GD</p>
          </div>
        )}
      </div>

      {/* Team stats */}
      {myStanding && (
        <div className="mb-4 grid grid-cols-5 gap-2">
          {[
            { label: "P", val: myStanding.played },
            { label: "W", val: myStanding.won },
            { label: "D", val: myStanding.drawn },
            { label: "L", val: myStanding.lost },
            { label: "GF", val: myStanding.gf },
          ].map(({ label, val }) => (
            <div key={label} className="rounded-xl bg-surface border border-border p-2 text-center">
              <p className="text-lg font-bold">{val}</p>
              <p className="text-[10px] text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Matches */}
      <div className="mb-4 rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Group Stage Schedule</h2>
        </div>
        {teamMatches.map(m => {
          const isHome = m.home_team_code === code;
          const opponent = isHome ? m.away_team : m.home_team;
          const opponentCode = isHome ? m.away_team_code : m.home_team_code;
          const isFinished = m.status === "finished";
          const isLive = m.status === "live";
          const myScore = isHome ? m.home_score : m.away_score;
          const theirScore = isHome ? m.away_score : m.home_score;
          const result = !isFinished || myScore === null ? null : myScore > theirScore! ? "W" : myScore < theirScore! ? "L" : "D";
          const resultColor = result
            ? { W: "text-success", D: "text-warning", L: "text-danger" }[result]
            : "";

          return (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {result && (
                    <span className={`text-xs font-black w-4 ${resultColor}`}>{result}</span>
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {isHome ? "vs" : "@"} <Flag code={opponentCode} /> {opponent}
                      <span className="ml-1 text-xs text-muted">{opponentCode}</span>
                    </p>
                    <p className="text-[10px] text-muted">
                      {new Date(m.match_date * 1000).toLocaleString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit", timeZoneName: "short",
                      })}
                    </p>
                    {m.stadium && <p className="text-[10px] text-muted">{m.stadium}</p>}
                  </div>
                </div>
              </div>
              <div className="text-right ml-2">
                {isFinished && myScore !== null ? (
                  <p className={`text-lg font-black ${resultColor}`}>{myScore}–{theirScore}</p>
                ) : isLive ? (
                  <span className="text-xs font-semibold text-success">LIVE</span>
                ) : (
                  <p className="text-xs text-muted">TBD</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Group standings */}
      {standings.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm">Group {wcGroup} Standings</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="px-3 py-2 text-left w-6">#</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-2 py-2 text-center">P</th>
                <th className="px-2 py-2 text-center">W</th>
                <th className="px-2 py-2 text-center">D</th>
                <th className="px-2 py-2 text-center">L</th>
                <th className="px-2 py-2 text-center">GD</th>
                <th className="px-2 py-2 text-center font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.code}
                  className={`border-b border-border last:border-0 cursor-pointer active:bg-surface-hover transition ${
                    s.code === code ? "bg-accent/10" : i < 2 ? "bg-accent/5" : ""
                  }`}
                  onClick={() => router.push(`/teams/${s.code}`)}
                >
                  <td className="px-3 py-2.5"><span className={`font-bold ${i < 2 ? "text-accent" : "text-muted"}`}>{i + 1}</span></td>
                  <td className="px-3 py-2.5">
                    <span className="mr-1"><Flag code={s.code} /></span>
                    <span className={`font-semibold ${s.code === code ? "text-accent" : ""}`}>{s.team}</span>
                    <span className="ml-1 text-[10px] text-muted uppercase">{s.code}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.played}</td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.won}</td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.drawn}</td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.lost}</td>
                  <td className="px-2 py-2.5 text-center text-muted">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                  <td className="px-2 py-2.5 text-center font-bold">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
