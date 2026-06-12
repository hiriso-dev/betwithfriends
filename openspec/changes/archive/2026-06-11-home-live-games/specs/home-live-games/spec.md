## ADDED Requirements

### Requirement: Home dashboard shows a Live now section for in-progress matches

The home dashboard SHALL render a "Live now" section listing every match for the selected group whose status is `live`. The section SHALL appear near the top of the main column, above the "Next bet" call-to-action. When no match in the selected group is `live`, the section SHALL NOT be rendered.

#### Scenario: One or more matches are live

- **WHEN** the home dashboard loads and at least one match for the selected group has status `live`
- **THEN** a "Live now" section SHALL be rendered listing each such match
- **AND** the section SHALL appear above the "Next bet" call-to-action

#### Scenario: No matches are live

- **WHEN** no match for the selected group has status `live`
- **THEN** the "Live now" section SHALL NOT be rendered

#### Scenario: Section reflects the selected group

- **WHEN** the user switches the active group via the group selector
- **THEN** the "Live now" section SHALL list the live matches for the newly selected group

### Requirement: Each live game row shows teams, current score, and a live indicator

Each row in the "Live now" section SHALL show both teams (flag and team code), the current synced score, and a `● Live` indicator. The score SHALL be rendered using the shared match-score display helper so that a not-yet-synced score shows the pending indicator rather than an assumed `0 – 0`.

#### Scenario: Live row with a synced score

- **WHEN** a live match has a synced score
- **THEN** its row SHALL display both teams with flags and the current score
- **AND** the row SHALL display a `● Live` indicator

#### Scenario: Live match before its first score sync

- **WHEN** a match status is `live` but no score has synced yet
- **THEN** the row's score area SHALL display the pending indicator rather than `0 – 0`

### Requirement: Live game rows expose the see-everyone's-bets affordance

Each live game row SHALL expose the 👁 "see everyone's bets" affordance. Activating it SHALL open the match's bets page for the active group (`/matches/[id]/bets?group_id=…`), consistent with the eye control on the match card defined by the bet-visibility capability.

#### Scenario: Opening bets from a live game row

- **WHEN** the user activates the 👁 control on a live game row
- **THEN** the app SHALL navigate to that match's bets page scoped to the active group
- **AND** the destination SHALL be the same bets page reached from the match-card eye control

### Requirement: Live now section refreshes with live scores

The "Live now" section SHALL update its scores in step with the home dashboard's existing live-score poller, without requiring a manual reload. While any match is `live`, the dashboard re-fetches matches periodically and the section SHALL reflect the latest scores and statuses.

#### Scenario: Score advances during play

- **WHEN** a listed live match's score changes on the next poll
- **THEN** the row SHALL display the updated score without a manual page reload

#### Scenario: Match finishes

- **WHEN** a listed live match's status changes to `finished` on the next poll
- **THEN** the match SHALL be removed from the "Live now" section
