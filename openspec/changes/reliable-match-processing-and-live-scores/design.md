## Context

The current match lifecycle is optimized for World Cup fixture discovery, not for reliable end-to-end match processing. The worker cron only starts football-data.org polling after a match could already be over, and the scheduled path uses a World Cup competition feed by default. That means a tracked match from another competition, such as `552096`, can stay stale in the database even though the external API already reports `FINISHED`.

This stale match state cascades into the rest of the product. The frontend already polls match data while matches are live, but it can only show what the worker has persisted. Result notifications depend on `points_earned` being populated, and `processMatchResult()` only runs when the persisted row transitions to a finished state with scores. The current schema also only stores a single score pair, which is not enough to show both the regular-time score used for betting and the actual final score after extra time or penalties.

## Goals / Non-Goals

**Goals:**
- Refresh tracked matches through scheduled, live, and finished states even when they do not belong to the World Cup bulk-sync path.
- Keep football-data.org usage within the 10-calls-per-minute limit while prioritizing live and recently finished matches.
- Make finalization idempotent so missed sync ticks can still update scores, compute points, and send result notifications later.
- Persist enough score metadata to score on regular time while showing the real final result in the UI and notifications.
- Keep fixtures and home page live views current without introducing user-visible reloads or resetting betting UI state.

**Non-Goals:**
- Goal-by-goal push notifications or websocket streaming.
- Replacing football-data.org as the score source.
- Changing the betting rules, confidence modifiers, or double-up scoring model.
- Building a global cross-competition fixture discovery system beyond the matches already tracked by the app.

## Decisions

### D1. Add a tracked-match sync pass that refreshes matches by `api_match_id`

The worker will add a new scheduled sync pass that selects tracked matches from D1 when they are within an active lifecycle window, then fetches football-data.org `/matches/{api_match_id}` for each due row.

Selection rules:
- include matches from shortly before kickoff through a recent post-match window
- prioritize rows that are already `live`, rows whose kickoff has passed but are not terminal, and rows that still have unresolved bet scoring
- cap the number of external calls per cron tick so the worker stays within the 10-calls-per-minute limit

Alternatives considered:
- Keep using only `/competitions/WC/matches`: rejected because it cannot finalize tracked non-WC matches like `552096`.
- Store `competition_code` and poll one bulk endpoint per competition: rejected because it adds schema and orchestration complexity while the app only needs a handful of active match refreshes at a time.
- Trigger football-data.org fetches from user page requests: rejected because user traffic would directly drive third-party API usage and make delivery nondeterministic.

Rationale: the tracked-match pass fixes the concrete failure mode with the smallest reliable abstraction. Once a match exists in D1, it can be refreshed and finalized regardless of competition.

### D2. Keep `home_score` / `away_score` as the canonical betting score and add explicit final-score fields

The matches table will keep `home_score` and `away_score` as the canonical score used by scoring and bet evaluation once a match is finished. New fields will store the displayed real final result when it differs from the betting score:
- `final_home_score`
- `final_away_score`
- `score_duration` (for example `REGULAR`, `EXTRA_TIME`, `PENALTY_SHOOTOUT`)
- `last_api_sync_at` to enforce per-row refresh cadence

For live matches, `home_score` / `away_score` continue to hold the latest live score. When a match finishes, the worker persists the regular-time score into those canonical fields and persists the actual final outcome separately when extra time or penalties occurred.

Alternatives considered:
- Repurpose `home_score` / `away_score` to store the actual final result and add new scoring-only columns: rejected because every existing scoring, standings, and notification consumer would need to be inverted.
- Store the football-data score payload as JSON only: rejected because D1 queries and TypeScript payloads would become harder to reason about and validate.

Rationale: additive schema changes preserve current consumers while making the regular-time-versus-final distinction explicit.

### D3. Finalization becomes an explicit idempotent step

The worker will extract a dedicated finalization path, for example `finalizeMatchIfReady(env, match)`, that runs after every successful sync update and in a catch-up sweep for any finished match whose bets still have `points_earned IS NULL`.

Finalization rules:
- only run when the persisted match is terminal and the canonical betting score is present
- compute unresolved bet points exactly once
- update group totals only once per unresolved bet row
- send result notifications only after points are available

Alternatives considered:
- Keep finalization inline inside the sync loop: rejected because the current `justFinished` branching is harder to reuse for missed transitions and catch-up processing.
- Recompute all bets for every finished match on every cron tick: rejected because it is unnecessary write churn and makes duplicate notification prevention harder.

Rationale: idempotent finalization isolates the business rule that matters most and gives the worker a clear repair path when a match was missed earlier.

### D4. Result notifications are generated from persisted resolved state, not raw API responses

Pre-game reminders remain DB-driven, but result notifications will be built from the persisted match row after finalization completes. Notification bodies will show the regular-time score first and, when `score_duration` indicates extra time or penalties, append the actual final result in parentheses.

Alternatives considered:
- Send result notifications directly from the football-data response before D1 is updated: rejected because points and user summaries could still be stale.
- Leave notification text unchanged: rejected because a penalty shootout match would appear scored on one result but displayed on another.

Rationale: the notification copy should match the exact resolved state users see in the app.

### D5. Keep client polling, but unify it around backend freshness and dual-score rendering

The fixtures and home page will continue polling the worker while a visible match is live. The contract changes are:
- page-level polling runs every 30 seconds while a live match is rendered
- polling stops when no rendered match is live
- UI components render the canonical betting score as the main score and append the real final score in parentheses when it differs
- polling updates must not close the existing bet sheet or reset in-progress edits

Alternatives considered:
- SSE or websockets: rejected because they add infrastructure and do not solve the actual stale-source problem.
- No frontend polling changes: rejected because the home page still lags behind the fixtures page today.

Rationale: the backend refactor fixes correctness; lightweight client polling keeps the experience responsive without new infrastructure.

## Risks / Trade-offs

- [More per-match API calls during active windows] -> Mitigation: select due rows by priority, cap external fetches per tick, and keep `syncScorers()` throttled separately.
- [Schema migration drift between local and production D1] -> Mitigation: update both `worker/src/db/schema.sql` and `worker/src/db/reset-and-seed.sql`, then apply the remote D1 migration before deploy.
- [Score presentation may confuse users after extra time or penalties] -> Mitigation: label the parenthesized value as the real final result and keep regular-time score styling consistent across UI and notifications.
- [Tracked non-WC matches still need to exist in D1 before they can be refreshed] -> Mitigation: preserve the existing admin/manual sync path for match seeding; once a row exists, the new tracked-match pass keeps it current.

## Migration Plan

1. Add the new score metadata and sync-timestamp columns to the matches schema and seed SQL.
2. Deploy the worker changes first so new fields are populated before the frontend depends on them.
3. Run a one-time catch-up sync for unresolved recent matches so previously missed finished matches can compute points and send result notifications.
4. Deploy the frontend score presentation changes for fixtures, home, and match cards.
5. Roll back by reverting the frontend score rendering and worker sync changes together; the additive schema fields can remain in place safely.

## Open Questions

- Should the home page use the same 30-second live refresh cadence as fixtures, or remain at 60 seconds to reduce worker traffic? Current recommendation: unify both to 30 seconds because worker traffic, not football-data traffic, is the only added cost.
- Do we want an admin-only single-match resync endpoint for operational repair, or is the scheduled catch-up path sufficient? Current recommendation: keep this as a follow-up unless production incidents repeat after the refactor.