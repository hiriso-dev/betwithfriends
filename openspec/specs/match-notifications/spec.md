# match-notifications Specification

## Purpose
TBD - created by archiving change fix-missing-notifications. Update Purpose after archive.
## Requirements
### Requirement: Pre-game reminder eligibility persists for the full pre-game window

The system SHALL keep a scheduled match eligible for pre-game reminder delivery for the entire 60-minute window before kickoff, and SHALL NOT permanently stop reminding for a match merely because no recipient was eligible on an earlier tick. A match SHALL only be marked as reminder-complete once its kickoff time has passed.

#### Scenario: User who subscribes mid-window still gets reminded

- **WHEN** a match has entered the 60-minute pre-game window with no eligible recipients on the first tick (e.g. the only group member had no push subscription yet)
- **AND** that group member registers a push subscription later but still before kickoff, has reminders enabled, and has not placed every required bet
- **THEN** the system SHALL send that user one pre-game reminder for the match before kickoff
- **AND** the match SHALL NOT have been permanently flagged reminder-complete by the earlier empty tick

#### Scenario: Match is flagged complete only after kickoff

- **WHEN** a scheduled match's kickoff time passes
- **THEN** the system SHALL mark the match reminder-complete so later cron ticks skip it
- **AND** while kickoff is still in the future, the system SHALL re-evaluate the match's recipients on each tick even if the recipient set was empty on a prior tick

#### Scenario: Still at most one reminder per user per match

- **WHEN** a user becomes eligible on a later tick within the window after being ineligible earlier
- **THEN** the system SHALL deliver at most one pre-game reminder for that user and match across all ticks and all of the user's groups

### Requirement: Pre-game reminder delivery outcomes are observable

The system SHALL record, on each pre-game reminder tick, enough information to determine why a reminder was or was not sent, including per-match recipient counts, successful sends, temporary failures, permanent failures, and the reason a match was skipped or marked complete.

#### Scenario: Tick emits a per-match outcome summary

- **WHEN** the pre-game reminder job processes a candidate match
- **THEN** the system SHALL emit a log record containing the match identifier, the number of eligible recipients, the number of reminders sent, the number of temporary delivery failures, the number of permanent delivery failures, and the reason the match was skipped or flagged complete (if any)

#### Scenario: A silently skipped match is attributable

- **WHEN** a candidate match results in zero reminders sent
- **THEN** the emitted log record SHALL indicate the cause (no eligible recipients, all recipients already delivered, all delivery attempts failed, or match flagged complete) rather than producing no output

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

