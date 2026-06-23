## MODIFIED Requirements

### Requirement: Platform user provisioning uses Keycloak admin client

`backend/services/platformUsersAdminService.js` SHALL use the Keycloak admin client instead of Supabase Auth admin APIs for `createUser`, compensating `deleteUser`, and email updates. It SHALL persist `user_profile.user_id` with the UUID returned from Keycloak. It SHALL NOT call Supabase Auth admin APIs.

#### Scenario: Create platform user end-to-end

- **WHEN** a platform admin creates a user via `/api/platform/users`
- **THEN** Keycloak receives the new user
- **AND** `user_profile` stores the Keycloak subject UUID

## REMOVED Requirements

### Requirement: Accountant and internal company user services use Keycloak admin client

**Reason**: Services `accountantAdminService` and `internalCompanyUsersService` are deleted with their profiles.

**Migration**: User lifecycle for remaining profiles is handled only via `platformUsersAdminService` and `delete-app-user.js` (updated scope).

### Requirement: Delete scripts resolve users without auth schema

**Reason**: `delete-accountant-user.js` is removed; only `delete-app-user.js` remains for operational cleanup.

**Migration**: Use `delete-app-user.js` with updated logic that does not branch on `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`.

#### Scenario: Delete accountant by email

- **WHEN** an operator attempts to run the removed delete-accountant script
- **THEN** the script file does not exist in the repository
