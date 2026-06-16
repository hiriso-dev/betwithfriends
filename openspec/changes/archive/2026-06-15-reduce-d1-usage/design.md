## Context

The every-minute cron (`scheduled` in `worker/src/index.ts`) fires ~43,200 times/month. On every tick it unconditionally runs two expensive DB paths regardless of whether there is anything to do:

1. **`sendPreGameReminders`** — queries `matches WHERE status = 'scheduled' AND reminders_done = 0 AND match_date <= now+3600`. The existing `idx_matches_status` index returns all scheduled matches (up to 64 during the WC group stage), then filters by `reminders_done` and `match_date` in memory. For each candidate match still inside the pre-game window, it runs two correlated `EXISTS` subqueries over `bets` and `notification_deliveries` per group member row. The `idx_bets_match` index covers `match_id` but does not filter `points_earned IS NULL`, so the subquery reads every bet row for the match.

2. **`hasMatchNeedingScoreSync`** — calls `getDueTrackedMatches(env, 1)`, which runs the full ORDER-BY-with-correlated-EXISTS query (correlated `EXISTS` in both WHERE and ORDER BY, evaluated for every candidate row) then falls through to `hasPendingFinishedFinalization` (a `JOIN matches m / bets b ON points_earned IS NULL` that again reads all bet rows for each finished match).

On a busy tournament day — 3–4 concurrent matches, 100+ bets per match — each tick can read thousands of rows across these paths × 43,200 ticks = the observed 18.94M rows-read.

**Rows-written (1.67M / 100k limit):** `upsertMatchFromApiMatch` issues a full 17-column `UPDATE matches SET … last_api_sync_at = unixepoch(), updated_at = unixepoch() WHERE id = ?` on every sync tick for every tracked match, whether or not any data changed. This rewrites the main row and all four secondary index entries (`idx_matches_status`, `idx_matches_date`, the UNIQUE `api_match_id` index, the primary key) on every 50-second refresh cycle — even when only the sync timestamp changed.

## Goals / Non-Goals

**Goals:**
- Reduce idle-tick DB reads to a single bounded index probe (≤ a handful of rows when nothing is active).
- Eliminate spurious match-row writes by skipping the full UPDATE when score/status/key fields are unchanged; bump only `last_api_sync_at` with a narrow single-column update.
- Add partial indexes so every hot `EXISTS` predicate (`points_earned IS NULL`, `status = 'scheduled' AND reminders_done = 0`) is resolved by an index lookup rather than a row scan.
- Preserve the full `match-notifications` behavioral contract (60-min pre-game window, at-most-one-delivery dedup, re-evaluation on every tick while kickoff is future).

**Non-Goals:**
- Changing cron frequency (wrangler.toml `* * * * *` stays).
- Reducing football-data.org API call counts (already well within the 10/min free tier).
- Rewriting the notification delivery logic or scoring algorithm.
- Adding application-level caching / KV.

## Decisions

### D1: Partial indexes for hot `EXISTS` predicates

**Decision:** Add three partial / filtered indexes to `schema.sql`:

```sql
-- 1. Makes all "any unscored bets?" EXISTS checks O(1) index lookups.
CREATE INDEX IF NOT EXISTS idx_bets_unscored
  ON bets(match_id) WHERE points_earned IS NULL;

-- 2. Makes the pre-game reminder candidate scan an index range scan over
--    only the active reminder candidates rather than all scheduled matches.
CREATE INDEX IF NOT EXISTS idx_matches_reminder_candidates
  ON matches(match_date) WHERE status = 'scheduled' AND reminders_done = 0;

-- 3. Backs the tracked-match window range scan for non-finished matches.
CREATE INDEX IF NOT EXISTS idx_matches_active
  ON matches(match_date) WHERE status != 'finished';
```

