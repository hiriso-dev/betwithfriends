## 1. One subscription per user (primary fix)

- [x] 1.1 In `worker/src/handlers/notifications.ts`, on `POST /api/push/subscribe`, after the existing `ON CONFLICT(endpoint)` upsert, delete the user's other endpoints: `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint != ?`.
- [x] 1.2 Confirm ordering (upsert current endpoint first, then delete others) so exactly one subscription — the current one — remains, and the `notification_prefs` `INSERT OR IGNORE` still runs.

## 2. Result-notification recipient query (secondary hardening)

- [x] 2.1 In `worker/src/services/push-service.ts`, change the `sendMatchResultNotifications` query to `LEFT JOIN notification_prefs np ON np.user_id = ps.user_id` with `WHERE COALESCE(np.result_after_game, 1) = 1`, keeping `JOIN bets`, `GROUP BY`, and `HAVING` intact.

## 3. Result-notification diagnostics

- [x] 3.1 In `worker/src/handlers/admin.ts`, add an optional `type` param to `GET /api/admin/notification-debug` (default `pre_game`, pre-game branch unchanged) with a `type=result` branch reporting each result precondition (finished+scored, push subscription, `result_after_game` default-ON, has bet, all bets scored, not already delivered) and `eligible_now` / `blocking_reasons`. Read-only.

## 4. Verify

- [x] 4.1 Run the worker typecheck (`tsc --noEmit`) — passes.
- [x] 4.2 Verify the recipient-query default-ON logic with a SQLite test (no-prefs-row user included; opt-out excluded; unscored bets gated).
- [x] 4.3 In production, confirm via D1 that after a fresh subscribe the affected user has exactly one `push_subscriptions` row, and that the in-app "Test notification" + next cron result notification arrive on the device.

## 5. Operational + docs

- [x] 5.1 One-off production cleanup: delete the affected user's stale subscription row (`DELETE FROM push_subscriptions WHERE id = '<stale-id>'`).
- [x] 5.2 Update `CLAUDE.md` admin route description to note the `type=result` mode and result default-ON behavior.
