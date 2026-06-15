# bet-visibility

## Purpose

Defines when other group members' predictions for a match become visible, and what is shown — predictions become visible to the group as soon as a match starts (when betting locks at kickoff), while points and ranking remain reserved for finished matches. Predictions stay private before kickoff.

## Requirements

### Requirement: Other members' bets are revealed once a match starts

The system SHALL make a group's predictions for a match visible to its members as soon as the match's kickoff time has passed (the moment betting locks), regardless of whether the match status is still `scheduled`, `live`, or `finished`. Before kickoff, predictions other than the viewer's own SHALL remain hidden.

#### Scenario: Eye affordance appears at kickoff while status is still scheduled

- **WHEN** a match's kickoff time has passed but its status is still `scheduled` (score not yet synced)
- **THEN** the match card SHALL render the 👁 "see everyone's bets" control in place of the `vs` placeholder
- **AND** activating it SHALL open the match's bets page for the active group

#### Scenario: Eye affordance present when live or finished

- **WHEN** a match status is `live` or `finished`
- **THEN** the match card SHALL render the 👁 "see everyone's bets" control

#### Scenario: Predictions stay private before kickoff

- **WHEN** a match's kickoff time has not yet passed and its status is `scheduled`
- **THEN** the match card SHALL show the `vs` placeholder and SHALL NOT expose the 👁 control
- **AND** other members' predictions SHALL NOT be retrievable

### Requirement: Started matches show predictions without points

The bets page SHALL display each group member's prediction (predicted score, confidence, and Double Up marker) for a match whose kickoff has passed. Points earned and ranking SHALL be shown only once the match is `finished`.

#### Scenario: Viewing bets for a started, unfinished match

- **WHEN** a member opens the bets page for a match that has started but is not `finished`
- **THEN** the page SHALL list members' predicted scores with confidence and Double Up markers
- **AND** the page SHALL NOT show points earned or a points-based ranking

#### Scenario: Viewing bets for a finished match

- **WHEN** a member opens the bets page for a `finished` match
- **THEN** the page SHALL show each prediction's result label, points earned, and rank order by points

#### Scenario: Pending score before sync

- **WHEN** a match has started but no score has synced yet
- **THEN** the score area SHALL display the pending indicator (`–`) rather than an assumed `0 – 0`

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
