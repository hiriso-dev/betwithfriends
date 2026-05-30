## ADDED Requirements

### Requirement: Live match views refresh while a rendered match is in progress
The system SHALL refetch match data for fixtures and home views every 30 seconds while at least one rendered match is live, and SHALL stop polling when no rendered match is live.

#### Scenario: Fixtures page refreshes live matches in place
- **WHEN** the fixtures page is open and at least one rendered match has `status = 'live'`
- **THEN** the page SHALL refetch match data every 30 seconds without a full page reload
- **AND** the existing betting UI state SHALL remain intact while refreshed scores are applied

#### Scenario: Home page refreshes live featured data
- **WHEN** the home page is open and the selected group's rendered match list contains at least one live match
- **THEN** the page SHALL refetch match data every 30 seconds
- **AND** live score changes SHALL appear without a full page reload

#### Scenario: Polling stops when no visible match is live
- **WHEN** no rendered match is live on the current page
- **THEN** the page SHALL NOT keep a background polling interval running

### Requirement: Finished match cards distinguish scoring result from real final result
The system SHALL present the regular-time score as the primary finished-match score used for bet evaluation, and SHALL show the real final score in parentheses when the match ended after extra time or penalties.

#### Scenario: Match ends in regular time only
- **WHEN** a finished match has no extra-time or penalty-only final score difference
- **THEN** the UI SHALL show a single finished score line
- **AND** no parenthesized final score SHALL be displayed

#### Scenario: Match ends after penalties
- **WHEN** a finished match has `score_duration = 'PENALTY_SHOOTOUT'`, a regular-time score of `1-1`, and a real final score of `5-4`
- **THEN** the UI SHALL show `1-1` as the primary finished score
- **AND** the UI SHALL show the real final score in parentheses next to it
- **AND** any bet outcome badge or points display SHALL be based on `1-1`

### Requirement: Match payloads include final-score context when needed
The system SHALL include explicit final-score metadata in match API responses so clients can render regular-time and real-final results consistently.

#### Scenario: Finished match response includes dual-score fields
- **WHEN** `/api/matches` returns a finished match that ended after extra time or penalties
- **THEN** the response SHALL include the primary score fields used for betting resolution
- **AND** the response SHALL include `final_home_score`, `final_away_score`, and `score_duration` so clients can render the real final outcome in parentheses