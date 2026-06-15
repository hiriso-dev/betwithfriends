## Context

The app already has:
- `/api/bets/history` (`worker/src/handlers/bet-history.ts`) — returns the **caller's own** bets joined with match data (predicted scores, actual scores, `points_earned`, status, stage), newest match first, paginated via `limit`/`offset`, optionally filtered by `group_id`.
- `/history` page (`app/(app)/history/page.tsx`) — renders that data with per-bet outcome labels and points; already does "load more" paging.
- Rankings page (`app/(app)/rankings/page.tsx`) — lists group members with `user_id`, `pseudo`, points; rows are currently non-interactive `<div>`s.
- `bet-visibility` spec — other members' predictions are only revealed once a match's kickoff has passed.

So the request ("click a player → see all their games with bet vs. real score") is mostly a matter of generalizing existing pieces to a target user, while respecting bet-visibility.

## Goals / Non-Goals

**Goals:**
- Tap any rankings row to open that member's full bet history for the active group.
- Reuse the existing bet-row rendering (predicted vs. actual score, outcome, points) rather than building a new list format.
- Enforce that a non-self target's not-yet-started predictions are not leaked.

**Non-Goals:**
- No cross-group "all groups" aggregation when viewing another member (history of another member is always scoped to one shared group).
- No new charts/statistics; this is a list view only.
- No schema changes.

## Decisions

### Decision: Extend `/api/bets/history` with an optional `user_id` rather than a new endpoint
The query and shape are identical; only the `WHERE b.user_id` target and visibility gating differ.

- When `user_id` is absent or equals the caller → current behavior (all of caller's bets, including upcoming).
- When `user_id` is present and ≠ caller:
  - `group_id` becomes **required** (visibility is always group-scoped).
  - Verify the **caller** is a member of `group_id` (already done) **and** the target `user_id` is a member of the same group; otherwise `403`.
  - Add a kickoff gate to the data + count queries: `AND m.match_date <= unixepoch()` so only started matches' predictions are returned.
  - Include the target's `pseudo` in the response so the page can title the view.

Alternative considered: a dedicated `/api/users/:id/bets` endpoint — rejected as duplicative of the existing handler and its pagination.

### Decision: Reuse the `/history` page, parameterized by `user_id`
Add an optional `user_id` (and require `group_id`) read from the query string. When present:
- Fetch with `&user_id=...`.
- Title the header with the target pseudo (returned by the API) instead of "Bet History".
- Lock the group filter to the scoped group (hide the "All groups" / multi-group switcher), since other members' history is single-group only.

Rankings rows become `<button>`s that `router.push(\`/history?user_id=${m.user_id}&group_id=${selectedGroupId}\`)`. Tapping own row works the same (self path ignores the gate).

Alternative considered: a separate `/rankings/[userId]` route — rejected to avoid duplicating the ~150-line list/paging/outcome rendering already in `/history`.

### Decision: Keep visibility logic in the backend
The kickoff gate is enforced in SQL, not the client, so predictions for upcoming matches are never sent to a non-owner. This mirrors how the per-match bets page is gated.

## Risks / Trade-offs

- [Reusing `/history` changes a shared page] → Guard all new behavior behind the presence of `user_id`; default (self) rendering is unchanged.
- [Target pseudo must come from the API] → Return it alongside `bets`/`total`; if the target has zero visible bets, still return the pseudo so the header and empty state read correctly (resolve pseudo via a `users`/`group_members` lookup independent of whether bets exist).
- [Privacy regression] → Covered by the modified `bet-visibility` spec scenarios; the gate plus the target-membership check prevent leaking upcoming or out-of-group predictions.

## Migration Plan

Pure additive change — deploy worker then frontend. No data migration. Rollback is reverting both deploys; the extra `user_id` param is ignored by the old client.
