## Purpose

Backend Keycloak Admin REST client and related provisioning behavior for creating users, updating credentials and email, and deleting identities aligned with `user_profile.user_id`.
## Requirements
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

### Requirement: Delete user from application realm

The client SHALL expose `deleteUser(userId)` that sends `DELETE` to `/admin/realms/{realm}/users/{userId}`. HTTP-driven platform user creation SHALL NOT call `deleteUser` for compensating rollback. The method remains available for operational scripts (e.g. `backend/scripts/delete-app-user.js`).

#### Scenario: Ops script deletes Keycloak user after profile removal

- **WHEN** `delete-app-user.js` runs with confirmation for an existing platform admin
- **THEN** the script deletes `user_profile` in the database
- **AND** calls `deleteUser` with the Keycloak `user_id` from that profile

### Requirement: Update user email in Keycloak

The client SHALL expose `updateUserEmail(userId, email)` that updates the Keycloak user so `email`, `username`, and `emailVerified: true` stay consistent for email-based ROPC login.

#### Scenario: Platform user email change

- **WHEN** an admin updates a platform user's email through the existing update service
- **THEN** Keycloak receives the email/username update before or after the database update according to the existing service order
- **AND** failure to update Keycloak returns HTTP **422** with code `AUTH_UPDATE_FAILED`

### Requirement: Platform user provisioning uses Keycloak admin client

`backend/services/platformUsersAdminService.js` SHALL use the Keycloak admin client for **lookup by email** (`findUserIdByEmail`) when creating platform users and for **email updates** (`updateUserEmail`) on edit. It SHALL persist `user_profile.user_id` with the UUID returned from Keycloak lookup on create. It SHALL NOT call `createUser`, compensating `deleteUser`, or `resetUserPassword` from HTTP-driven flows. It SHALL NOT call Supabase Auth admin APIs.

#### Scenario: Create platform user end-to-end

- **WHEN** a platform admin creates a user via `POST /api/platform/users` with an email that already exists in Keycloak
- **THEN** the service resolves the Keycloak subject UUID via `findUserIdByEmail`
- **AND** `user_profile` stores that UUID as `user_id`
- **AND** no Keycloak user is created by the backend

#### Scenario: Login after registration

- **WHEN** a user registered in the platform logs in via `POST /api/auth/login` with credentials set in Keycloak
- **THEN** authentication succeeds against Keycloak
- **AND** the issued JWT `sub` equals `user_profile.user_id`

### Requirement: Deletion scripts use only application schema and Keycloak

`backend/scripts/delete-app-user.js` SHALL NOT reference or query PostgreSQL schema `auth` (including `auth.users`). The GCP database has no `auth` schema. The script SHALL resolve users via `public.user_profile` (and related tables), delete application data for `ADMINISTRADOR_PLATAFORMA` only, and remove the identity from Keycloak via `deleteUser(user_profile.user_id)`.

#### Scenario: Delete platform user by email

- **WHEN** the delete script runs with `--email` for an existing platform admin user
- **THEN** the script locates the row via `user_profile` (normalized email), deletes application records, and calls Keycloak `deleteUser` with `user_id`
- **AND** no SQL is executed against `auth.users` or `auth.*`
- **AND** the script does not require Supabase service role configuration

### Requirement: Find user id by email in application realm

The Keycloak admin client SHALL expose `findUserIdByEmail(email)` that queries `{KEYCLOAK_ADMIN_URL}/admin/realms/{KEYCLOAK_REALM}/users?email={encodedEmail}&exact=true` (or the project's existing query shape). When exactly one user matches, it SHALL return `{ id, fullName }` where `id` is the Keycloak user UUID and `fullName` is built by joining non-empty `firstName` and `lastName` from the Keycloak user record (trimmed, single space). If both name parts are empty or undefined, `fullName` SHALL be the normalized email argument. When no user matches, it SHALL return `null`. On admin client unavailable it SHALL behave consistently with other admin operations (null client → caller maps to **503**). On Keycloak admin errors (network, token, etc.) it SHALL throw `KeycloakAdminError` as today.

#### Scenario: Existing Keycloak user with name resolved

- **WHEN** `findUserIdByEmail` is called for an email present in the realm with `firstName` and `lastName`
- **THEN** the function returns `{ id: <uuid>, fullName: "<firstName> <lastName>" }`

#### Scenario: Existing Keycloak user without name parts

- **WHEN** `findUserIdByEmail` is called for an email present in the realm but `firstName` and `lastName` are empty
- **THEN** the function returns `{ id: <uuid>, fullName: <normalized email> }`

#### Scenario: Unknown email returns null

- **WHEN** no user matches the email in the realm
- **THEN** the function returns `null` without throwing

