## 1. Fix countdown computation

- [x] 1.1 In [app/(app)/home/page.tsx](app/(app)/home/page.tsx), change `nextMatchLock` to derive from `nextUnbet` instead of `upcoming[0]` — i.e. `const nextMatchLock = nextUnbet ? nextUnbet.match_date * 1000 - BET_LOCK_MS : Infinity;` (drop the now-unused `upcoming.length > 0` guard).
- [x] 1.2 Confirm `nextDeadlineMs = Math.min(specialsDeadline, nextMatchLock)` and `isSpecialDeadline` still resolve correctly when `nextMatchLock` is `Infinity` (all upcoming matches bet), so the section hides via the existing `nextDeadlineMs < Infinity && msUntilClose > 0` render guard.

## 2. Verify consistency

- [x] 2.1 Verify the countdown's match label (`featured.home_team vs featured.away_team`) and click target (`setBetTarget(featured)`) reference the same un-bet match the countdown now tracks.
- [x] 2.2 Verify the special-bets branch is unaffected: when the specials deadline is sooner, the section still shows "⭐ Special bets close in" and links to `/special`.

## 3. Validate

- [x] 3.1 Manually check the three cases: (a) next upcoming match already bet → countdown targets the later un-bet match; (b) no upcoming match bet → countdown targets the next match (unchanged); (c) all upcoming matches bet, no specials pending → countdown section hidden.
- [x] 3.2 Run `npm run lint` (and type-check) to confirm no unused-variable or type errors from the change.
