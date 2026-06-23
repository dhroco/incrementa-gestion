## ADDED Requirements

### Requirement: Authenticated user can change own password

The backend SHALL expose `PUT /api/me/password` protected by OIDC Bearer authentication (`requireAuth` / `requireOidcAuth`). The authenticated subject `req.auth.userId` SHALL be the Keycloak user UUID whose password is reset. The request body SHALL be JSON with `newPassword` (string).

#### Scenario: Successful password update

- **WHEN** an authenticated user sends `{ "newPassword": "NuevaClave123!" }` with at least 8 characters
- **THEN** the response status is **200**
- **AND** the JSON body includes message **"Contraseña actualizada correctamente."** (es-CL)
- **AND** Keycloak stores the new password as non-temporary (`temporary: false`)

#### Scenario: Unauthenticated request

- **WHEN** a client calls `PUT /api/me/password` without a valid Bearer token
- **THEN** the response status is **401** per existing OIDC middleware behavior

### Requirement: newPassword validation on backend

The handler SHALL reject requests where `newPassword` is missing, not a string, or shorter than 8 characters with HTTP **400** and a validation error code/message in Spanish (es-CL).

#### Scenario: Password too short

- **WHEN** the body is `{ "newPassword": "abc" }`
- **THEN** the response status is **400**
- **AND** the error message is in Spanish (es-CL)

#### Scenario: Missing newPassword

- **WHEN** the body omits `newPassword`
- **THEN** the response status is **400**

### Requirement: Keycloak errors map to AUTH_UPDATE_FAILED

If Keycloak Admin API password reset fails, the API SHALL respond with HTTP **422**, error code `AUTH_UPDATE_FAILED`, and a user-safe message in Spanish (es-CL) without exposing raw Keycloak internals.

#### Scenario: Keycloak user not found

- **WHEN** `resetUserPassword` fails with a not-found condition from Keycloak
- **THEN** the response status is **422**
- **AND** `error.code` is `AUTH_UPDATE_FAILED`

### Requirement: Route registered with other me endpoints

`PUT /api/me/password` SHALL be registered in `backend/app.js` alongside existing `/api/me/*` routes and SHALL use the same authentication middleware as `GET /api/me/session`.

#### Scenario: Route discoverability for frontend

- **WHEN** the frontend calls `PUT /api/me/password` with a valid session token
- **THEN** the request is handled by the password update handler (not a 404)
