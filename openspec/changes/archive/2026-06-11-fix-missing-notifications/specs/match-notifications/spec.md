## ADDED Requirements

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
