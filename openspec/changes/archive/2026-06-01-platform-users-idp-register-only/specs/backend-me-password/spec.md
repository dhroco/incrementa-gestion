## REMOVED Requirements

### Requirement: Authenticated user can change own password

**Reason**: Password changes are delegated entirely to Keycloak; the application no longer exposes password management APIs.

**Migration**: Users change password via Keycloak account console or admin reset in Keycloak Admin Console.

### Requirement: newPassword validation on backend

**Reason**: `PUT /api/me/password` is removed.

**Migration**: None.

### Requirement: Keycloak errors map to AUTH_UPDATE_FAILED

**Reason**: Password reset via admin client is removed from application API.

**Migration**: None.

### Requirement: Route registered with other me endpoints

**Reason**: `PUT /api/me/password` route registration is removed from `app.js`.

**Migration**: None.

## ADDED Requirements

### Requirement: Application password endpoints retired

The application SHALL NOT expose `PUT /api/me/password` or `POST /api/me/password-rotation-complete`. Password creation, rotation, and reset SHALL be performed only in Keycloak (Admin Console or user account flows).

#### Scenario: Password update endpoint not registered

- **WHEN** a client calls `PUT /api/me/password` with a valid Bearer token
- **THEN** the response is HTTP **404** (route not registered)

#### Scenario: Password rotation complete endpoint not registered

- **WHEN** a client calls `POST /api/me/password-rotation-complete` with a valid Bearer token
- **THEN** the response is HTTP **404** (route not registered)
