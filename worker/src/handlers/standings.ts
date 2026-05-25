import { Env, AuthContext } from "../types";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

type DBMatch = {
  home_team: string; home_team_code: string;
  away_team: string; away_team_code: string;
  home_score: number | null; away_score: number | null;
  status: string; match_date: number;
};

type Standing = {
  team: string; code: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; points: number;
};

function computeStandings(matches: DBMatch[]): Standing[] {
  const map = new Map<string, Standing>();

  for (const m of matches) {
    for (const [team, code] of [[m.home_team, m.home_team_code], [m.away_team, m.away_team_code]] as [string, string][]) {
      if (!map.has(code)) {
        map.set(code, { team, code, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
      }
    }
    if (m.status !== "finished" || m.home_score === null || m.away_score === null) continue;

    const h = map.get(m.home_team_code)!;
    const a = map.get(m.away_team_code)!;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;

    if (m.home_score > m.away_score)      { h.won++; h.points += 3; a.lost++; }
    else if (m.home_score < m.away_score) { a.won++; a.points += 3; h.lost++; }
    else                                  { h.drawn++; h.points++; a.drawn++; a.points++; }
  }

  return [...map.values()]
    .map(t => ({ ...t, gd: t.gf - t.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
}

export async function handleStandings(
  request: Request,
  env: Env,
  url: URL,
  _auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  const { pathname, searchParams } = url;

  // GET /api/standings?wc_group=A
  if (pathname === "/api/standings" && request.method === "GET") {
    const wc_group = searchParams.get("wc_group");
    if (!wc_group) return err("wc_group required", 400, origin);

    const rows = await env.DB.prepare(
      "SELECT home_team, home_team_code, away_team, away_team_code, home_score, away_score, status, match_date FROM matches WHERE group_name = ? ORDER BY match_date ASC"
    ).bind(wc_group.toUpperCase()).all<DBMatch>();

    return json(computeStandings(rows.results), 200, origin);
  }

  // GET /api/scorers?limit=20
  if (pathname === "/api/scorers" && request.method === "GET") {
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
    const rows = await env.DB.prepare(
      "SELECT player_name, team_name, team_code, goals, assists, penalties FROM top_scorers ORDER BY goals DESC, assists DESC LIMIT ?"
    ).bind(limit).all();
    return json(rows.results, 200, origin);
  }

  return err("Not found", 404, origin);
}
