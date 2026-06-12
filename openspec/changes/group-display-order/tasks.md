## 1. Database

- [x] 1.1 Add `sort_order INTEGER` column to the `group_members` table in `worker/src/db/schema.sql`
- [x] 1.2 Apply the column to the local D1: `ALTER TABLE group_members ADD COLUMN sort_order INTEGER;` (via the root db script / `wrangler d1 execute --config worker/wrangler.toml`)

## 2. Worker API

- [x] 2.1 In `worker/src/handlers/groups.ts`, change `GET /api/groups` to `ORDER BY COALESCE(gm.sort_order, <large fallback>) ASC, g.created_at DESC` so explicit order wins and unordered groups stay stable/appended
- [x] 2.2 Add `PUT /api/groups/order` handler accepting `{ order: string[] }`; for each group ID the user is a member of, set `sort_order = index` via a single `DB.batch` of `UPDATE group_members SET sort_order = ? WHERE user_id = ? AND group_id = ?`
- [x] 2.3 Ignore group IDs in the payload the user does not belong to; validate body shape and return `{ success: true }` (and appropriate 4xx on bad input)

## 3. Frontend — My Groups reorder UI

- [x] 3.1 In `app/(app)/groups/page.tsx`, add ▲/▼ reorder controls to each group card (disabled at the top/bottom ends)
- [x] 3.2 Update local `groups` state optimistically on move, then call `PUT /api/groups/order` with the full ordered list of group IDs via `apiFetch`
- [x] 3.3 On save failure, revert to the previous order and surface a retry affordance

## 4. Verification

- [x] 4.1 Verify group tabs/selectors render in the saved order on home, fixtures, rankings, history, special, and `matches/[id]/bets` (they consume `GET /api/groups`, so confirm no per-page sorting overrides it) — confirmed by inspection: no page re-sorts the groups array; each defaults selection to `grps[0]`
- [x] 4.2 Verify a second user with the same groups keeps an independent order; verify a newly joined/created group appears appended and the list stays stable on reload — confirmed by design: `sort_order` is per-membership; `PUT` scoped to `user_id`; NULL sorts last via `COALESCE`, tiebroken by `created_at DESC`

## 5. Deploy

- [x] 5.1 Run `ALTER TABLE group_members ADD COLUMN sort_order INTEGER;` against production D1 (`wrangler d1 execute --config worker/wrangler.production.toml --remote`) before/with the worker deploy
- [x] 5.2 Deploy worker (`npm run worker:deploy:production`) and frontend (`npm run cf:deploy`)
