## ADDED Requirements

### Requirement: Match cards show live scores during in-progress matches
The system SHALL display live scores on match cards for matches with `status = 'live'` (or `IN_PLAY` / `PAUSED` as returned by football-data.org), updating automatically every 60 seconds without a full page reload.

#### Scenario: Live score badge appears on in-progress match card
- **WHEN** a match card is rendered for a match with `status = 'live'`
- **THEN** the card SHALL display the current score (e.g., "2 – 1") prominently
- **AND** a pulsing "LIVE" indicator badge SHALL be visible on the card

#### Scenario: Live scores auto-refresh every 60 seconds
- **WHEN** a user is on the fixtures page or home page and at least one match has `status = 'live'`
- **THEN** the page SHALL automatically refetch match data from `/api/matches` every 60 seconds
- **AND** match card scores SHALL update in place without a full page navigation or reload

#### Scenario: Auto-refresh stops when no matches are live
- **WHEN** there are no matches with `status = 'live'` on the current page
- **THEN** the periodic polling SHALL NOT be active (no background requests)
- **AND** polling SHALL resume automatically if a match transitions to `live` during the next manual page load

#### Scenario: Auto-refresh does not interrupt user interaction
- **WHEN** a user has an open BetSheet modal and a live score refresh fires
- **THEN** the modal SHALL remain open and the user's input SHALL be preserved
- **AND** the score update SHALL be applied to the underlying match card silently

#### Scenario: Finished match transitions out of live state
- **WHEN** a live match's score is refreshed and the API returns `status = 'finished'`
- **THEN** the "LIVE" badge SHALL disappear
- **AND** the final score SHALL remain displayed with the match outcome styling (green/correct badge if applicable)

### Requirement: Home page featured match shows live score
The system SHALL apply live score ticker behavior to the featured match displayed on the `/home` page when that match is in-progress.

#### Scenario: Featured match live score updates on home page
- **WHEN** the home page's featured match has `status = 'live'`
- **THEN** the featured match component SHALL display the current live score
- **AND** the score SHALL refresh every 60 seconds via the same polling mechanism used on the fixtures page

#### Scenario: Home page polls only while a match is live
- **WHEN** no featured match or upcoming match is currently live
- **THEN** the home page SHALL NOT initiate any periodic polling
