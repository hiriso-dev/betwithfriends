## 1. Derive live-match data

- [x] 1.1 In `app/(app)/home/page.tsx`, add a derived `live` list: `matches.filter(m => m.status === "live")` (alongside the existing `upcoming` / `recentFinished` derivations).
- [x] 1.2 Confirm the existing 30s live poller already keeps `matches` fresh while any match is `live` — no new fetch or poller is added.

## 2. Render the "Live now" section

- [x] 2.1 In the `lg:col-span-2` main column, add a "Live now" section above the "🔒 Next bet locks in" countdown / "Next bet" CTA, rendered only when `live.length > 0`.
- [x] 2.2 For each live match, render a compact row showing both teams (`<Flag>` + team code) and a `● Live` indicator styled with the existing success colour.
- [x] 2.3 Render the current score via `getMatchScoreDisplay(m)` (already imported), using its pending indicator instead of `0 – 0` when no score has synced yet.
- [x] 2.4 Add the 👁 "see everyone's bets" control to each row: a button that calls `router.push(\`/matches/${m.id}/bets?group_id=${selectedGroup}\`)`, matching the match-card affordance.

## 3. Verify behaviour

- [x] 3.1 Verify the section appears only when a selected-group match is `live`, and hides when none are; switching groups updates the list.
- [x] 3.2 Verify the 👁 control navigates to the same bets page as the match-card eye control, scoped to the active group.
- [x] 3.3 Verify scores update on the next poll without a manual reload, and a match disappears from the section once it becomes `finished`.
- [x] 3.4 Run `npm run lint` (and a local dev check) to confirm no type/lint regressions in `home/page.tsx`.
