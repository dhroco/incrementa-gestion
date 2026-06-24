## MODIFIED Requirements

### Requirement: Platform user creation links pre-existing Keycloak identity

`backend/services/platformUsersAdminService.js` function `createPlatformUser` SHALL validate payload (`email`, `profile_code`, optional `is_active`). It SHALL call `findUserByEmail(normalizedEmail)` on the Microsoft Graph client (`getGraphClient()`). If no user id is returned, it SHALL fail with HTTP **422** and a Spanish (es-CL) message stating that the user does not exist in the Microsoft Entra directory and must be created in the tenant first. If a `user_profile` row already exists for that email or Graph user `id`, it SHALL fail with HTTP **409** and a Spanish message that the user is already registered. On success it SHALL `INSERT` into `user_profile` using the Graph user `id` (oid) as `user_id`. It SHALL NOT call Keycloak admin APIs, `createUser`, `deleteUser`, `resetUserPassword`, or `generateTempPassword`. The API response SHALL NOT include a temporary password.

#### Scenario: Successful registration when Entra user exists

- **WHEN** a platform admin posts valid user data for an email that exists in the Entra tenant but not in `user_profile`
- **THEN** the service resolves the Graph user id via `findUserByEmail`
- **AND** inserts `user_profile` with that `user_id`
- **AND** returns HTTP **201** with the created user record and no password field

#### Scenario: Email not found in Entra tenant

- **WHEN** `findUserByEmail` returns no match for the submitted email
- **THEN** the API responds with HTTP **422** and code `IDP_USER_NOT_FOUND`
- **AND** the error message instructs the admin to create the user in Microsoft Entra first

#### Scenario: Duplicate platform registration

- **WHEN** the email or Graph user id is already linked in `user_profile`
- **THEN** the API responds with HTTP **409**
- **AND** the error message states the user is already registered in the system

#### Scenario: Graph client unavailable

- **WHEN** the Graph client is null or the lookup fails due to infrastructure/network error
- **THEN** the API responds with HTTP **503** and code `ADMIN_CLIENT_UNAVAILABLE`
- **AND** the message is distinct from the "user not found" case

### Requirement: Platform user create UI has no password flow

`frontend/src/pages/PlatformUserCreatePage.jsx` SHALL NOT display fields, copy, or success states related to temporary passwords. On successful create it SHALL show a success toast and navigate to the platform users list. When the API returns the Entra-not-found error, the form SHALL show a Spanish message indicating the email is not registered in the authentication directory and must be created in Microsoft Entra first.

#### Scenario: Successful create redirects to list

- **WHEN** the admin submits a valid form and the API returns success
- **THEN** a success toast is shown
- **AND** the user is redirected to the users list route

#### Scenario: Entra missing user shows form error

- **WHEN** the API returns HTTP **422** for IdP user not found
- **THEN** the form displays the Spanish Entra-first message
- **AND** no temporary password UI is shown
