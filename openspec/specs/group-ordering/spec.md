# group-ordering

## Purpose

Lets each user define a personal display order for the groups they belong to. The order is persisted server-side (scoped to the user, so it never affects other members), drives `GET /api/groups`, and is therefore applied consistently to the My Groups list and to every group tab/selector across the app. When a user has not set a custom order, a deterministic, stable default is used, and newly joined or created groups are appended.

## Requirements

### Requirement: User-defined group display order is persisted per user

The system SHALL let each user define a personal display order for the groups they belong to, and SHALL persist that order on the server scoped to the user. One user's ordering SHALL NOT affect the order any other member of the same group sees.

#### Scenario: Reordering on the My Groups screen persists

- **WHEN** a user reorders their groups on the My Groups screen and the reorder is saved
- **THEN** the system SHALL store the new position for each of that user's group memberships
- **AND** reloading the app SHALL show the groups in the saved order

#### Scenario: Order is private to the user

- **WHEN** two users belong to the same set of groups but have chosen different orders
- **THEN** each user SHALL see their own order
- **AND** neither user's reordering SHALL change the order the other sees

#### Scenario: Reorder request only affects the requesting user's groups

- **WHEN** a user submits an ordering that includes a group ID they are not a member of, or omits a group they belong to
- **THEN** the system SHALL apply positions only to the requesting user's own memberships
- **AND** SHALL ignore any group ID the user does not belong to

### Requirement: Group list and all group tabs render in the user's order

The system SHALL return the user's groups from `GET /api/groups` in the user's defined display order, and every group tab/selector in the app (My Groups list, home, fixtures, rankings, history, special, and the per-match bets view) SHALL render groups in that same order.

#### Scenario: Tabs reflect the saved order across pages

- **WHEN** a user has set a custom group order and opens any page that shows a group tab/selector
- **THEN** the group tabs SHALL appear in the user's saved order
- **AND** the order SHALL be consistent across all such pages

#### Scenario: Default order is stable when no custom order is set

- **WHEN** a user has never reordered their groups
- **THEN** `GET /api/groups` SHALL return them in a deterministic, stable order
- **AND** the order SHALL NOT change arbitrarily between requests

#### Scenario: Newly joined or created group has a defined position

- **WHEN** a user joins or creates a group after having set a custom order
- **THEN** the new group SHALL be assigned a deterministic position relative to the existing ones (appended, not inserted ahead of explicitly ordered groups)
- **AND** the overall list SHALL remain stable on subsequent loads until the user reorders again
