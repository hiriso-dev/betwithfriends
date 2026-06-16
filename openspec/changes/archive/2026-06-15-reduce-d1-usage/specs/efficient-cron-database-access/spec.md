## ADDED Requirements

### Requirement: Idle tick short-circuit
The system's every-minute scheduled job SHALL determine whether any work is needed (pre-game reminders pending, score sync due, or unscored bets on finished matches) using a single bounded, index-backed gate probe before running any heavier queries. When the gate probe returns no qualifying rows, the tick SHALL return without executing additional DB queries.

#### Scenario: No matches in pre-game window or sync range
- **WHEN** no match has `status = 'scheduled' AND reminders_done = 0 AND match_date <= now + 3600`
- **AND** no match has `last_api_sync_at IS NULL OR last_api_sync_at <= now - 50s` with `match_date` in the live/lookback window
- **AND** no finished match has any bet with `points_earned IS NULL`
- **THEN** the scheduled job SHALL complete without issuing further DB queries beyond the gate probe

#### Scenario: Gate probe finds a reminder candidate
- **WHEN** at least one scheduled match with `reminders_done = 0` falls within the 60-minute pre-game window
- **THEN** the gate probe SHALL return a qualifying row
- **AND** the tick SHALL proceed to run `sendPreGameReminders`

#### Scenario: Gate probe finds a sync-due tracked match
- **WHEN** at least one match has a numeric `api_match_id`, `match_date` within the live/lookback window, and `last_api_sync_at <= now - 50s`
- **THEN** the gate probe SHALL return a qualifying row
- **AND** the tick SHALL proceed to run `syncTrackedMatches`

---

### Requirement: Bounded gate probe query
The gate probe used in `hasMatchNeedingScoreSync` SHALL NOT use an ORDER BY clause. It SHALL use a `LIMIT 1` clause so the query planner can terminate at the first qualifying row. The probe SHALL cover both the date-window condition and the unscored-bets-on-finished-match condition in a single query.

#### Scenario: Probe terminates early on first match
- **WHEN** the first index entry scanned satisfies the gate probe predicate
- **THEN** the query SHALL return without scanning additional match rows

#### Scenario: Probe covers both sync conditions
- **WHEN** a finished match has unscored bets but no match is in the live/lookback date range
- **THEN** the gate probe SHALL still return a qualifying row
- **AND** `hasMatchNeedingScoreSync` SHALL return `true`

---

### Requirement: Partial index for unscored bets
The database schema SHALL include a partial index `idx_bets_unscored ON bets(match_id) WHERE points_earned IS NULL`. All correlated `EXISTS (SELECT 1 FROM bets WHERE match_id = ? AND points_earned IS NULL)` subqueries in the cron paths (`getDueTrackedMatches`, `hasPendingFinishedFinalization`, `finalizePendingFinishedMatches`, `processMatchResult`) SHALL be resolvable via this index without scanning scored-bet rows.

#### Scenario: Unscored-bets check after all bets scored
- **WHEN** all bets for a finished match have `points_earned` set (non-NULL)
- **THEN** `EXISTS (SELECT 1 FROM bets WHERE match_id = ? AND points_earned IS NULL)` SHALL return false without reading any heap rows for that match (only the (now-empty) partial index entries)

#### Scenario: Index present after schema reset
- **WHEN** the D1 schema is reset using `schema.sql`
- **THEN** the `idx_bets_unscored` index SHALL be present

---

### Requirement: Partial index for pre-game reminder candidates
The database schema SHALL include a partial index `idx_matches_reminder_candidates ON matches(match_date) WHERE status = 'scheduled' AND reminders_done = 0`. The `sendPreGameReminders` candidate query SHALL use this index for a bounded date-range scan, scanning only matches that are still scheduled, have not yet been flagged reminder-complete, and are within the pre-game window.

#### Scenario: Candidate query scans only unfinished-reminder scheduled matches
- **WHEN** 50 of 64 matches have `status = 'finished'` or `reminders_done = 1`
- **THEN** the pre-game reminder candidate query SHALL scan at most the remaining matches covered by the partial index — not all 64 rows

#### Scenario: Candidate query returns empty set outside any pre-game window
- **WHEN** no scheduled match with `reminders_done = 0` has `match_date <= now + 3600`
- **THEN** the candidate query SHALL return zero rows in an index range scan (not a full table scan)

---

### Requirement: Partial index for active matches
The database schema SHALL include a partial index `idx_matches_active ON matches(match_date) WHERE status != 'finished'`. The tracked-match date-window scan in `getDueTrackedMatches` SHALL use this index for the `match_date BETWEEN ? AND ?` range predicate, excluding already-finished matches from the index scan.

#### Scenario: Active-match window scan excludes finished matches
- **WHEN** 60 matches are `finished` and 4 are `scheduled` or `live`
- **THEN** the tracked-match range scan SHALL scan at most 4 index entries for the date-window predicate

---

### Requirement: Skip-if-unchanged match update
The score-sync path SHALL NOT issue a full multi-column `UPDATE matches SET … WHERE id = ?` when the incoming API data is identical to the stored values for the fields that affect scoring, display, or match identity (`status`, `home_score`, `away_score`, `final_home_score`, `final_away_score`, `score_duration`, `home_team`, `away_team`, `home_team_code`, `away_team_code`, `match_date`). When these fields are identical, the system SHALL issue only a narrow `UPDATE matches SET last_api_sync_at = unixepoch() WHERE id = ?` to advance the sync cooldown timer.

#### Scenario: Score and status unchanged between two consecutive syncs
- **WHEN** a live match is synced and no score or status change is returned by the API
- **THEN** the sync path SHALL issue only the narrow `last_api_sync_at` update
- **AND** no secondary index entries (`idx_matches_status`, `idx_matches_date`, `idx_matches_active`, `idx_matches_reminder_candidates`) SHALL be rewritten for that match row

#### Scenario: Status changes from live to finished
- **WHEN** the API returns `status = 'FINISHED'` for a match that was previously `live`
- **THEN** the full multi-column UPDATE SHALL be issued (the fields are not identical)
- **AND** `finalizeMatchIfReady` SHALL be called after the update

#### Scenario: Narrow update does not affect scoring
- **WHEN** only `last_api_sync_at` is updated for a match
- **THEN** `home_score`, `away_score`, and `status` SHALL retain their previous values
- **AND** any downstream scoring or notification logic that reads those fields SHALL see unchanged data

---

### Requirement: Indexes present after production migration
After the migration scripts are applied to production D1, `idx_bets_unscored`, `idx_matches_reminder_candidates`, and `idx_matches_active` SHALL all exist on the production database. These indexes SHALL be idempotent (`CREATE INDEX IF NOT EXISTS`) so re-running the migration script is safe.

#### Scenario: Migration script is run twice
- **WHEN** the index-creation migration script is executed a second time against the same D1 database
- **THEN** no error SHALL be raised and the indexes SHALL remain intact
