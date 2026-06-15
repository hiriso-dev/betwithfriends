## ADDED Requirements

### Requirement: Bet history hides another member's not-yet-started predictions

When a member views another member's bet history, the system SHALL apply the same kickoff-gated visibility used on the per-match bets page: bets for matches whose kickoff time has not yet passed SHALL be excluded from the response. When a member views their own bet history, all of their bets (including upcoming matches) SHALL remain visible.

#### Scenario: Viewing another member's history with an upcoming bet

- **WHEN** a member requests another member's bet history and that member has a bet on a match whose kickoff has not yet passed
- **THEN** the response SHALL omit that upcoming bet
- **AND** SHALL include bets for matches whose kickoff has already passed

#### Scenario: Viewing own history with an upcoming bet

- **WHEN** a member requests their own bet history
- **THEN** the response SHALL include their bets for upcoming matches as well as started matches

#### Scenario: Requesting a member outside any shared group

- **WHEN** a member requests a bet history scoped to a group they are not a member of, or for a target user who is not in that group
- **THEN** the system SHALL reject the request rather than reveal the predictions
