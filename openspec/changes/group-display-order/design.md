## Context

Group tabs are rendered across the app from a single source: `GET /api/groups` in `worker/src/handlers/groups.ts`, which today sorts `ORDER BY g.created_at DESC`. The frontend pages (`home`, `fixtures`, `rankings`, `history`, `special`, `matches/[id]/bets`, and the `groups` list) all `groups.map(...)` over that response, so changing the order at the source changes it everywhere.

Membership is modeled in `group_members`, keyed by `UNIQUE(group_id, user_id)`, already holding per-user/per-group state (`pseudo`, `is_admin`, `total_points`). The ordering is inherently per-user, so it belongs on this row rather than on `groups`.

There is no migrations framework in this project: `worker/src/db/schema.sql` is the canonical schema (re-applied via `npm run db:init`, idempotent with `IF NOT EXISTS`), and `reset-and-seed.sql` rebuilds local data. Schema changes to an existing database are applied with an explicit `ALTER TABLE` via `wrangler d1 execute`.

## Goals / Non-Goals

**Goals:**
- Per-user ordering of the user's own groups, persisted server-side.
- Reorder UI lives on the My Groups screen (`/groups`).
- A single source of truth (`GET /api/groups`) so all tab/selectors inherit the order with zero per-page logic.
- Backward compatible: with no custom order, behavior matches today (deterministic, stable).

**Non-Goals:**
- Global/group-wide ordering shared across members.
- Reordering anything other than groups (e.g. fixtures, members).
- Drag-and-drop is optional; up/down controls are sufficient to satisfy the spec.
- Changing what the group tabs themselves contain.

## Decisions

### Decision: Store order as `sort_order` on `group_members`
Add `sort_order INTEGER` to `group_members`. Because the table is keyed by `(group_id, user_id)`, a column here gives a clean per-user ordering with no new table.

- **Alternative considered — new `group_order` table** (`user_id, group_id, position`): more rows/joins for the same data that `group_members` already carries per membership. Rejected as unnecessary.
- **Alternative considered — JSON array of group IDs on `users`**: hard to keep consistent when groups are joined/left, and not queryable in the `ORDER BY`. Rejected.

### Decision: `ORDER BY sort_order` with a deterministic fallback
`GET /api/groups` orders by `COALESCE(gm.sort_order, <big-fallback>)` then by `g.created_at DESC` (today's order) as the tiebreaker. New/unordered memberships (`sort_order IS NULL`) sort after explicitly ordered ones and remain stable via the `created_at` tiebreaker. This satisfies "default order is stable" and "newly joined group is appended."

- **Alternative considered — backfill every existing membership with a sequential `sort_order`**: heavier migration; not required because `COALESCE` already yields a stable default. We keep `NULL` as "unset."

### Decision: `PUT /api/groups/order` accepts an ordered array of group IDs
Body: `{ "order": ["<groupId1>", "<groupId2>", ...] }`. The handler assigns `sort_order = index` for each group ID that the authenticated user is actually a member of, in a single `DB.batch` of `UPDATE group_members SET sort_order = ? WHERE user_id = ? AND group_id = ?`. Unknown/foreign group IDs are ignored (defense per spec). Returns `{ success: true }`.

- **Alternative considered — PATCH a single group's position**: would require client-side recomputation of neighbors and multiple round-trips for a multi-item drag. A full ordered list is simpler and atomic.

### Decision: Reorder UI = up/down buttons on each row in `/groups`
On the My Groups list, each group card gets ▲/▼ controls (disabled at the ends). Moving updates local state immediately (optimistic), then calls `PUT /api/groups/order` with the new full ordering. On failure, revert and surface a retry. This keeps the existing card layout and avoids a drag-and-drop dependency; drag can be layered on later without changing the API.

## Risks / Trade-offs

- **Existing production DB lacks the column** → Ship the `ALTER TABLE group_members ADD COLUMN sort_order INTEGER;` against local and remote D1 before/with the worker deploy. `ADD COLUMN` with a nullable default is non-destructive and fast on SQLite.
- **Concurrent reorders from two devices** → Last write wins per membership; acceptable for a personal preference. Each `PUT` sends the complete ordering so there is no partial-merge corruption.
- **Optimistic UI drift if save fails** → Revert local order on error and show a retry affordance so the UI never silently disagrees with the server.
- **Schema file vs. live DB divergence** → Update `schema.sql` (for fresh installs) AND run the `ALTER TABLE` (for existing DBs); document both in tasks so neither is missed.

## Migration Plan

1. Add `sort_order INTEGER` to `group_members` in `schema.sql`.
2. Apply to local D1: `ALTER TABLE group_members ADD COLUMN sort_order INTEGER;` (and/or `npm run db:init` for fresh).
3. Deploy the worker (new `GET` ordering + `PUT /api/groups/order`).
4. Apply the same `ALTER TABLE` to production D1 via `wrangler d1 execute ... --config worker/wrangler.production.toml --remote` before/with the worker deploy.
5. Deploy the frontend with the reorder UI.

**Rollback:** the column is additive and nullable; reverting the worker/frontend restores the old `created_at DESC` behavior with the column harmlessly present and ignored.

## Open Questions

- Drag-and-drop vs. up/down buttons for the first version — proposal assumes up/down for simplicity; drag can be added later behind the same endpoint. (Defaulting to up/down.)
