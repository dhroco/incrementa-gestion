## ADDED Requirements

### Requirement: Reset user password in application realm

The Keycloak admin client SHALL expose `resetUserPassword(userId, newPassword)` that sends `PUT` to `{KEYCLOAK_ADMIN_URL}/admin/realms/{KEYCLOAK_REALM}/users/{userId}/reset-password` with JSON body `{ "type": "password", "value": "<newPassword>", "temporary": false }`. The function SHALL use the cached master-realm admin token like other admin operations. On success it SHALL resolve without a return value. On failure it SHALL throw or return an error mappable to HTTP **422** with code `AUTH_UPDATE_FAILED` at the HTTP handler layer.

#### Scenario: Mandatory password change flow

- **WHEN** `PUT /api/me/password` is invoked for a valid authenticated user
- **THEN** `resetUserPassword` is called with `userId` equal to `req.auth.userId`
- **AND** the user can log in with the new password via `POST /api/auth/login`

#### Scenario: Non-temporary credential

- **WHEN** `resetUserPassword` succeeds
- **THEN** Keycloak does not mark the password as temporary
- **AND** `requiredActions` are not set by this call

#### Scenario: Admin client unavailable

- **WHEN** Keycloak admin configuration is missing and `getKeycloakAdminClient()` returns null
- **THEN** the password endpoint responds with HTTP **503** and an appropriate unavailable code (consistent with other admin operations)
