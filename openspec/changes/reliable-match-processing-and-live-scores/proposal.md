## Why

The recent failure around match `552096` exposed that match lifecycle automation is not reliable enough: live scores did not refresh, the match did not finalize in the app, points were not computed, and neither pre-game nor post-game notifications were delivered. When sync, scoring, and notifications all depend on the same brittle path, one missed match update leaves the whole experience stale and untrustworthy.

## What Changes

- Refactor match syncing so tracked matches are refreshed from the correct football-data.org source for their actual lifecycle, instead of relying on a World Cup-only bulk polling path.
- Poll actively tracked matches more aggressively within the 10-calls-per-minute API budget, so live matches and recently finished matches update promptly.
- Add a recovery path for missed transitions so a match that reaches `FINISHED` still updates scores, computes points, and triggers result notifications even if an earlier poll was missed.
- Separate the score used for betting resolution from the score shown as the real final result, so points continue to use regular time while extra-time or penalty outcomes can still be displayed to users.
- Tighten notification delivery rules so pre-game reminders and post-result notifications are sent exactly once for eligible users when the underlying match state is current.
- Update the frontend match presentation to keep live scores fresh and show the real final score in parentheses when it differs from the regular-time scoring result.

## Capabilities

### New Capabilities

- `reliable-match-processing`: Keep tracked matches synchronized through scheduled, live, and finished states across supported competitions; compute bets from regular-time scores; recover missed finalization; and trigger downstream scoring and result processing from the persisted match state.
- `match-score-display`: Refresh in-progress match scores in the app while a game is live, and display the real post-extra-time or post-penalty final result alongside the regular-time score used for betting.
- `match-notifications`: Deliver pre-game reminders and result notifications from the current persisted match lifecycle, ensuring each eligible user receives at most one reminder and one result notification per match.

### Modified Capabilities

<!-- No existing capability specs exist yet. No modifications. -->

## Impact

- Worker services in `worker/src/services/scores-sync.ts`, `worker/src/services/scoring.ts`, and `worker/src/services/push-service.ts`
- Worker scheduled flow in `worker/src/index.ts`
- Match API payloads from `worker/src/handlers/matches.ts`
- Match persistence in `worker/src/db/schema.sql` and `worker/src/db/reset-and-seed.sql` if additional score or sync metadata is required
- Frontend match surfaces in `components/match-card.tsx`, `app/(app)/fixtures/page.tsx`, and `app/(app)/home/page.tsx`
- No new external services are required; the refactor stays within the existing football-data.org and Web Push integrations