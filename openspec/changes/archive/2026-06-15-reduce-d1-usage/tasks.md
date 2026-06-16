## 1. Schema — Add Partial Indexes

- [x] 1.1 Add `idx_bets_unscored ON bets(match_id) WHERE points_earned IS NULL` to `worker/src/db/schema.sql`
- [x] 1.2 Add `idx_matches_reminder_candidates ON matches(match_date) WHERE status = 'scheduled' AND reminders_done = 0` to `worker/src/db/schema.sql`
- [x] 1.3 Add `idx_matches_active ON matches(match_date) WHERE status != 'finished'` to `worker/src/db/schema.sql`
- [x] 1.4 Apply all three indexes to local D1 (`npm run db:migrate` or `wrangler d1 execute … --command "CREATE INDEX IF NOT EXISTS …"`)

## 2. scores-sync.ts — Lightweight Gate Probe

- [x] 2.1 Replace the `getDueTrackedMatches(env, 1)` call inside `hasMatchNeedingScoreSync` with a dedicated no-ORDER-BY probe query (single `SELECT 1 … LIMIT 1`) that covers both the date-window and unscored-finished-match conditions
- [x] 2.2 Keep `hasPendingFinishedFinalization` reachable only when the probe already returned true (merge the two conditions into the single probe query rather than falling through)

## 3. scores-sync.ts — Skip-If-Unchanged Match Update

- [x] 3.1 In `upsertMatchFromApiMatch`, extend the existing-row fetch from `SELECT id` to also select the volatile fields: `status`, `home_score`, `away_score`, `final_home_score`, `final_away_score`, `score_duration`, `home_team`, `away_team`, `home_team_code`, `away_team_code`, `match_date`
- [x] 3.2 Compare all fetched fields against the incoming API values (using the same `mapStatus` / `getStoredMatchScores` results)
- [x] 3.3 If all fields are identical, issue only `UPDATE matches SET last_api_sync_at = unixepoch() WHERE id = ?` and return early
- [x] 3.4 If any field differs, proceed with the existing full multi-column UPDATE (no change to the UPDATE statement itself)

## 4. Apply Indexes to Production D1

- [x] 4.1 Run the three `CREATE INDEX IF NOT EXISTS` statements against production D1 using `wrangler d1 execute betwithfriends --config worker/wrangler.production.toml --remote --command "…"`
- [x] 4.2 Verify indexes exist with `wrangler d1 execute … --remote --command "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"`

## 5. Deploy and Verify

- [x] 5.1 Deploy updated worker (`npm run worker:deploy:production`)
- [x] 5.2 Monitor Cloudflare D1 usage dashboard after 24h for reduction in rows-read and rows-written
- [x] 5.3 Verify pre-game reminders still fire correctly for the next scheduled match (check `wrangler tail` for `pregame_tick` log entries)
