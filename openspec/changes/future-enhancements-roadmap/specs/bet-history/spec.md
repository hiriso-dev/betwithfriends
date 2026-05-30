## ADDED Requirements

### Requirement: Users can view their personal bet history

The system SHALL provide a page at `/history` where an authenticated user can view all bets they have placed, across all groups they belong to, sorted by match date descending.

#### Scenario: User views bet history

- **WHEN** an authenticated user navigates to `/history`
- **THEN** the page SHALL display a list of their past bets including: match name (home vs away), match date, their prediction, the actual result (if finished), the outcome badge (exact / correct / wrong / pending), and points earned
- **AND** results SHALL be sorted by match date descending (most recent first)

#### Scenario: Bet history paginated

- **WHEN** a user has more than 50 bets
- **THEN** the page SHALL display the first 50 bets and provide a "Load more" button to fetch the next page
- **AND** each subsequent load SHALL fetch the next 50 bets in descending match date order

#### Scenario: Bet history filterable by group

- **WHEN** a user selects a group from a filter dropdown on the history page
- **THEN** the displayed bets SHALL be filtered to show only bets placed in that group
- **AND** the URL SHALL update to reflect the filter (`?group_id=[id]`)

#### Scenario: Empty state for new user

- **WHEN** a user has not placed any bets yet
- **THEN** the history page SHALL display an empty state message ("No bets placed yet") with a link to the fixtures page

#### Scenario: Pending bets shown for scheduled matches

- **WHEN** a user views their bet history and a match has not yet finished
- **THEN** the bet row SHALL show the prediction with a "Pending" badge instead of points earned
- **AND** the actual score field SHALL be blank or show "–"

### Requirement: API exposes paginated bet history for authenticated user

The system SHALL expose `GET /api/bets/history?group_id=&limit=50&offset=0` returning a paginated list of the authenticated user's bets joined with match and group data.

#### Scenario: API returns bet history with match details

- **WHEN** an authenticated user calls `GET /api/bets/history`
- **THEN** the API SHALL return a JSON array where each item contains: `bet_id`, `group_id`, `group_name`, `match_id`, `home_team`, `away_team`, `match_date`, `home_score_pred`, `away_score_pred`, `confidence`, `double_up`, `home_score` (actual, nullable), `away_score` (actual, nullable), `points_earned` (nullable), `match_status`
- **AND** results SHALL be ordered by `match_date DESC`

#### Scenario: API paginates results

- **WHEN** the caller provides `limit` and `offset` query parameters
- **THEN** the API SHALL apply them to the SQL query
- **AND** the response SHALL include a `total` count field to allow the client to determine if more pages exist

#### Scenario: API filters by group when group_id provided

- **WHEN** the caller provides a `group_id` query parameter and is a member of that group
- **THEN** the API SHALL return only bets belonging to that group
- **AND** if the caller is not a member of the specified group, the API SHALL return HTTP 403
