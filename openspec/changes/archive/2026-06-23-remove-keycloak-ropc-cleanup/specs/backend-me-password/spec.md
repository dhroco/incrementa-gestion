## MODIFIED Requirements

### Requirement: Application password endpoints retired

The application SHALL NOT expose `PUT /api/me/password` or `POST /api/me/password-rotation-complete`. Password creation, rotation, and reset SHALL be performed only in Microsoft Entra (admin portal or Entra self-service password reset configured by the tenant).

#### Scenario: Password update endpoint not registered

- **WHEN** a client calls `PUT /api/me/password` with a valid Bearer token
- **THEN** the response is HTTP **404** (route not registered)

#### Scenario: Password rotation complete endpoint not registered

- **WHEN** a client calls `POST /api/me/password-rotation-complete` with a valid Bearer token
- **THEN** the response is HTTP **404** (route not registered)
