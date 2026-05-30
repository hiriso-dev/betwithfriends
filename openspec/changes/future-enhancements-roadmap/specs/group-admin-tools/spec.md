## ADDED Requirements

### Requirement: Group admins can remove members from their group

The system SHALL allow a group admin to remove any non-admin member from their group via the group detail page. Removal is permanent and deletes the member's group-scoped bets and leaderboard entry.

#### Scenario: Admin removes a member

- **WHEN** a group admin clicks the "Remove" action next to a member on the group detail page and confirms the confirmation dialog
- **THEN** the API SHALL call `DELETE /api/groups/:id/members/:userId`
- **AND** the member's row SHALL be deleted from `group_members`
- **AND** all bets placed by that member within that group SHALL be deleted via cascade
- **AND** the member SHALL disappear from the group leaderboard immediately

#### Scenario: Admin cannot remove themselves

- **WHEN** a group admin attempts to remove their own membership
- **THEN** the API SHALL return HTTP 400 with an error message ("Cannot remove yourself from the group")
- **AND** the remove button SHALL be hidden for the admin's own row in the UI

#### Scenario: Admin cannot remove another admin

- **WHEN** a group admin attempts to remove another member who is also an admin
- **THEN** the API SHALL return HTTP 403 with an error message ("Cannot remove another admin")
- **AND** the remove button SHALL be hidden for any admin row in the UI

#### Scenario: Non-admin cannot call remove-member endpoint

- **WHEN** an authenticated user who is NOT an admin of the group calls `DELETE /api/groups/:id/members/:userId`
- **THEN** the API SHALL return HTTP 403 with an error message

#### Scenario: Remove member requires confirmation

- **WHEN** a group admin clicks the "Remove" button next to a member
- **THEN** the UI SHALL display a confirmation dialog ("Are you sure you want to remove [pseudo] from this group? This cannot be undone.")
- **AND** the removal SHALL only proceed if the admin confirms

#### Scenario: Remove member updates leaderboard in real time

- **WHEN** a member is successfully removed
- **THEN** the group detail page leaderboard SHALL update to exclude the removed member without a full page reload

### Requirement: Remove-member endpoint enforces group membership and admin role

The `DELETE /api/groups/:id/members/:userId` endpoint SHALL be authenticated, verify the caller is an admin of the specified group, and delete the target member along with their group-scoped data.

#### Scenario: Successful removal response

- **WHEN** a valid admin calls `DELETE /api/groups/:groupId/members/:userId` for a non-admin member
- **THEN** the API SHALL return HTTP 200 with `{ "success": true }`

#### Scenario: Target user not in group

- **WHEN** the `userId` in the URL does not correspond to any member of `groupId`
- **THEN** the API SHALL return HTTP 404 with an error message
