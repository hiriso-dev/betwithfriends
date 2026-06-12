## Context

End-of-game result notifications (`sendMatchResultNotifications`) and pre-game reminders (`sendPreGameReminders`) both run on the per-minute cron. Both dedup delivery **per user** via `reserveDelivery(user, match, type)` against `notification_deliveries`, then send to a subscription row.

A production investigation (D1 Studio) on the affected user found:

- Platform: iOS PWA installed to home screen.
- **Two** `push_subscriptions` rows, both `web.push.apple.com`, created before any send.
- `notification_deliveries` had `pre_game` and `result` rows for the matches in question — meaning the worker reserved and sent, and the push service returned success (a transient error would have *released* the row; a `410` would have *deleted the subscription*, yet both subs remained).
- The user received **nothing** — not even pre-game.
- The in-app "Test notification" (which sends to **all** of a user's subscriptions, no dedup) **did** arrive.

This isolates the cause: one of the two Apple subscriptions is a **zombie** (left after a PWA reinstall). Apple returns `2xx` for it but never delivers, and the existing `410`-based pruning never catches it. With per-user dedup, the cron path sends each notification to only one subscription; when the zombie wins, the live device is never tried, so the user gets nothing.

## Goals / Non-Goals

**Goals:**
- Ensure cron notifications reach the user's **live** device.
- Prevent stale/zombie subscriptions from accumulating and swallowing notifications.
- Keep the fix minimal and consistent with how the app already (re)registers subscriptions.

**Non-Goals:**
- Multi-device fan-out (sending to several devices for one user). Out of scope by product decision — for this app, "latest device wins" is sufficient and simpler.
- Changing *when* notifications fire, the dedup model, retry behavior, or notification copy.
- Schema migration.

## Decisions

### Decision 1 (primary): One subscription per user — latest device wins

On `POST /api/push/subscribe`, after the existing `ON CONFLICT(endpoint)` upsert of the current endpoint, delete the user's **other** endpoints:

```sql
DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint != ?;
```

The app calls `subscribePush()` on every app open when permission is granted ([profile/page.tsx](../../../app/(app)/profile/page.tsx)), re-registering the current live endpoint — so this delete **auto-prunes zombies** on the next open without any extra client work. With at most one subscription per user, the per-user delivery dedup naturally targets the single live device; no change to `sendMatchResultNotifications` / `sendPreGameReminders` delivery loops is required.

**Alternative considered — send to all of a user's subscriptions** (keep multiple rows, reserve once per user but loop over every subscription). Rejected as heavier than needed: it keeps zombies around (they still 2xx), adds fan-out complexity, and the product doesn't need multi-device. "Latest wins" removes the dead row entirely, which is simpler and self-cleaning.

**Alternative considered — prune zombies by detecting non-delivery.** Not feasible: Apple returns `2xx`, so the server cannot distinguish a zombie from a delivered push.

### Decision 2 (secondary hardening): result query defaults preference ON

`sendMatchResultNotifications` uses `LEFT JOIN notification_prefs ... WHERE COALESCE(np.result_after_game, 1) = 1` instead of an inner join requiring an explicit row, matching the documented default (`GET /api/push/prefs` returns `true` when no row) and the pre-game path. Independent of the primary bug, but removes a latent inconsistency.

### Decision 3 (diagnostics): `type=result` on notification-debug

`GET /api/admin/notification-debug?...&type=result` reports each result precondition (finished+scored, push subscription, `result_after_game` default-ON, has bet, all bets scored, not already delivered). Read-only. Default remains `pre_game`.

## Risks / Trade-offs

- [A user with two genuine devices keeps only the most recently registered one.] → Accepted product trade-off; multi-device is unlikely for this app, and each device re-registers on open so the "active" device wins. Revisit with send-to-all if real demand appears.
- [Delete could remove a still-live endpoint if the user alternates devices.] → Self-correcting: whichever device is opened re-registers and becomes the kept one; the cron always targets the last-opened device.
- [Existing zombies persist until the next subscribe.] → Mitigated by a one-off production delete of the known stale row; thereafter the next app open prunes any new zombie automatically.

## Migration Plan

1. Deploy the worker (`npm run worker:deploy:production`). No DB migration.
2. One-off cleanup of the affected user's stale subscription:
   ```sql
   DELETE FROM push_subscriptions WHERE id = '<stale-subscription-id>';
   ```
   (Subsequent app opens self-prune any future zombies.)
3. Rollback is a straight worker revert; the only data effect is fewer duplicate subscription rows, which is harmless.
