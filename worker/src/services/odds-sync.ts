import { Env } from "../types";

const SPORT = "soccer_fifa_world_cup";
const SYNC_INTERVAL_SECONDS = 3 * 3600; // max ~8 calls/day, well within 500/month free tier

// Our seed names → The Odds API canonical names (where they differ)
const ODDS_API_NAMES: Record<string, string> = {
  "USA": "United States",
  "South Korea": "Korea Republic",
  "Ivory Coast": "Cote D'Ivoire",
  "Iran": "IR Iran",
  "Honduras": "Honduras",
};

function normName(s: string): string {
  return s.toLowerCase().replace(/['’\-\.]/g, "").trim();
}

function toOddsName(seedName: string): string {
  return ODDS_API_NAMES[seedName] ?? seedName;
}

interface OddsEvent {
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number }>;
    }>;
  }>;
}

function capOdds(v: number): number {
  return Math.min(6.0, Math.max(1.1, Math.round(v * 10) / 10));
}

async function ensureOddsColumns(env: Env): Promise<void> {
  try {
    await env.DB.prepare("SELECT home_odds FROM matches LIMIT 1").first();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("no such column")) throw e;
    await env.DB.prepare("ALTER TABLE matches ADD COLUMN home_odds REAL").run();
    await env.DB.prepare("ALTER TABLE matches ADD COLUMN draw_odds REAL").run();
    await env.DB.prepare("ALTER TABLE matches ADD COLUMN away_odds REAL").run();
    await env.DB.prepare("ALTER TABLE matches ADD COLUMN odds_updated_at INTEGER").run();
  }
}

export async function syncOdds(env: Env): Promise<void> {
  if (!env.ODDS_API_KEY) return;

  await ensureOddsColumns(env);

  // Rate limit: skip if synced within the last SYNC_INTERVAL_SECONDS
  const recent = await env.DB.prepare(
    "SELECT MAX(odds_updated_at) as last FROM matches WHERE odds_updated_at IS NOT NULL"
  ).first<{ last: number | null }>();

  const cutoff = Math.floor(Date.now() / 1000) - SYNC_INTERVAL_SECONDS;
  if (recent?.last && recent.last > cutoff) return;

  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/${SPORT}/odds?apiKey=${env.ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`
  );
  if (!res.ok) {
    console.error(`Odds API error: ${res.status} ${await res.text()}`);
    return;
  }

  const events: OddsEvent[] = await res.json();

  const dbMatches = await env.DB.prepare(
    "SELECT id, home_team, away_team FROM matches WHERE status = 'scheduled'"
  ).all<{ id: string; home_team: string; away_team: string }>();

  for (const event of events) {
    const eventHomeNorm = normName(event.home_team);
    const eventAwayNorm = normName(event.away_team);

    const match = dbMatches.results.find((m) => {
      return (
        normName(toOddsName(m.home_team)) === eventHomeNorm &&
        normName(toOddsName(m.away_team)) === eventAwayNorm
      );
    });

    if (!match) continue;

    // Average decimal odds across all bookmakers
    let homeSum = 0, drawSum = 0, awaySum = 0, count = 0;

    for (const bm of event.bookmakers) {
      const h2h = bm.markets.find((m) => m.key === "h2h");
      if (!h2h) continue;

      const homeOc = h2h.outcomes.find((o) => normName(o.name) === eventHomeNorm);
      const drawOc = h2h.outcomes.find((o) => o.name === "Draw");
      const awayOc = h2h.outcomes.find((o) => normName(o.name) === eventAwayNorm);

      if (!homeOc || !drawOc || !awayOc) continue;

      homeSum += homeOc.price;
      drawSum += drawOc.price;
      awaySum += awayOc.price;
      count++;
    }

    if (count === 0) continue;

    await env.DB.prepare(
      "UPDATE matches SET home_odds = ?, draw_odds = ?, away_odds = ?, odds_updated_at = unixepoch() WHERE id = ?"
    ).bind(
      capOdds(homeSum / count),
      capOdds(drawSum / count),
      capOdds(awaySum / count),
      match.id
    ).run();
  }
}
