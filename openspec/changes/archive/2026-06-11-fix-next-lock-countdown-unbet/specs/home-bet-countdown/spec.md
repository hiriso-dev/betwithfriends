## ADDED Requirements

### Requirement: Next-bet-lock countdown tracks the next un-bet match

The home dashboard's "🔒 Next bet locks in" countdown SHALL be computed from the kickoff of the next **un-bet** upcoming match — the earliest scheduled match (kickoff in the future) for which the user has not placed a bet — rather than from the next upcoming match overall. The displayed match name, the countdown value, and the button's bet target SHALL all reference that same un-bet match.

#### Scenario: Next upcoming match is already bet

- **WHEN** the next upcoming match by kickoff has a bet placed, but a later upcoming match does not
- **THEN** the "Next bet locks in" countdown counts down to the later, un-bet match's kickoff
- **AND** the match name shown beside the countdown is that un-bet match
- **AND** clicking the countdown opens the bet sheet for that un-bet match

#### Scenario: No upcoming match is bet yet

- **WHEN** the user has not bet on the next upcoming match
- **THEN** the countdown counts down to that next upcoming match's kickoff (unchanged from prior behaviour)

### Requirement: Countdown hides when no un-bet match deadline remains

When there is no un-bet upcoming match, the match-lock deadline SHALL NOT contribute to the countdown. The countdown section SHALL be shown only if another actionable deadline (the special-bets close) is still pending; otherwise it SHALL be hidden.

#### Scenario: All upcoming matches are bet and specials not pending

- **WHEN** every upcoming match has a bet placed AND no special-bets deadline is pending
- **THEN** the "Next bet locks in" countdown section is not rendered

#### Scenario: All upcoming matches are bet but specials still open

- **WHEN** every upcoming match has a bet placed AND the special-bets deadline is still in the future before tournament start
- **THEN** the countdown section is shown tracking the special-bets close deadline (labelled "⭐ Special bets close in"), not a match lock

### Requirement: Special-bets deadline behaviour is preserved

The countdown SHALL continue to take the soonest of the next un-bet match lock and the pending special-bets close (`WC_START` while the tournament has not started and not all specials are placed). When the special-bets deadline is the soonest, the section SHALL display the special-bets label and link to the specials page.

#### Scenario: Special-bets deadline is sooner than the next un-bet match

- **WHEN** the special-bets close deadline is earlier than the next un-bet match's kickoff
- **THEN** the countdown tracks the special-bets deadline and clicking it navigates to the specials page
