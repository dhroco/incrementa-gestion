## ADDED Requirements

### Requirement: Keycloak admin configuration in backend config

`backend/config.js` SHALL expose `KEYCLOAK_ADMIN_URL`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, and `KEYCLOAK_REALM` for all environments via `process.env`. `KEYCLOAK_REALM` SHALL default to `incrementa`. `KEYCLOAK_ADMIN_URL` MAY default to `http://localhost:8080` when `ENVIRONMENT` is `local`. `KEYCLOAK_ADMIN_USER` MAY default to `admin`. `KEYCLOAK_ADMIN_PASSWORD` SHALL have no default and SHALL be treated as required for admin operations.

#### Scenario: Local development without admin password

- **WHEN** `ENVIRONMENT` is `local` and `KEYCLOAK_ADMIN_PASSWORD` is unset
- **THEN** the Keycloak admin client factory returns `null`
- **AND** user-provisioning services respond with HTTP **503** and code `ADMIN_CLIENT_UNAVAILABLE`

#### Scenario: Local environment variables script

- **WHEN** a developer runs `backend/SET_VARS_AMBIENTE_LOCAL.cmd`
- **THEN** `KEYCLOAK_ADMIN_PASSWORD` is set to `admin` for local Keycloak
- **AND** Keycloak admin URL/user/realm variables are available to the backend process

### Requirement: Keycloak admin client uses native fetch only

The backend SHALL provide `backend/lib/keycloakAdminClient.js` that performs all Keycloak Admin REST calls using the runtime native `fetch` API. The module SHALL NOT import `@supabase/supabase-js` or any new npm package for Keycloak.

#### Scenario: Admin client unavailable without configuration

- **WHEN** required Keycloak admin configuration is missing
- **THEN** `getKeycloakAdminClient()` returns `null`
- **AND** callers do not throw at module load time

### Requirement: Master realm admin token with short-lived cache

The client SHALL obtain an access token from `{KEYCLOAK_ADMIN_URL}/realms/master/protocol/openid-connect/token` using the password grant with `client_id=admin-cli`, `username` from `KEYCLOAK_ADMIN_USER`, and `password` from `KEYCLOAK_ADMIN_PASSWORD`. The client SHALL cache the token in process memory with an expiry derived from `expires_in`. Before each admin operation, if fewer than **10** seconds remain until expiry, the client SHALL obtain a new token.

#### Scenario: Reuse cached token within TTL

- **WHEN** two admin operations run within the cached token lifetime minus the 10-second margin
- **THEN** only one token request is made to the master realm

### Requirement: Create user in application realm with active credentials

The client SHALL expose `createUser({ email, password, firstName, lastName })` that creates a user in `{KEYCLOAK_ADMIN_URL}/admin/realms/{KEYCLOAK_REALM}/users` with `username` equal to `email`, `emailVerified: true`, and `enabled: true`. The client SHALL set the password as an **active** credential (`temporary: false`) and SHALL NOT set `requiredActions` (in particular, SHALL NOT include `UPDATE_PASSWORD`). The function SHALL return the new user's UUID parsed from the HTTP **201** `Location` header.

#### Scenario: Successful user creation and immediate ROPC login

- **WHEN** `createUser` is called with a unique email and valid password
- **THEN** Keycloak responds with HTTP **201**
- **AND** the returned UUID matches the trailing segment of the `Location` header
- **AND** the user can authenticate immediately via `POST /api/auth/login` with that email and password without Keycloak blocking login for required actions

#### Scenario: Must-change-password remains application-controlled

- **WHEN** provisioning services create a user with `must_change_password: true` in `user_profile`
- **THEN** Keycloak does not enforce password rotation via `requiredActions` or temporary credentials
- **AND** the session/API layer continues to enforce `must_change_password` from the database as today

#### Scenario: Duplicate email in Keycloak

