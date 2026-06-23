## MODIFIED Requirements

### Requirement: Delete user from application realm

The client SHALL expose `deleteUser(userId)` that sends `DELETE` to `/admin/realms/{realm}/users/{userId}`. HTTP-driven platform user creation SHALL NOT call `deleteUser` for compensating rollback. The method remains available for operational scripts (e.g. `backend/scripts/delete-app-user.js`).

#### Scenario: Ops script deletes Keycloak user after profile removal

- **WHEN** `delete-app-user.js` runs with confirmation for an existing platform admin
- **THEN** the script deletes `user_profile` in the database
- **AND** calls `deleteUser` with the Keycloak `user_id` from that profile
