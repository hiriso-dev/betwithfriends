## 1. Match Schema And Types

- [x] 1.1 Add additive match columns for `final_home_score`, `final_away_score`, `score_duration`, and `last_api_sync_at` in `worker/src/db/schema.sql` and `worker/src/db/reset-and-seed.sql`
- [x] 1.2 Update worker and frontend match types so `/api/matches` can carry the new final-score metadata without breaking existing consumers
- [x] 1.3 Ensure existing rows remain valid when the new fields are null and define the fallback behavior for regular-time-only matches

## 2. Tracked Match Sync

- [x] 2.1 Add a due-match selector in `worker/src/services/scores-sync.ts` that chooses tracked rows in active lifecycle windows and limits football-data.org calls per cron tick
- [x] 2.2 Implement per-match football-data.org refresh by `api_match_id` for due rows, independent of the World Cup competition feed
- [x] 2.3 Preserve or refactor the existing bulk World Cup sync only for fixture discovery and low-priority backfill so the main tournament flow still works
- [x] 2.4 Persist live scores, regular-time finished scores, actual final scores, and `last_api_sync_at` consistently from the football-data response

## 3. Finalization And Notifications

- [x] 3.1 Extract an idempotent finalization helper that computes unresolved bet points and group totals once a match is ready to resolve
- [x] 3.2 Invoke the finalization helper from the tracked-match sync path and from a catch-up pass for finished matches with unresolved bets
- [x] 3.3 Update result-notification payload generation to show the regular-time resolved score and append the real final score when it differs
- [x] 3.4 Review and tighten pre-game reminder retry and dedupe behavior so temporary delivery failures remain retryable but successful sends stay one-per-user-per-match

## 4. Match API And Frontend Presentation

- [x] 4.1 Extend `worker/src/handlers/matches.ts` so match responses include the new final-score metadata fields
- [x] 4.2 Update `components/match-card.tsx` to render the primary regular-time score plus parenthesized real final score when applicable
- [x] 4.3 Update `app/(app)/fixtures/page.tsx` and `app/(app)/home/page.tsx` to use the finalized live-refresh cadence and keep live score polling from resetting active betting UI state
- [x] 4.4 Update any finished-score summaries, result badges, and recent-results UI to remain aligned with regular-time scoring semantics

## 5. Verification And Rollout

- [x] 5.1 Verify that match `552096` or an equivalent non-World-Cup finished match is refreshed, finalized, and scored correctly from the new tracked-match sync path
- [x] 5.2 Verify that a match ending after extra time or penalties computes points from regular time while displaying the real final score in parentheses
- [ ] 5.3 Verify that eligible users receive one pre-game reminder and one post-result notification, with temporary push failures retrying without duplicates
- [ ] 5.4 Apply the D1 schema migration, run a one-time catch-up sync for unresolved recent matches, and deploy worker changes before frontend changes