- **WHEN** `createUser` is called with an email that already exists in the realm
- **THEN** the client surfaces an error suitable for mapping to HTTP **409** or **422** with code `AUTH_CREATE_FAILED` or `DUPLICATE` at the service layer
- **AND** the error message is in Spanish (es-CL)

### Requirement: Delete user from application realm

The client SHALL expose `deleteUser(userId)` that sends `DELETE` to `/admin/realms/{realm}/users/{userId}`.

#### Scenario: Compensating delete after database failure

- **WHEN** a service created a Keycloak user and the subsequent database transaction fails
- **THEN** the service calls `deleteUser` with the Keycloak user id before returning the error to the API client

### Requirement: Technical debt comment for Entra ID migration

`backend/lib/keycloakAdminClient.js` SHALL include a code comment documenting that when migrating to **Microsoft Entra ID**, the `must_change_password` application flag should be replaced by the IdP's native mechanisms (password policies / Conditional Access), and that `user_profile.must_change_password` will become obsolete at that stage.

#### Scenario: Implementer reads client module

- **WHEN** a developer opens `keycloakAdminClient.js`
- **THEN** the Entra ID / `must_change_password` migration note is visible near the module's user-provisioning responsibilities

### Requirement: Update user email in Keycloak

The client SHALL expose `updateUserEmail(userId, email)` that updates the Keycloak user so `email`, `username`, and `emailVerified: true` stay consistent for email-based ROPC login.

#### Scenario: Platform user email change

- **WHEN** an admin updates a platform user's email through the existing update service
- **THEN** Keycloak receives the email/username update before or after the database update according to the existing service order
- **AND** failure to update Keycloak returns HTTP **422** with code `AUTH_UPDATE_FAILED`

### Requirement: User provisioning services use Keycloak admin client

`backend/services/accountantAdminService.js`, `backend/services/platformUsersAdminService.js`, and `backend/services/internalCompanyUsersService.js` SHALL use the Keycloak admin client instead of `getSupabaseAdminClient()` for `createUser`, compensating `deleteUser`, and email updates. They SHALL persist `user_profile.user_id` with the UUID returned from Keycloak. They SHALL NOT call `admin.auth.admin.createUser` or other Supabase Auth admin APIs.

#### Scenario: Create accountant end-to-end

- **WHEN** a platform admin creates an accountant via the existing API
- **THEN** a user exists in Keycloak realm `incrementa` with matching UUID
- **AND** `user_profile.user_id` equals that UUID
- **AND** the response may include `temporary_password` as today

#### Scenario: Login after provisioning

- **WHEN** a newly provisioned user submits `POST /api/auth/login` with the generated initial password
- **THEN** authentication succeeds against Keycloak without IdP-required password update blocking ROPC
- **AND** the issued JWT `sub` equals `user_profile.user_id`

### Requirement: Password rotation complete unchanged in controller

`POST /api/me/password-rotation-complete` SHALL continue to clear `user_profile.must_change_password` in the database without calling Supabase Auth admin APIs. No change to `requireOidcAuth` or session endpoints is required for this behavior.

#### Scenario: Accountant completes password rotation flag

- **WHEN** an authenticated accountant calls password rotation complete after changing password in Keycloak
- **THEN** the API returns success with `must_change_password: false`
- **AND** no Supabase admin client is invoked

### Requirement: Deletion scripts use only application schema and Keycloak

`backend/scripts/delete-accountant-user.js` and `backend/scripts/delete-app-user.js` SHALL NOT reference or query PostgreSQL schema `auth` (including `auth.users`). The GCP database has no `auth` schema. Scripts SHALL resolve users via `public.user_profile` (and related tables), delete application data, and remove the identity from Keycloak via `deleteUser(user_profile.user_id)`.

#### Scenario: Delete accountant by email

- **WHEN** the delete script runs with `--email` for an existing accountant
- **THEN** the script locates the row via `user_profile` (normalized email), deletes application records, and calls Keycloak `deleteUser` with `user_id`
- **AND** no SQL is executed against `auth.users` or `auth.*`
- **AND** the script does not require Supabase service role configuration
