## ADDED Requirements

### Requirement: Admin can query why a user was or was not reminded for a match

The system SHALL provide an authenticated, read-only endpoint that reports, for a given user and match, the current state of every pre-game reminder precondition and the resulting eligibility. The endpoint SHALL NOT send any notification or mutate any state.

#### Scenario: Endpoint reports each blocking precondition

- **WHEN** an authenticated request is made to `GET /api/admin/notification-debug` with a `match_id` and a `user_id`
- **THEN** the response SHALL report the match's status, kickoff time, whether kickoff has passed, whether the match is within the pre-game window, and whether the match is flagged reminder-complete
- **AND** the response SHALL report, for that user, whether they are in a group for the match, whether they have a push subscription, whether the pre-game reminder preference is enabled, whether they have already bet for every relevant group, and whether a pre-game notification was already delivered
- **AND** the response SHALL report an overall `eligible_now` boolean and a list of blocking reasons

#### Scenario: Endpoint is read-only

- **WHEN** the diagnostics endpoint is called for any user and match
- **THEN** the system SHALL NOT send a push notification
- **AND** the system SHALL NOT modify `notification_deliveries`, `matches.reminders_done`, or any other stored state

#### Scenario: Request defaults to the caller when no target user is supplied

- **WHEN** the diagnostics endpoint is called without a `user_id` parameter
- **THEN** the system SHALL report the diagnostics for the authenticated caller's own user
- **AND** the system SHALL only report another user's diagnostics when the caller is authorized to do so
