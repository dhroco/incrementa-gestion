## MODIFIED Requirements

### Requirement: Platform user provisioning uses Keycloak admin client

`backend/services/platformUsersAdminService.js` SHALL NOT use the Keycloak admin client for platform user create or update at runtime. Platform user creation SHALL validate identities via Microsoft Graph (`findUserByEmail`) as specified in `platform-users-idp-register-only`. Platform user update SHALL NOT call `updateUserEmail`. The Keycloak admin client remains available for operational scripts (e.g. `backend/scripts/delete-app-user.js`) only.

#### Scenario: Create platform user does not call Keycloak

- **WHEN** a platform admin creates a user via `POST /api/platform/users`
- **THEN** the service resolves the user id via Microsoft Graph, not Keycloak `findUserIdByEmail`
- **AND** no Keycloak Admin REST calls occur during the HTTP request

#### Scenario: Update platform user does not sync email to Keycloak

- **WHEN** an admin updates a platform user's role or active flag
- **THEN** Keycloak `updateUserEmail` is not invoked

## REMOVED Requirements

### Requirement: Update user email in Keycloak

**Reason**: Email is Entra identity and is fixed at platform user creation; Graph permission is read-only (`User.Read.All`). Email changes are out of scope for platform user edit.

**Migration**: Admins must manage email changes in Microsoft Entra; platform `user_profile.email` is set only on create. Operational Keycloak email update remains in `keycloakAdminClient.js` for legacy scripts until Keycloak removal (stage 5.5).

### Requirement: Find user id by email in application realm

**Reason**: User lookup for platform provisioning moves to Microsoft Graph `findUserByEmail` in `backend-graph-client`.

**Migration**: Use `graphClient.findUserByEmail` in `platformUsersAdminService`; retain Keycloak `findUserIdByEmail` in the module for any remaining operational tooling until Keycloak cleanup.
