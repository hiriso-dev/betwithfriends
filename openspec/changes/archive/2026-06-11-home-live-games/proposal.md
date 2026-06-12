## Why

When matches are in progress, the home dashboard gives no quick way to follow them or to peek at how the rest of the group bet. Users have to navigate to `/fixtures`, find the match, and tap the 👁 control. During the most engaging moment of the tournament — a game actually being played — the home page should surface those live games front and centre so friends can watch the score move and instantly compare everyone's predictions.

## What Changes

- Add a **"Live now"** section to the home dashboard listing every match currently in progress for the selected group (matches whose status is `live`).
- Each live game row shows the two teams (flags + codes), the current live score, and a `● Live` indicator, mirroring the existing live styling.
- Each row exposes the existing 👁 "see everyone's bets" affordance, navigating to the match's bets page (`/matches/[id]/bets?group_id=…`) for the active group — the same destination as the match-card eye control.
- The section is placed near the top of the main column (above the "Next bet" CTA) and is shown only when at least one live match exists; otherwise it is not rendered.
- The section refreshes in step with the existing home live-score poller (every 30s while any match is live), so scores update without a manual reload.

## Capabilities

### New Capabilities
- `home-live-games`: The home dashboard's "Live now" section — when it appears, which matches it lists, what each row shows, the 👁 affordance to view group members' bets, and its live-refresh behaviour.

### Modified Capabilities
<!-- The eye affordance and bets-page behaviour are unchanged; this change reuses bet-visibility's existing requirements rather than modifying them. -->

## Impact

- **Code**: `app/(app)/home/page.tsx` — add the "Live now" section and derive the live-match list from already-fetched `matches`. No new API calls; reuses the existing `GET /api/matches?group_id=` data and the existing 30s live poller.
- **Reuses**: the `bet-visibility` capability (👁 control → `/matches/[id]/bets`) and `match-score-display` helpers (`getMatchScoreDisplay`) already used by the match card and bets page.
- **No backend changes**: no new routes, schema, or worker logic. The `status === "live"` flag is already synced by the score-sync cron.
