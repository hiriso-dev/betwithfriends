## Why

The D1 database is **3.8× over the daily rows-read limit (18.94M / 5M)** and **16.7× over rows-written (1.67M / 100k)** for the May 25 – June 25 window, which will throttle the app during the tournament. The dominant cost is the every-minute cron (`scheduled` in `worker/src/index.ts`): on all ~43,200 ticks/month it unconditionally runs gating queries with correlated `EXISTS` subqueries over `bets`/`matches` that lack partial indexes, and the score-sync path rewrites full `matches` rows (and all their index entries) every ~50s even when nothing changed. Almost all of this work happens during ticks where there is nothing to do.

## What Changes

- **Cheap, single-query tick gate**: Replace the two unconditional per-tick query paths with one bounded, index-backed "is there any work right now?" check. When there is no match in the pre-game window and nothing live/unscored, the tick reads a handful of rows and returns — instead of scanning `matches` and running correlated `bets` subqueries.
- **Partial / composite indexes** for the hot predicates the cron uses every tick:
  - `bets(match_id) WHERE points_earned IS NULL` — collapses the repeated "unscored bets exist?" `EXISTS` scans used in `getDueTrackedMatches`, `hasPendingFinishedFinalization`, and `processMatchResult`.
  - `matches(match_date) WHERE status = 'scheduled' AND reminders_done = 0` — turns the pre-game reminder candidate query into an index range scan instead of a status-index scan + filter.
  - `matches(status) WHERE status != 'finished'` (or equivalent) to back the tracked-match window query.
- **Stop rewriting unchanged match rows**: In `upsertMatchFromApiMatch`, skip the `UPDATE` (and its index churn) when the incoming score/status/teams are identical to what's stored; only bump `last_api_sync_at` cheaply (or via a narrow single-column update). This removes the bulk of the 1.67M rows-written.
- **Optional cron cadence reduction** for the no-live-match majority of the day (e.g. gate score-sync to when a match is actually in its live/lookback window), documented in design.
- **No change to user-visible notification behavior**: the pre-game reminder window semantics and at-most-one-delivery guarantees from `match-notifications` are preserved exactly; only the queries and indexes backing them change.

## Capabilities

### New Capabilities
- `efficient-cron-database-access`: Bounds the database work performed by the every-minute scheduled job — each tick MUST do index-backed, bounded work; idle ticks MUST short-circuit cheaply; and the score-sync path MUST NOT rewrite match rows whose data is unchanged. Defines the rows-read/rows-written efficiency requirements as observable, testable behavior.

### Modified Capabilities
<!-- None. The pre-game reminder window semantics, at-most-one-delivery, and result-notification eligibility defined in match-notifications are preserved unchanged; this change only alters the queries/indexes that implement them, not their required behavior. -->

## Impact

- **Code**: `worker/src/index.ts` (`scheduled`), `worker/src/services/scores-sync.ts` (`hasMatchNeedingScoreSync`, `getDueTrackedMatches`, `hasPendingFinishedFinalization`, `upsertMatchFromApiMatch`), `worker/src/services/push-service.ts` (`sendPreGameReminders` candidate query), `worker/src/services/scoring.ts` (unscored-bets queries).
- **Schema / DB**: new indexes in `worker/src/db/schema.sql`; a migration applied to local and `--remote` production D1.
- **Behavior preserved**: must not regress `match-notifications` guarantees or the reliable-scoring behavior; verified by existing scenarios plus before/after rows-read/written measurement from the Cloudflare D1 usage dashboard.
- **Dependencies**: none added.
