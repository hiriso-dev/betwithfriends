## 1. API Rate Limiting

- [x] 1.1 Create `worker/src/middleware/rate-limit.ts` with an in-memory sliding window class accepting limit and window-ms config
- [x] 1.2 Instantiate two rate limiters: `ipLimiter` (60 req/60 s) for unauthenticated routes and `userLimiter` (120 req/60 s) for authenticated routes
- [x] 1.3 Add `applyRateLimit(req, key, limiter)` helper that returns a 429 Response with `Retry-After: 60` when exceeded
- [x] 1.4 Wire `ipLimiter` into the auth handler (login, register, forgot-password, reset-password) before any DB access
- [x] 1.5 Wire `userLimiter` into the main router after JWT verification, using the authenticated user ID as key
- [x] 1.6 Add eviction logic: prune timestamps older than 60 s from each key's array on every check to bound memory growth

## 2. Knockout Stage Betting — Worker

- [x] 2.1 In `syncScores()`, extract the upsert-or-update logic: for each match returned by football-data.org, use `INSERT OR IGNORE` to create new rows and `UPDATE` to refresh existing ones (team names, score, status)
- [x] 2.2 Map football-data.org stage names for knockout rounds (e.g., `LAST_16` → "Round of 32", `QUARTER_FINALS` → "Quarter-Final", `SEMI_FINALS` → "Semi-Final", `THIRD_PLACE` → "Third-Place Play-off", `FINAL` → "Final") in the stage mapping object in `scores-sync.ts`
- [x] 2.3 Verify that `processMatchResult()` in `scoring.ts` already handles knockout matches correctly (it does — no changes needed, confirm with a test run)

## 3. Knockout Stage Betting — Frontend

- [x] 3.1 Update the fixtures page (`app/(app)/fixtures/page.tsx`) to group matches by stage: show group stage matches first (grouped by date), then add a separate section per knockout round
- [x] 3.2 Add a knockout round section header component (round name + match count) reusing existing dark-first Tailwind styles
- [x] 3.3 Verify match cards render correctly for knockout matches (TBD team names should display as "TBD" gracefully)

## 4. Match Bets View — Frontend

- [x] 4.1 Implement `app/(app)/matches/[id]/bets/page.tsx` — fetch from `GET /api/matches/:id/bets?group_id=` using `apiFetch`
- [x] 4.2 Render a list of group member bet rows: pseudo, home/away prediction, confidence emoji, double-up indicator, points earned (or "–" if pending), outcome badge (Exact / Correct / Wrong / Pending)
- [x] 4.3 Render a "No bet placed" section for members who did not bet
- [x] 4.4 Add a "Bets locked until kickoff" message when the page is accessed before match kickoff (handle the 403 response from the existing API)
- [x] 4.5 Add a link from match cards on the fixtures page to the match bets page (visible after kickoff, includes `group_id` param)

## 5. Bet History — Worker

- [x] 5.1 Add `GET /api/bets/history` route in `worker/src/index.ts`
- [x] 5.2 Create `worker/src/handlers/bet-history.ts` — authenticate user, accept `group_id` (optional), `limit` (default 50, max 100), `offset` (default 0) query params
- [x] 5.3 Write SQL query joining `bets` with `matches` and `groups` (via `group_members`) ordered by `match_date DESC` with LIMIT/OFFSET; include a COUNT(*) for total
- [x] 5.4 If `group_id` is provided, verify the user is a member of that group (return 403 otherwise) and add a WHERE clause

## 6. Bet History — Frontend

- [x] 6.1 Create `app/(app)/history/page.tsx` with title "Bet History"
- [x] 6.2 Fetch from `GET /api/bets/history` on mount; display group filter dropdown populated from the user's groups (`GET /api/groups`)
- [x] 6.3 Render a table/list of bet rows: match (home vs away), date, prediction, actual result, outcome badge, points
- [x] 6.4 Add "Load more" button that fetches the next page (offset-based) and appends results
- [x] 6.5 Add empty state: "No bets placed yet – go to Fixtures to place your first bet"
- [x] 6.6 Add `/history` link in the profile page or navigation

## 7. Live Score Ticker

- [x] 7.1 Create a `useLivePoll(matches, intervalMs)` custom React hook that returns a refetch function; starts a `setInterval` only when at least one match in the array has `status === 'live'`; clears interval on unmount
- [x] 7.4 Integrate the hook into the home page featured match component with the same 60 s interval
- [x] 7.5 Verify that an open BetSheet modal is not closed/reset when the background poll fires (no full re-render of parent that unmounts the modal)

## 8. Group Admin Tools — Worker

- [x] 8.1 Add `DELETE /api/groups/:id/members/:userId` route in `worker/src/index.ts`
- [x] 8.2 Implement handler in `worker/src/handlers/groups.ts`: verify caller is admin of `groupId`, verify target is a member, reject if caller is target, reject if target is also an admin
- [x] 8.3 Execute `DELETE FROM group_members WHERE group_id=? AND user_id=?` — the schema's `ON DELETE CASCADE` on `bets` will remove the member's bets automatically
- [x] 8.4 Return `{ success: true }` on success; appropriate 4xx errors for each failure case

## 9. Group Admin Tools — Frontend

- [x] 9.1 On the group detail page (`app/(app)/groups/[id]/page.tsx`), show a "Remove" button next to each non-admin member row when the current user is an admin
- [x] 9.2 Implement a confirmation dialog before removal ("Remove [pseudo] from this group? This cannot be undone.")
- [x] 9.3 Call `DELETE /api/groups/:id/members/:userId` via `apiFetch` on confirmation; on success, update the members list state to remove the entry

## 10. Verification

- [x] 10.1 Test rate limiting: send >60 unauthenticated requests from the same IP and verify 429 response
- [x] 10.2 Test knockout fixture upsert: run `syncScores()` and verify new knockout match rows are created without duplicates
- [x] 10.3 Test match bets view: verify the page shows bets after kickoff and returns 403 before kickoff
- [x] 10.4 Test bet history: verify pagination works and group filter returns only the correct bets
- [x] 10.5 Test live score ticker: verify the polling hook fires only when `status === 'live'` and stops otherwise
- [x] 10.6 Test group admin remove: verify non-admin cannot remove, admin cannot remove themselves, and bets cascade on removal
