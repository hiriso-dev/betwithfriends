## ADDED Requirements

### Requirement: Admin can query why a user was or was not sent a result notification for a match

The system SHALL allow the read-only admin notification-debug endpoint to report, for a given user and match, the current state of every end-of-game result notification precondition and the resulting eligibility, selected via a request parameter. When result diagnostics are requested, the endpoint SHALL treat a missing notification preference row as opted-in (default ON), consistent with how result notifications are delivered. The endpoint SHALL NOT send any notification or mutate any state.

#### Scenario: Endpoint reports each result precondition

- **WHEN** an authenticated admin request is made to `GET /api/admin/notification-debug` with a `match_id`, a `user_id`, and `type=result`
- **THEN** the response SHALL report whether the match is finished with both scores, whether the user has a push subscription, whether the result-after-game preference is enabled (defaulting to enabled when no preference row exists), whether the user has at least one bet on the match, whether all of the user's bets on the match are scored, and whether a result notification was already delivered
- **AND** the response SHALL report an overall `eligible_now` boolean and a list of blocking reasons

#### Scenario: Pre-game diagnostics remain the default

- **WHEN** the diagnostics endpoint is called without a `type` parameter
- **THEN** the system SHALL report pre-game reminder diagnostics exactly as before, unchanged

#### Scenario: Result diagnostics are read-only

- **WHEN** the diagnostics endpoint is called with `type=result` for any user and match
- **THEN** the system SHALL NOT send a push notification
- **AND** the system SHALL NOT modify `notification_deliveries` or any other stored state
