## Why

On the home dashboard, the "🔒 Next bet locks in" countdown is driven by the next scheduled match's kickoff — even when the user has already placed a bet on that match. The countdown therefore ticks toward a match the user no longer needs to act on, and it disagrees with the featured card below it (which already targets the next *un-bet* match). The countdown should reflect the next bet the user still needs to place.

## What Changes

- The "🔒 Next bet locks in" countdown is computed from the next **un-bet** upcoming match (the first scheduled match the user has no bet on) instead of the next upcoming match overall.
- When every upcoming match is already bet, the match-lock deadline no longer contributes to the countdown (the section hides unless a specials deadline is still pending).
- The countdown's match label/target and its click-through stay consistent with the featured card (both reference the next un-bet match).
- Special-bets deadline behaviour is unchanged.

## Capabilities

### New Capabilities
- `home-bet-countdown`: The home dashboard's "next bet locks in" countdown, including which deadline it tracks (next un-bet match lock vs. special-bets close) and when it is shown or hidden.

### Modified Capabilities
<!-- None — no existing spec defines this behaviour. -->

## Impact

- `app/(app)/home/page.tsx` — countdown computation (`nextMatchLock`, `nextDeadlineMs`, `isSpecialDeadline`) and the countdown button's target.
- No API, schema, or backend changes. Pure frontend display fix.
