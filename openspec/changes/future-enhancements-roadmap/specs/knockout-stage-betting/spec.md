## ADDED Requirements

### Requirement: Knockout fixtures are auto-seeded via score sync cron

The system SHALL automatically detect and insert new knockout stage matches (Round of 32, Quarter-Finals, Semi-Finals, Third-Place Play-off, Final) into the `matches` table when they are returned by the football-data.org `/competitions/WC/matches` API, without requiring manual admin action.

#### Scenario: New knockout fixture discovered on cron tick

- **WHEN** `syncScores()` runs and football-data.org returns a match with an `api_match_id` not present in the `matches` table
- **THEN** the system SHALL insert the new match row (with `status = 'scheduled'`, TBD team names if not yet determined, and the correct `stage` and `match_date`)
- **AND** the match SHALL appear on the fixtures page under its scheduled date

#### Scenario: Already-seeded knockout fixture not duplicated

- **WHEN** `syncScores()` runs and football-data.org returns a match whose `api_match_id` already exists in `matches`
- **THEN** the system SHALL update the existing row (score, status, team names if resolved) and NOT insert a duplicate

#### Scenario: Knockout match team names resolve from TBD

- **WHEN** a knockout fixture initially seeded with TBD team names is returned by football-data.org with resolved team names (e.g., "France" vs "Germany")
- **THEN** the `home_team` and `away_team` columns SHALL be updated to the resolved names
- **AND** existing bets placed while teams were TBD SHALL remain valid and be scored against the updated team names

### Requirement: Users can place bets on knockout stage matches

The system SHALL allow authenticated users who are members of a group to place score predictions on any knockout stage match before that match's kickoff time.

#### Scenario: User bets on a Round of 32 match

- **WHEN** a user submits a prediction for a knockout match that has not yet kicked off
- **THEN** the system SHALL accept the bet (home score, away score, confidence, double_up) and store it with `INSERT OR REPLACE` semantics
- **AND** the bet SHALL appear on the fixtures page match card for that group

#### Scenario: Knockout match scored same as group stage

- **WHEN** a knockout match reaches `status = 'finished'`
- **THEN** `processMatchResult()` SHALL compute points using `score.regularTime` (90-minute score only)
- **AND** extra time and penalty shootout scores SHALL NOT affect points earned
- **AND** the scoring rules (correct result +10, exact +5, confidence modifier, double-up multiplier) SHALL apply identically to group stage rules

#### Scenario: Bet locked at knockout match kickoff

- **WHEN** a user attempts to place or modify a bet on a knockout match after its `match_date`
- **THEN** the system SHALL reject the request with an appropriate error
- **AND** the match card SHALL show the bet as locked in the UI

### Requirement: Knockout matches display correctly on fixtures page

The system SHALL display knockout stage matches on the `/fixtures` page grouped by their round (Round of 32, Quarter-Final, Semi-Final, Third-Place Play-off, Final), distinct from group stage matches.

#### Scenario: Fixtures page shows knockout round section

- **WHEN** a user visits `/fixtures` after at least one knockout fixture has been seeded
- **THEN** knockout matches SHALL appear in a section labeled with their round name (e.g., "Round of 32", "Quarter-Final")
- **AND** the section SHALL be visually distinct from group stage match sections

#### Scenario: Fixtures page with no knockout fixtures

- **WHEN** a user visits `/fixtures` before any knockout fixtures have been seeded
- **THEN** the knockout section SHALL NOT appear (no empty section)
