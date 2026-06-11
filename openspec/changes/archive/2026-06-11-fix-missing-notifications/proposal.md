## Why

During the live tournament, an eligible user who had not yet placed a bet did **not** receive the pre-game "place your prediction" reminder for a match that kicked off today. The pre-game cron path silently no-ops on every failed precondition, so there is no way to tell whether the cause was a missing push subscription, a preference, the dedup table, or the `reminders_done` short-circuit — we can only guess. We need to both close the most likely reliability gap and make future misses diagnosable instead of invisible.

## What Changes

- **Fix the `reminders_done` short-circuit.** Today `sendPreGameReminders` sets `matches.reminders_done = 1` the moment the recipient query returns zero rows. That query requires a live `push_subscriptions` row, so if nobody is eligible *at that minute* (e.g. the user has not re-subscribed yet, or a transient state), the match is permanently flagged "done" and skipped for the rest of the pre-game window — even for users who become eligible minutes later but still before kickoff. The match SHALL only be considered settled once **kickoff has passed**, so any eligible-and-not-yet-reminded user inside the 60-minute window still gets their one reminder.
- **Add structured logging to the pre-game tick.** Each run logs candidate-match count and, per match, the recipient count, sends, temporary failures, permanent failures, and the reason a match was skipped/flagged. This turns a silent no-op into an inspectable trail.
- **Add an admin diagnostics endpoint.** `GET /api/admin/notification-debug?match_id=&user_id=` returns, for that user+match, exactly which precondition currently blocks (or blocked) a pre-game reminder: not in a group, no push subscription, reminder pref off, already bet, already delivered, match not `scheduled`, outside the window, or `reminders_done` already set. This is the tool to answer "why didn't I get notified" without log spelunking.
- **Out of scope (deferred follow-up):** redesigning result-after-game notifications (currently gated to users who placed a bet) is intentionally **not** included here — the user asked to focus on the pre-game reminder first. It is captured as a follow-up so it is not lost.

## Capabilities

### New Capabilities
- `notification-diagnostics`: An admin-facing, read-only way to determine why a specific user did or did not receive a pre-game reminder for a specific match, by reporting each delivery precondition's current state.

### Modified Capabilities
- `match-notifications`: Strengthen the pre-game reminder requirement so eligibility persists across the entire 60-minute pre-game window — a transiently empty recipient set no longer permanently disqualifies a match. Add a requirement that pre-game delivery outcomes and skip reasons are observable.

## Impact

- **Code:**
  - `worker/src/services/push-service.ts` — `sendPreGameReminders` (change the `reminders_done` flagging condition; add structured logging).
  - `worker/src/handlers/admin.ts` — new `GET /api/admin/notification-debug` route.
  - `worker/src/index.ts` — no behavioral change to the `scheduled` flow beyond what `sendPreGameReminders` already does.
- **Data:** No schema migration required. Continues to use `matches.reminders_done`, `notification_deliveries`, `notification_prefs`, `push_subscriptions`. The semantics of when `reminders_done` is set change.
- **APIs:** One new authenticated admin GET endpoint; no breaking changes to existing endpoints.
- **Behavior:** Slightly more DB-only re-querying of in-window matches with no current recipients (cheap, no external API calls), in exchange for not permanently dropping reminders.
