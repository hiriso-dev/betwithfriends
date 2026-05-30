## ADDED Requirements

### Requirement: Tracked matches synchronize by match identity during active lifecycle windows

The system SHALL refresh tracked matches by `api_match_id` during their active lifecycle window regardless of competition, and SHALL keep football-data.org usage within the configured per-minute budget by prioritizing due matches.

#### Scenario: Non-World-Cup tracked match is refreshed

- **WHEN** a match row exists in the database with `api_match_id = 552096` and that row is within the active sync window
- **THEN** the worker SHALL fetch football-data.org `/matches/552096`
- **AND** the persisted match row SHALL be updated from that response even though the match does not belong to the World Cup competition feed

#### Scenario: Live and overdue matches are prioritized when demand exceeds budget

- **WHEN** more tracked matches are due for refresh than the allowed football-data.org call budget for the current cron tick
- **THEN** the worker SHALL refresh live matches and post-kickoff non-terminal matches before less urgent rows
- **AND** remaining due matches SHALL be deferred to a later tick instead of exceeding the configured budget

### Requirement: Finished matches finalize from regular-time results exactly once

The system SHALL finalize a finished match from its regular-time score, compute unresolved bets exactly once, and update group standings only for bet rows that have not already been scored.

#### Scenario: Match transitions from non-terminal to finished

- **WHEN** a tracked match was previously `scheduled` or `live` and a sync response now reports it as finished with a regular-time score
- **THEN** the system SHALL persist the finished state
- **AND** the system SHALL compute `points_earned` for every unresolved bet on that match using the regular-time score
- **AND** the system SHALL update group totals exactly once per unresolved bet row

#### Scenario: Match is first observed after it has already finished

- **WHEN** the first successful sync for a tracked match already reports `FINISHED`
- **THEN** the system SHALL still finalize that persisted match row
- **AND** any unresolved bets for that match SHALL receive computed points without requiring a prior live-state transition

#### Scenario: Penalty-shootout match is scored on regular time

- **WHEN** a finished match response includes both `regularTime` and a different actual final score after penalties
- **THEN** the system SHALL use the `regularTime` score to compute bet points
- **AND** the actual final score SHALL NOT change the computed outcome or points

### Requirement: Missed sync transitions are recoverable

The system SHALL recover from missed cron ticks or delayed external updates by re-checking finished matches whose bets are still unresolved until finalization succeeds.

#### Scenario: Finished match remains unresolved after an earlier missed tick

- **WHEN** a persisted match is already marked finished or becomes finished on a later sync and at least one bet still has `points_earned IS NULL`
- **THEN** the worker SHALL attempt finalization again on a later sync pass
- **AND** the match SHALL remain eligible for recovery until all unresolved bets have been computed
