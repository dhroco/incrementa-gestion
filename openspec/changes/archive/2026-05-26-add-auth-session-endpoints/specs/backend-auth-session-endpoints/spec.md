## ADDED Requirements

### Requirement: Login endpoint proxies Keycloak ROPC

The backend SHALL expose `POST /api/auth/login` without authentication middleware. The request body SHALL be JSON with `email` (string) and `password` (string). The handler SHALL call the Keycloak token endpoint at `{OIDC_ISSUER_URL}/protocol/openid-connect/token` using grant type `password`, passing `username` equal to `email`, plus `client_id` and `client_secret` from server configuration. The backend SHALL NOT store tokens server-side and SHALL NOT expose `client_secret` to the client.

#### Scenario: Successful login

- **WHEN** a client sends valid `email` and `password` for a Keycloak user
- **THEN** the response status is **200**
- **AND** the JSON body contains exactly: `access_token`, `refresh_token`, `expires_in`, `token_type`

#### Scenario: Invalid credentials

- **WHEN** Keycloak rejects the credentials (e.g. HTTP 401 from token endpoint)
- **THEN** the response status is **401**
- **AND** the error message is generic and in Spanish (es-CL), without leaking Keycloak error details

#### Scenario: Missing email or password

- **WHEN** the request body omits `email` or `password` or they are empty strings
- **THEN** the response status is **400**

### Requirement: Refresh endpoint proxies Keycloak refresh grant

The backend SHALL expose `POST /api/auth/refresh` without authentication middleware. The request body SHALL be JSON with `refresh_token` (string). The handler SHALL call the Keycloak token endpoint with `grant_type=refresh_token` and server-side `client_id` / `client_secret`.

#### Scenario: Successful refresh

- **WHEN** a client sends a valid non-expired `refresh_token`
- **THEN** the response status is **200**
- **AND** the JSON body contains: `access_token`, `refresh_token`, `expires_in`, `token_type`

#### Scenario: Invalid refresh token

- **WHEN** Keycloak rejects the refresh token
- **THEN** the response status is **401**

#### Scenario: Missing refresh token

- **WHEN** the request body omits `refresh_token` or it is empty
- **THEN** the response status is **400**

### Requirement: Logout endpoint revokes refresh token

The backend SHALL expose `POST /api/auth/logout` protected by the existing OIDC Bearer middleware (`requireAuth`). The request body SHALL include `refresh_token` (string). The handler SHALL call `{OIDC_ISSUER_URL}/protocol/openid-connect/logout` with `client_id`, `client_secret`, and `refresh_token` to invalidate the refresh token at Keycloak.

#### Scenario: Successful logout

- **WHEN** a client sends a valid Bearer access token and a `refresh_token` in the body
- **THEN** the response status is **200**
- **AND** the JSON body is `{ "ok": true }`

#### Scenario: Missing refresh token on logout

- **WHEN** the request body omits `refresh_token` or it is empty
- **THEN** the response status is **400**

### Requirement: Auth routes registered before protected API

In `backend/app.js`, routes under `/api/auth/login` and `/api/auth/refresh` SHALL be registered without `requireAuth`, and `/api/auth/logout` SHALL use `requireAuth`. These routes SHALL be registered before routes that assume an authenticated user (e.g. `/api/me/session`).

#### Scenario: Login without Bearer token

- **WHEN** a client calls `POST /api/auth/login` without an `Authorization` header
- **THEN** the request is handled by the login handler (not rejected by auth middleware)

### Requirement: OIDC client credentials in configuration

`backend/config.js` SHALL expose `OIDC_CLIENT_ID` (default **`incrementa-backend`** when unset) and `OIDC_CLIENT_SECRET` (from `process.env`, no default in production) for all environments. `backend/SET_VARS_AMBIENTE_LOCAL.cmd` SHALL set `OIDC_CLIENT_SECRET=dev-incrementa-backend-secret` for local development.

#### Scenario: Local client secret available

- **WHEN** a developer loads `SET_VARS_AMBIENTE_LOCAL.cmd` and starts the backend
- **THEN** `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` are available for Keycloak calls

### Requirement: Keycloak communication uses native fetch only

The OIDC auth service SHALL use the runtime's native `fetch` (Node 18+) with `Content-Type: application/x-www-form-urlencoded`. The implementation SHALL NOT add new npm dependencies for HTTP.

#### Scenario: No new HTTP libraries

- **WHEN** this change is merged
- **THEN** `package.json` does not add HTTP client dependencies for auth

### Requirement: IdP network failures return 503

When the backend cannot reach Keycloak due to network failure or similar infrastructure errors, auth endpoints SHALL respond with HTTP **503** (not **401**), with an error message in Spanish (es-CL).

#### Scenario: Keycloak unreachable

- **WHEN** the token endpoint cannot be reached due to a network error
- **THEN** the client receives **503**

### Requirement: No frontend or session middleware changes

This change SHALL NOT modify files under `frontend/`, `backend/middleware/requireOidcAuth.js`, or the behavior of `GET /api/me/session`.

#### Scenario: Scope boundary

- **WHEN** this change is merged
- **THEN** `requireOidcAuth.js` is unchanged
- **AND** no `frontend/` source files are changed
