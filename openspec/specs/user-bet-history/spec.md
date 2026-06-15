# user-bet-history

## Purpose

Lets a group member open another player's (or their own) full bet history for the active group from the rankings list, showing every bet newest-first with prediction, actual score, outcome, and points.

## Requirements

### Requirement: Tapping a ranking row opens that member's bet history

The rankings list SHALL make each member row an interactive control that, when activated, navigates to a view of that member's bet history for the currently selected group.

#### Scenario: Member taps another player

- **WHEN** a member taps a player's row in the rankings for the active group
- **THEN** the app SHALL navigate to that player's bet-history view scoped to the active group
- **AND** the view header SHALL identify whose history is shown (the player's pseudo)

#### Scenario: Member taps their own row

- **WHEN** a member taps their own row in the rankings
- **THEN** the app SHALL open their own full bet history for the active group

### Requirement: Bet history lists all of a member's bets newest first

The bet-history view SHALL list every bet the target member has placed in the scoped group (not only the most recent few), ordered by match date with the most recent match first, and SHALL support paging through the full set.

#### Scenario: Full history is shown, not just recent results

- **WHEN** the bet-history view loads for a member with more bets than one page
- **THEN** the most recent matches SHALL appear at the top
- **AND** a control SHALL allow loading the remaining older bets until the entire history is shown

### Requirement: Each bet row shows prediction, actual score, and points

For each listed bet the view SHALL display the member's predicted score, the match's actual score, an outcome indicator, and the points earned for that bet.

#### Scenario: Finished match row

- **WHEN** a listed bet is for a `finished` match
- **THEN** the row SHALL show the predicted score, the actual score, an outcome label (exact / correct / wrong), and the points earned

#### Scenario: Started but unfinished match row

- **WHEN** a listed bet is for a match that has started but is not `finished`
- **THEN** the row SHALL show the predicted score and a pending/live indicator instead of points
