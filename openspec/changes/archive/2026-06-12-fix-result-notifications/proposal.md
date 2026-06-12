## Why

A user who bet on matches did not receive end-of-game result push notifications (nor pre-game reminders), despite having a valid subscription and `result_after_game = 1`. Investigation against production data pinpointed the real cause: the user had **two Apple Web Push subscriptions** (`web.push.apple.com`) — a live one plus a **zombie** left over from reinstalling the iOS PWA. Apple returns `2xx` for a zombie endpoint (so it is never pruned by the existing `410` cleanup) but never displays the notification. Because cron notifications dedup **per user** (`reserveDelivery(user, match, type)`), only **one** of the user's subscriptions receives each push — and when the dead one wins, the user gets nothing. An in-app "Test notification" (which sends to *all* subscriptions) did arrive, confirming the live subscription works and isolating the bug to the multi-subscription/zombie case.

## What Changes

- **Primary fix:** Keep **one push subscription per user — the latest device wins.** On `POST /api/push/subscribe`, after upserting the current endpoint, delete the user's other endpoints. Since the app re-registers the current subscription on every app open, this auto-prunes zombie subscriptions and guarantees cron notifications target the live device.
- **Secondary hardening (kept):** result-notification recipient query now defaults a missing `notification_prefs` row to opted-in (`LEFT JOIN ... COALESCE(np.result_after_game, 1) = 1`), matching the documented default and the pre-game path.
- **Diagnostics (kept):** `GET /api/admin/notification-debug` gains a `type=result` mode reporting each result-notification precondition (used during this investigation).
- **One-off operational step:** delete the user's existing stale subscription row in production (band-aid until the next app open re-registers and prunes it).

## Capabilities

### New Capabilities
<!-- None — this change modifies existing notification behavior. -->

### Modified Capabilities
- `match-notifications`: A user SHALL have at most one push subscription (the most recently registered device), so cron notifications are not silently delivered to a stale/zombie endpoint. Plus: result notifications treat a missing preference row as opted-in (default ON).
- `notification-diagnostics`: Extend the read-only admin debug endpoint to diagnose result-notification eligibility (in addition to pre-game).

## Impact

- `worker/src/handlers/notifications.ts` — `POST /api/push/subscribe` deletes the user's other subscriptions after registering the current one.
- `worker/src/services/push-service.ts` — `sendMatchResultNotifications` recipient query default-ON (secondary hardening).
- `worker/src/handlers/admin.ts` — `notification-debug` `type=result` mode.
- No schema change. Behavior change: a user keeps only their newest subscription; a genuine second device would be replaced rather than additionally notified (acceptable for this app — multi-device is unlikely, and "latest wins" is the simplest reliable rule).
- One-time production cleanup of the affected user's stale subscription row.
