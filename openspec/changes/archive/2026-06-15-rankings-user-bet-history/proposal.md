## Why

The home dashboard shows only the last 3 "recent results", and the existing bet-history view (`/history`) is limited to the signed-in user's own bets. From the rankings list a player can see who is winning but cannot inspect *how* a rival earned their points. Letting members tap any player in the rankings to browse that player's full betting record (predicted vs. actual score, points per game) makes the competition more transparent and engaging.

## What Changes

- Rankings rows become tappable: tapping a member opens that member's full bet history for the active group.
- The bet-history view is generalized to render **any** group member's bets (not just the caller's), newest match first, with predicted score, actual score, outcome label, and points per bet — the same row format already used for the personal history, but for the whole season rather than the last 3 results.
- The `/api/bets/history` endpoint accepts an optional `user_id` to fetch another member's history, scoped to a shared group, and **honors bet-visibility**: for a member other than the caller, predictions for matches that have not yet kicked off are hidden.

## Capabilities

### New Capabilities
- `user-bet-history`: Viewing any group member's complete bet history (predicted vs. actual score and points per match, newest first, paginated) reached by tapping a player in the rankings.

### Modified Capabilities
- `bet-visibility`: Extend the kickoff-gated visibility rule to the bet-history listing so another member's not-yet-started predictions stay hidden there too.

## Impact

- Frontend: `app/(app)/rankings/page.tsx` (make rows tappable), the bet-history page (`app/(app)/history/page.tsx`) generalized to accept a `user_id` and target pseudo, or a thin new route that reuses the same list rendering.
- Backend: `worker/src/handlers/bet-history.ts` — optional `user_id` param with shared-group membership check and kickoff gating.
- No schema changes; reuses existing `bets`/`matches`/`groups` tables and the rankings membership data.
