## Context

`sendPreGameReminders` ([worker/src/services/push-service.ts:451](../../../worker/src/services/push-service.ts#L451)) runs every minute (DB-only, no external API call). For each `scheduled` match with `reminders_done = 0` kicking off within the next 60 minutes, it builds a recipient set of group members who: have a push subscription, have `remind_before_game` on (default on), have not bet in that group, and have not already been delivered a `pre_game` notification. Delivery is deduped via `notification_deliveries (user_id, match_id, delivery_type)`.

The reliability hole is the short-circuit at lines 494–499:

```ts
if (rows.results.length === 0) {
  await env.DB.prepare("UPDATE matches SET reminders_done = 1 WHERE id = ?").bind(match.id).run();
  continue;
}
```

`reminders_done = 1` permanently removes the match from the cron's consideration. But `rows.results.length === 0` does **not** mean "everyone has been reminded" — it means "nobody is eligible *this minute*." The recipient query inner-joins `push_subscriptions`, so a user who has not (re-)subscribed yet, whose subscription momentarily looks absent, or who is in a transient state produces an empty set. If that empty set occurs on the first tick after the match enters the 60-minute window, the match is flagged done and **every** later tick skips it — so a user who subscribes 40 minutes before kickoff never gets reminded.

A second, compounding problem: when a reminder *isn't* sent, nothing is logged. Operators cannot distinguish "no subscription" from "pref off" from "already delivered" from "flagged done," which is exactly the situation that produced this report.

## Goals / Non-Goals

**Goals:**
- A user who is eligible at *any* minute during the 60-minute pre-game window receives their one reminder, even if they were ineligible on earlier ticks.
- Every pre-game tick leaves an inspectable trail: candidates, recipients, sends, failures, and the reason a match was skipped or flagged done.
- An operator can ask "why didn't user U get a reminder for match M?" and get a precise, per-precondition answer without reading logs.

**Non-Goals:**
- Redesigning result-after-game notifications (the bettor-only `JOIN bets` gating). Deferred to a follow-up change.
- Changing the dedup model, the 60-minute window length, `BET_LOCK_MINUTES`, or the score-sync path.
- Any schema migration. All required columns/tables already exist.

## Decisions

### Decision 1: Only set `reminders_done` after kickoff, not on an empty recipient set

Replace the "empty recipients → flag done" rule with "flag done only once kickoff has passed." Concretely, the match keeps being re-evaluated each minute while `match_date > now` (still in the window) regardless of whether the current recipient set is empty; once `match_date <= now`, the cron flags `reminders_done = 1` (or simply lets the existing `match_date > now` filter drop it and flags it on the next pass for query-cost hygiene).

- **Why:** Eligibility is time-varying (a user can subscribe mid-window). The "done" flag must reflect an irreversible fact (kickoff passed), not a momentary snapshot.
- **Alternative considered — drop the flag entirely:** The existing `match_date > now AND match_date <= now + 3600` window already bounds re-querying to the hour before kickoff, so the flag is only a minor query-cost optimization. We keep it but set it correctly (post-kickoff) so finished/locked matches still stop being scanned, preserving the optimization without the data-loss bug.
- **Alternative considered — flag done only when every group member has either bet or been delivered (ignoring subscription state):** More complex to express and still wrong if a subscribed user appears late; the kickoff-passed rule is simpler and strictly safe.

### Decision 2: Structured logging inside the pre-game tick

Emit one summary log per tick (`candidateMatches`, totals) and one per match (`matchId`, `recipientCount`, `sent`, `tempFailures`, `permFailures`, `skipReason`). Use `console.log`/`console.error` (already the project's convention, surfaced in `wrangler tail`). No new dependency.

- **Why:** Cheapest possible observability that makes silent no-ops visible. Logs are ephemeral but sufficient for live debugging.
- **Alternative considered — persist attempts to a table:** Heavier (schema + writes every tick) and the diagnostics endpoint (Decision 3) already gives durable, queryable answers. Rejected for now.

### Decision 3: Read-only admin diagnostics endpoint

`GET /api/admin/notification-debug?match_id=<id>&user_id=<id>` (auth required, handled in `worker/src/handlers/admin.ts`) returns the match's window state plus a per-precondition breakdown for the user:

```jsonc
{
  "match": { "id", "status", "match_date", "reminders_done", "in_window": bool, "kickoff_passed": bool },
  "user": {
    "in_group": bool,
    "has_push_subscription": bool,
    "remind_before_game": bool,
    "has_bet_all_groups": bool,      // bet present for every group → not a recipient
    "already_delivered_pre_game": bool
  },
  "eligible_now": bool,
  "blocking_reasons": ["no_push_subscription", ...]
}
```

- **Why:** Directly answers the support question with no log access. Read-only, so safe to expose to an authenticated admin.
- **Authorization:** Reuse the existing admin handler's auth approach. If `admin.ts` has no role gate today, scope the endpoint to the authenticated user's own `user_id` (default to `auth.userId` when `user_id` is omitted) so it cannot leak other users' state until/unless an admin-role check is added.
- **Alternative considered — surface this in the user-facing profile UI:** Useful later, but a backend diagnostics endpoint unblocks debugging now with far less surface area. Out of scope for this change.

## Risks / Trade-offs

- **[Slightly more DB re-querying of in-window matches with no recipients]** → Each such match is re-evaluated up to ~60 times before kickoff. These are DB-only reads on indexed columns with no external API cost; negligible at this app's scale.
- **[Diagnostics endpoint could leak another user's notification state]** → Default `user_id` to the caller and only widen to arbitrary users behind a real admin-role check (see Open Questions).
- **[Logs are ephemeral]** → Acceptable; the endpoint provides the durable, on-demand answer. If persistent audit is later needed, add a deliveries-attempt table in a follow-up.
- **[The actual root cause for today's miss may be a missing/expired subscription, not the flag]** → The diagnostics endpoint is explicitly designed to confirm which it was; the flag fix removes the worst failure mode regardless.

## Migration Plan

1. Ship the `sendPreGameReminders` flag-condition change + logging and the new admin endpoint together (worker deploy only; no DB migration).
2. Deploy worker (`npm run worker:deploy:production`).
3. Validate against the next real fixture, or immediately via `GET /api/admin/notification-debug` for the affected user+match to capture the current blocking reason.
4. **Rollback:** revert the worker deploy. No data changes to undo (`reminders_done` semantics only affect future ticks; no backfill performed).

## Open Questions

- Does `admin.ts` already enforce an admin role, or is every authenticated user reaching it? This determines whether `notification-debug` may accept an arbitrary `user_id` or must be self-scoped. (Resolve while implementing; default to self-scoped if unsure.)
- Should we also reset `reminders_done = 0` for any match still in its pre-game window that was prematurely flagged by the old code, as a one-time backfill on deploy? (Low value mid-tournament unless a match is currently within its window; left as an optional task.)
