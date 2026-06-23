# platform-users-idp-register-only Specification

## Purpose
TBD - created by archiving change platform-users-idp-register-only. Update Purpose after archive.
## Requirements
### Requirement: Platform user creation links pre-existing Keycloak identity

`backend/services/platformUsersAdminService.js` function `createPlatformUser` SHALL validate payload (`email`, `fullName`, `roleId`, optional profile fields). It SHALL call `findUserIdByEmail(normalizedEmail)` on the Keycloak admin client. If no user id is returned, it SHALL fail with HTTP **422** and a Spanish (es-CL) message stating that the user does not exist in the authentication server and must be created in Keycloak first. If a `user_profile` row already exists for that email or Keycloak `user_id`, it SHALL fail with HTTP **409** and a Spanish message that the user is already registered. On success it SHALL `INSERT` into `user_profile` using the Keycloak UUID as `user_id`, without setting `must_change_password` (column removed). It SHALL NOT call `createUser`, `deleteUser`, `resetUserPassword`, or `generateTempPassword`. The API response SHALL NOT include a temporary password.

#### Scenario: Successful registration when Keycloak user exists

- **WHEN** a platform admin posts valid user data for an email that exists in Keycloak but not in `user_profile`
- **THEN** the service resolves the Keycloak UUID via `findUserIdByEmail`
- **AND** inserts `user_profile` with that `user_id`
- **AND** returns HTTP **201** with the created user record and no password field

#### Scenario: Email not found in Keycloak

- **WHEN** `findUserIdByEmail` returns no match for the submitted email
- **THEN** the API responds with HTTP **422**
- **AND** the error message instructs the admin to create the user in Keycloak first

#### Scenario: Duplicate platform registration

- **WHEN** the email or Keycloak id is already linked in `user_profile`
- **THEN** the API responds with HTTP **409**
- **AND** the error message states the user is already registered in the system

#### Scenario: Keycloak admin unavailable

- **WHEN** the Keycloak admin client is null or the lookup fails due to infrastructure/network error
- **THEN** the API responds with HTTP **503** (or the project's standard IdP-unavailable code)
- **AND** the message is distinct from the "user not found" case

### Requirement: Database migration removes must_change_password

A Knex migration named with current timestamp prefix `drop_must_change_password` SHALL execute `ALTER TABLE user_profile DROP COLUMN must_change_password` in `up`. The `down` migration MAY re-add the column as boolean default `false` for rollback only.

#### Scenario: Schema after migrate latest

- **WHEN** `knex migrate:latest` completes on a database that had `must_change_password`
- **THEN** `user_profile` has no column `must_change_password`

### Requirement: Platform user create UI has no password flow

`frontend/src/pages/PlatformUserCreatePage.jsx` SHALL NOT display fields, copy, or success states related to temporary passwords. On successful create it SHALL show a success toast and navigate to the platform users list. When the API returns the Keycloak-not-found error, the form SHALL show: "Este email no está registrado en el servidor de autenticación. El administrador debe crear el usuario en Keycloak primero."

#### Scenario: Successful create redirects to list

- **WHEN** the admin submits a valid form and the API returns success
- **THEN** a success toast is shown
- **AND** the user is redirected to the users list route

#### Scenario: Keycloak missing user shows form error

- **WHEN** the API returns HTTP **422** for IdP user not found
- **THEN** the form displays the Spanish Keycloak-first message
- **AND** no temporary password UI is shown

### Requirement: No application-managed mandatory password change

The system SHALL NOT expose `PUT /api/me/password`, `POST /api/me/password-rotation-complete`, `MandatoryPasswordChangePage`, or router guards that redirect based on `mustChangePassword`. Password changes SHALL be performed only in Keycloak.

#### Scenario: Password endpoints removed

- **WHEN** a client calls `PUT /api/me/password` or `POST /api/me/password-rotation-complete`
- **THEN** the response is HTTP **404** (route not registered)

#### Scenario: Authenticated user accesses app without password gate

- **WHEN** a user with a valid session and `is_active` profile loads `/app/*`
- **THEN** no redirect occurs to a mandatory password change route

