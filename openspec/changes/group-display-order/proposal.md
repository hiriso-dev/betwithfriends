## Why

A user who belongs to several groups sees them as horizontal tabs/pills on nearly every page (home, fixtures, rankings, history, special, bets). Today that order is fixed — `GET /api/groups` returns groups sorted by `created_at DESC`, so the group a user cares about most can be buried at the end of the row with no way to promote it. Users want to put their primary group first and keep that order consistent everywhere.

## What Changes

- Add a **per-user group display order**: each user can arrange their own groups; the order does not affect other members.
- Add reordering controls to the **My Groups** screen (`/groups`) — move groups up/down (or drag) to set their position.
- Persist the chosen order on the server and apply it to `GET /api/groups`, so every group tab/selector (home, fixtures, rankings, history, special, bets) renders in the user's order.
- New API to save the order (e.g. `PUT /api/groups/order` accepting the ordered list of group IDs).
- Groups without an explicit position (newly joined/created) fall back to a deterministic order so the list is always stable.

## Capabilities

### New Capabilities
- `group-ordering`: Lets a user define a personal display order for the groups they belong to, persists it server-side, and applies it consistently to the group list and to every group tab/selector across the app.

### Modified Capabilities
<!-- No existing spec's requirements change. -->

## Impact

- **DB**: `group_members` gains a per-membership `sort_order` column (the natural place for a per-user ordering, since membership is already keyed by `(group_id, user_id)`). Requires a schema update plus an `ALTER TABLE` on the existing local and production D1 databases.
- **Worker API** (`worker/src/handlers/groups.ts`): `GET /api/groups` orders by the new column (with a stable fallback); add `PUT /api/groups/order` to persist a user's ordering.
- **Frontend**: `app/(app)/groups/page.tsx` gains reorder controls and calls the new endpoint. All pages that render group tabs (`home`, `fixtures`, `rankings`, `history`, `special`, `matches/[id]/bets`) automatically inherit the order because they consume `GET /api/groups` — no per-page logic needed.
- No breaking changes to existing endpoints; the new ordering is additive and defaults to today's behavior when unset.
