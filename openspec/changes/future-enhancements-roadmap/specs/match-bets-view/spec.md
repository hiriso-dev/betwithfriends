## ADDED Requirements

### Requirement: Group members can view all bets for a match after kickoff
The system SHALL provide a page at `/matches/[id]/bets?group_id=[groupId]` showing every group member's prediction for a specific match, visible only after that match has kicked off.

#### Scenario: User views match bets after kickoff
- **WHEN** an authenticated group member navigates to `/matches/[id]/bets?group_id=[groupId]` after the match's `match_date`
- **THEN** the page SHALL display a list of all group members who placed a bet on that match
- **AND** each entry SHALL show the member's group nickname, predicted home score, predicted away score, confidence level (if set), and double-up flag

#### Scenario: Match bets hidden before kickoff
- **WHEN** an authenticated group member navigates to `/matches/[id]/bets?group_id=[groupId]` before the match's `match_date`
- **THEN** the system SHALL return a 403 or display a "Bets are hidden until kickoff" message
- **AND** no bet predictions SHALL be visible

#### Scenario: Match bets show points after match finishes
- **WHEN** a user views the match bets page for a finished match
- **THEN** each bet entry SHALL also display the points earned by that member
- **AND** the outcome (exact score / correct result / wrong) SHALL be visually indicated

#### Scenario: Members with no bet shown separately
- **WHEN** a user views the match bets page and some group members did not place a bet
- **THEN** members who did not bet SHALL appear in a separate "No bet placed" section
- **AND** no prediction data SHALL be shown for them

#### Scenario: Match card links to bets page after kickoff
- **WHEN** a match has kicked off and the user is viewing the fixtures page with a group selected
- **THEN** the match card SHALL display a link or button to the match bets page for that group
- **AND** the link SHALL include the `group_id` query parameter

### Requirement: API returns all group bets for a match after kickoff
The `GET /api/matches/:id/bets?group_id=` endpoint SHALL return all bets placed by group members for the specified match, only when the match has kicked off.

#### Scenario: API enforces kickoff gate
- **WHEN** the endpoint is called for a match whose `match_date` is in the future
- **THEN** the API SHALL return HTTP 403 with an error message

#### Scenario: API returns full bet details for kicked-off match
- **WHEN** the endpoint is called for a match whose `match_date` has passed and the caller is a member of the specified group
- **THEN** the API SHALL return an array of bet objects including `pseudo`, `home_score_pred`, `away_score_pred`, `confidence`, `double_up`, and `points_earned` (null if not yet calculated)
