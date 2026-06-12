## ADDED Requirements

### Requirement: A user has at most one push subscription (latest device wins)

The system SHALL retain at most one push subscription per user — the most recently registered endpoint. When a user registers a push subscription, the system SHALL remove that user's other subscription endpoints. This SHALL ensure cron-delivered notifications target the user's live device and SHALL prevent a stale/zombie endpoint (e.g. one left after reinstalling an iOS PWA, which the push service accepts but never delivers) from silently swallowing notifications under per-user delivery dedup.

#### Scenario: Re-subscribing replaces the previous subscription

- **WHEN** a user registers a push subscription with a new endpoint while an older endpoint for that user still exists
- **THEN** the system SHALL keep the newly registered endpoint
- **AND** SHALL delete the user's other endpoints, leaving exactly one subscription for that user

#### Scenario: Zombie subscription cannot swallow the notification

- **WHEN** the user's live device re-registers its subscription on app open
- **THEN** the system SHALL remove any previously stored endpoint for that user that is not the current one
- **AND** subsequent cron notifications SHALL be sent to the current live endpoint

### Requirement: End-of-game result notifications default to opted-in

The system SHALL send the end-of-game result notification to every user who placed a bet on a match once that user's points for the match are resolved and the user has a push subscription, treating the absence of a notification preference row as opted-in (default ON). The system SHALL suppress the result notification only for users who have explicitly disabled the result-after-game preference, and SHALL deliver at most one result notification per user per match.

#### Scenario: User with a bet but no preference row is notified

- **WHEN** a match finishes with scores and a user's bet on that match has been scored
- **AND** the user has a push subscription but has no `notification_prefs` row
- **THEN** the system SHALL send that user the end-of-game result notification
- **AND** SHALL NOT treat the missing preference row as an opt-out

#### Scenario: User who disabled result notifications is not notified

- **WHEN** a match finishes with scores and a user's bet on that match has been scored
- **AND** the user has explicitly set the result-after-game preference to off
- **THEN** the system SHALL NOT send that user a result notification

#### Scenario: Result notification is sent only after points are resolved

- **WHEN** a match has finished but at least one of the user's bets on the match is not yet scored
- **THEN** the system SHALL NOT send the result notification for that user yet
- **AND** once all of the user's bets on the match are scored, the system SHALL send exactly one result notification for that user and match
