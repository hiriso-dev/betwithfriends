## ADDED Requirements

### Requirement: Eligible users receive one pre-game reminder per match
The system SHALL send at most one pre-game reminder per eligible user and match during the hour before kickoff.

#### Scenario: Eligible user receives a reminder during the pre-game window
- **WHEN** a user is in at least one group for a scheduled match, has not placed every required bet for that match, has a push subscription, and has reminders enabled
- **THEN** the system SHALL send one pre-game reminder for that match during the 60-minute window before kickoff
- **AND** the user SHALL NOT receive duplicate reminders for the same match even if they belong to multiple groups

#### Scenario: Temporary delivery failure is retried
- **WHEN** a pre-game reminder attempt fails with a temporary push-delivery error
- **THEN** the system SHALL keep that user eligible for a later retry within the reminder window
- **AND** a successful later retry SHALL still result in at most one delivered reminder for that user and match

### Requirement: Result notifications are sent only after match points are resolved
The system SHALL send result notifications only after the finished match has been finalized and the recipient's bet points for that match are available.

#### Scenario: Result notification waits for computed points
- **WHEN** a tracked match reaches a finished state but bet points have not yet been computed for a user
- **THEN** the system SHALL NOT send that user's result notification yet
- **AND** the user SHALL become eligible once the match finalization step has populated their bet points

#### Scenario: Successful result notification is sent exactly once
- **WHEN** a finished match has been finalized and an eligible user has result notifications enabled and at least one bet on that match
- **THEN** the system SHALL send one result notification for that user and match
- **AND** later sync ticks SHALL NOT deliver a duplicate result notification for the same user and match

#### Scenario: Result notification shows regular-time and real final context
- **WHEN** a finished match was resolved on regular time for betting but has a different real final score after extra time or penalties
- **THEN** the result notification SHALL present the regular-time score as the resolved betting result
- **AND** the notification SHALL include the real final score in parentheses or equivalent secondary text

#### Scenario: Temporary result-delivery failure is retried
- **WHEN** a result notification attempt fails with a temporary push-delivery error
- **THEN** the system SHALL keep that user eligible for a later retry
- **AND** the first successful retry SHALL satisfy the one-notification-per-user-per-match rule