**Why partial over full indexes:** Full indexes on `bets(match_id)` already exist. The partial index `WHERE points_earned IS NULL` is smaller (it shrinks over the tournament as bets get scored) and is the exact filter the correlated subqueries use, so the lookup terminates at the index without touching the heap. SQLite (D1's engine) fully supports partial indexes via WHERE clauses.

**Alternatives considered:**
- *Denormalized `unscored_bet_count` counter on `matches`:* Accurate, but requires incrementing/decrementing on every bet write and score computation — adds write amplification and correctness surface. Rejected.
- *Application-level flag set after all bets scored:* Similar fragility. Rejected.

---

### Skip-if-unchanged update in `upsertMatchFromApiMatch`

**Decision:** Before the full UPDATE, fetch the existing row's volatile fields (`status`, `home_score`, `away_score`, `final_home_score`, `final_away_score`, `score_duration`, `home_team`, `away_team`, `match_date`). If all match the incoming API values, issue only a narrow `UPDATE matches SET last_api_sync_at = unixepoch() WHERE id = ?`. The narrow update touches one non-indexed column and does not rewrite any index entries.

The SELECT is already partially present (`SELECT id FROM matches WHERE id = ?`) — extend it to include the comparison fields.

**Why narrow update instead of skipping entirely:** `last_api_sync_at` is the cooldown timer that controls when a match is re-queried. It must be advanced on every sync to prevent `getDueTrackedMatches` from selecting the same match in the next tick.

**Why not a WHERE-clause guard on the UPDATE:** A `WHERE … AND status != ? AND …` guard means the UPDATE is a no-op when unchanged, but D1 still acquires and releases a write lock and the query planner still processes it. The extra SELECT + narrow update is measurably cheaper on D1 because a narrow single-column UPDATE on an unindexed column (`last_api_sync_at`) generates no index mutations.

---

### Lightweight gate probe for `hasMatchNeedingScoreSync`

**Decision:** Replace the `getDueTrackedMatches(env, 1)` call inside `hasMatchNeedingScoreSync` with a dedicated, no-ORDER-BY probe query:

```sql
SELECT 1 FROM matches
WHERE api_match_id GLOB '[0-9]*'
  AND (last_api_sync_at IS NULL OR last_api_sync_at <= ?)
  AND (
    match_date BETWEEN ? AND ?
    OR (status = 'finished'
        AND EXISTS (SELECT 1 FROM bets WHERE match_id = id AND points_earned IS NULL))
  )
LIMIT 1
```

No ORDER BY means SQLite stops at the first matching row without evaluating the sort expression (which contained the two correlated EXISTS). Combined with `idx_matches_active` and `idx_bets_unscored`, this probe reads at most one match index entry per tick.

**Alternatives considered:**
- *Keep calling `getDueTrackedMatches(env, 1)`:* Correct but wasteful — runs the full ORDER BY and double-EXISTS evaluation even for a boolean check.

---

### Pre-game reminder candidate query uses new partial index

The existing query in `sendPreGameReminders`:
```sql
SELECT id, home_team, away_team, match_date FROM matches
WHERE status = 'scheduled' AND reminders_done = 0 AND match_date <= ?
```
already has the exact partial index predicate (`status = 'scheduled' AND reminders_done = 0`). With `idx_matches_reminder_candidates ON matches(match_date) WHERE status = 'scheduled' AND reminders_done = 0`, this becomes a bounded range scan (≤ matches kicking off in the next hour, typically 0–3 rows). No query change needed.

## Risks / Trade-offs

- **Partial index syntax in D1 / SQLite:** D1 is SQLite 3.x; partial indexes (`CREATE INDEX … WHERE …`) are supported since SQLite 3.8.9. The D1 service runs SQLite ≥ 3.44 — no risk.
- **Stale rows if narrow-update path skips fields:** The narrow update path only runs when all volatile fields are identical to the incoming API values. If there is a discrepancy, the full UPDATE runs. The comparison must include every field that participates in scoring or display (`home_team`, `away_team`, `home_team_code`, `away_team_code`, `match_date`, `status`, `home_score`, `away_score`, `final_home_score`, `final_away_score`, `score_duration`). Static venue/stadium/stage columns are excluded from the comparison (they never change after seeding and do not affect scoring). → Mitigation: unit test covering both branches.
- **Schema migration on production D1:** `CREATE INDEX IF NOT EXISTS` is idempotent. The migration can be run with `wrangler d1 execute --remote` with zero downtime; indexes are built online by SQLite. → No rollback required; if `IF NOT EXISTS` is respected, re-running is safe.
- **Reads-written budget still high from other paths (frontend API):** The `/api/matches`, `/api/standings`, `/api/groups/:id/members` handlers make multi-join reads on every page load; these are not addressed here. If the free tier is still exceeded after this change, the next step is KV caching for standings/leaderboards (tracked in `future-enhancements-roadmap`).

## Migration Plan

1. Apply new indexes to local D1:
   ```bash
   npx wrangler d1 execute betwithfriends --config worker/wrangler.toml \
     --command "CREATE INDEX IF NOT EXISTS idx_bets_unscored ON bets(match_id) WHERE points_earned IS NULL;
                CREATE INDEX IF NOT EXISTS idx_matches_reminder_candidates ON matches(match_date) WHERE status = 'scheduled' AND reminders_done = 0;
                CREATE INDEX IF NOT EXISTS idx_matches_active ON matches(match_date) WHERE status != 'finished';"
   ```
2. Apply to production D1 (same command, `wrangler.production.toml`, `--remote`).
3. Update `schema.sql` with the three `CREATE INDEX IF NOT EXISTS` statements so future resets include them.
4. Deploy worker code changes (`upsertMatchFromApiMatch` skip-if-unchanged, `hasMatchNeedingScoreSync` lightweight probe).
5. Monitor D1 usage dashboard after 24h for rows-read and rows-written reduction.

**Rollback:** No data is mutated. Dropping the three indexes (`DROP INDEX IF NOT EXISTS …`) restores previous behavior.

## Open Questions

- None blocking implementation.
