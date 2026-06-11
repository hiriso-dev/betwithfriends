## 1. Fix pre-game reminder reliability

- [x] 1.1 In `sendPreGameReminders` ([worker/src/services/push-service.ts:451](../../../worker/src/services/push-service.ts#L451)), remove the rule that sets `matches.reminders_done = 1` whenever the recipient query returns zero rows.
- [x] 1.2 Replace it with a kickoff-passed rule: a match is only flagged `reminders_done = 1` once `match_date <= now`. While `match_date > now`, leave `reminders_done = 0` so the match is re-evaluated on every later tick within the window even if the current recipient set is empty.
- [x] 1.3 Confirm the at-most-one-per-user-per-match guarantee is unchanged — delivery still goes through `reserveDelivery`/`notification_deliveries` and temporary failures still call `releaseDelivery` for retry.
- [x] 1.4 (Optional one-time backfill) On deploy, reset `reminders_done = 0` for any `scheduled` match still inside its pre-game window (`match_date > now AND match_date <= now + 3600`) so matches prematurely flagged by the old code can still send.

## 2. Add observability to the pre-game tick

- [x] 2.1 Emit a per-match log record from `sendPreGameReminders`: `matchId`, `recipientCount`, `sent`, `tempFailures`, `permFailures`, and the `skipReason` (e.g. `no_recipients`, `all_delivered`, `all_failed`, `flagged_complete_kickoff_passed`).
- [x] 2.2 Emit a per-tick summary log: number of candidate matches and aggregate sends/failures.
- [x] 2.3 Verify logs are visible via `wrangler tail` and contain no PII beyond user IDs already used elsewhere.

## 3. Add the admin notification-debug endpoint

- [x] 3.1 In `handleAdmin` ([worker/src/handlers/admin.ts](../../../worker/src/handlers/admin.ts)), add `GET /api/admin/notification-debug` (reuses the existing `ADMIN_EMAIL` gate, so it is admin-only).
- [x] 3.2 Read `match_id` (required) and `user_id` (optional, default `auth.userId`) from the query string; return 400 if `match_id` is missing or the match is not found.
- [x] 3.3 Build the match block: `status`, `match_date`, `reminders_done`, `in_window` (`now < match_date <= now+3600`), `kickoff_passed` (`match_date <= now`).
- [x] 3.4 Build the user block by querying each precondition: `in_group` (any `group_members` row), `has_push_subscription`, `remind_before_game` (default on when no `notification_prefs` row), `has_bet_all_groups` (no group left without a bet for this match), `already_delivered_pre_game` (`notification_deliveries` `pre_game` row).
- [x] 3.5 Compute `eligible_now` and a `blocking_reasons` array from the preconditions; return the JSON shape described in design.md Decision 3.
- [x] 3.6 Ensure the handler performs only SELECTs — no writes, no push sends.

## 4. Verify and document

- [x] 4.1 Locally, exercise the endpoint against a seeded match for: a user with no push subscription, a user who has bet, a user with the pref off, and a fully-eligible user — confirm `blocking_reasons` matches each case.
- [x] 4.2 Confirm the reminder fix by simulating a late subscription: with a match inside the window and `reminders_done` previously 0, an initially-empty recipient set followed by a new subscription results in a delivered reminder (and `reminders_done` stays 0 until kickoff).
- [x] 4.3 Run `npm run build`/typecheck for the worker and fix any type errors.
- [x] 4.4 Update `CLAUDE.md`: document the corrected `reminders_done` semantics (set only after kickoff) and the new `GET /api/admin/notification-debug` route.
- [x] 4.5 Deploy worker (`npm run worker:deploy:production`) and, for the originally-affected user+match, call `notification-debug` to record the actual historical blocking reason.
