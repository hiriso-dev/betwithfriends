## ADDED Requirements

### Requirement: Matches without a synced score show an explicit pending-result state

The system SHALL render an explicit pending-result placeholder for a match whose score is not yet available, and SHALL NOT render `0 – 0`, `null – null`, or any other numeric-looking placeholder in place of the missing score. A match's score is considered unavailable when either `home_score` or `away_score` is null. The shared score-display helper SHALL be the single source of this placeholder so every view renders it consistently.

#### Scenario: Game (match detail) page when score not yet synced

- **WHEN** the match detail page renders a match whose `home_score` or `away_score` is null
- **THEN** the primary score SHALL show the pending-result placeholder (`–`) instead of `0 – 0`
- **AND** the accompanying status line SHALL continue to communicate the match state (e.g. `● Live`, `Full time`, or `scheduled`)

#### Scenario: Home recent-results row when a finished match has no score yet

- **WHEN** the home page renders a `finished` match in its recent-results list whose `home_score` or `away_score` is null
- **THEN** the row SHALL show the pending-result placeholder (`–`) instead of `null – null`

#### Scenario: Match card fallback never shows a numeric placeholder

- **WHEN** any match card renders a match whose `home_score` or `away_score` is null
- **THEN** the card SHALL show the pending-result placeholder (`–`) instead of `0 – 0`

#### Scenario: Synced score is unaffected

- **WHEN** a match has both `home_score` and `away_score` populated
- **THEN** the score SHALL render exactly as before, including the regular-time score and any parenthesized real final score for extra-time/penalty matches
- **AND** no pending-result placeholder SHALL be shown

#### Scenario: Helper exposes a pending flag for view styling

- **WHEN** the shared score-display helper is called for a match whose score is null
- **THEN** it SHALL return the pending-result placeholder as the display string
- **AND** it SHALL indicate the pending state so views can label or style it (e.g. a muted "Pending result" hint) without re-deriving the null check
