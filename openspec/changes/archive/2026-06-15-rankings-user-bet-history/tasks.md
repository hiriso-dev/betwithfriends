## 1. Backend — generalize `/api/bets/history`

- [x] 1.1 In `worker/src/handlers/bet-history.ts`, read optional `user_id` from query params; treat absent/own as current self behavior.
- [x] 1.2 When `user_id` is present and ≠ caller, require `group_id` (return 400 if missing).
- [x] 1.3 Verify the target `user_id` is a member of `group_id` (in addition to the existing caller-membership check); return 403 otherwise.
- [x] 1.4 Target the query at the requested user (`b.user_id = <target>`); when target ≠ caller, add kickoff gate `AND m.match_date <= unixepoch()` to both the data and count queries.
- [x] 1.5 Resolve and return the target's `pseudo` (independent of whether any bets exist) alongside `bets` and `total`.

## 2. Frontend — generalize the history page

- [x] 2.1 In `app/(app)/history/page.tsx`, read optional `user_id` from the query string (alongside existing `group_id`).
- [x] 2.2 When `user_id` is set, pass `&user_id=` on the fetch and lock to the scoped `group_id` (hide the All-groups / multi-group switcher).
- [x] 2.3 When viewing another user, title the header with the returned `pseudo` (e.g. "{pseudo}'s bets") instead of "Bet History".
- [x] 2.4 Confirm the existing row rendering (predicted score, actual score via `getMatchScoreDisplay`, outcome label, points, "load more") works unchanged for the target user.

## 3. Frontend — make rankings rows tappable

- [x] 3.1 In `app/(app)/rankings/page.tsx`, change each member row to an interactive control (button) that navigates to `/history?user_id=<m.user_id>&group_id=<selectedGroupId>`.
- [x] 3.2 Preserve current row styling/medals/is-me highlight and add an affordance (e.g. hover/active state, chevron) indicating the row is tappable.

## 4. Verify

- [x] 4.1 Tapping another member shows their full history newest-first with bet vs. actual scores and points; "load more" reveals older bets.
- [x] 4.2 Another member's predictions for matches that have not kicked off are not present in the response.
- [x] 4.3 Tapping own row shows own full history (including upcoming bets); requesting a non-shared group/target returns 403.
