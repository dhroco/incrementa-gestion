# backend-auth-session-endpoints Specification

## Purpose
OIDC auth endpoints (login, refresh, logout) and enriched session API for authenticated users.
## Requirements
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

### Requirement: Enriched session excludes removed profile behaviors

`GET /api/me/session` (and alias `/api/me/authorization/current`) SHALL NOT include response fields `assignedCompanies` or accountant-specific inactive handling for profile codes `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`. The handler SHALL NOT return HTTP 403 with an accountant-inactive error body. Session meta loading SHALL NOT query table `accountant`. Automatic injection of `company` context based on `USUARIO_EMPRESA_ADMINISTRADOR` scope SHALL NOT occur.

#### Scenario: Platform admin session payload shape

- **WHEN** a user with only profile `ADMINISTRADOR_PLATAFORMA` calls `GET /api/me/session`
- **THEN** the response status is **200**
- **AND** the JSON body does not contain property `assignedCompanies`
- **AND** `profile.code` is `ADMINISTRADOR_PLATAFORMA`

#### Scenario: No accountant inactive gate

- **WHEN** any authenticated user calls `GET /api/me/session`
- **THEN** the server does not respond with the accountant-inactive error code/body previously produced for disabled accountants

### Requirement: Enriched session returns CASL permissions instead of navigation

`GET /api/me/session` and alias `GET /api/me/authorization/current` SHALL include property `permissions` containing packed CASL rules from `buildPackedRulesForUser(userId)` for the authenticated user. The response SHALL include `profile: { code, label }`, identity fields (`userId`, `email`, `name` where applicable), session meta (`isActive`), and SHALL NOT include property `navigation` with `tree`, `routes`, or `grantedCodes`. The response SHALL NOT include `mustChangePassword`.

#### Scenario: Platform admin session includes packed rules

- **WHEN** a user with profile `ADMINISTRADOR_PLATAFORMA` calls `GET /api/me/session` with a valid Bearer token
- **THEN** the response status is **200**
- **AND** the JSON body contains property `permissions` (array)
- **AND** the JSON body does not contain property `navigation`
- **AND** `profile.code` is `ADMINISTRADOR_PLATAFORMA`
- **AND** `mustChangePassword` is absent from the response body

#### Scenario: Session without profile still follows existing error contract

- **WHEN** an authenticated user has no assigned profile
- **THEN** the handler responds as today (e.g. **404** with no-profile body) and does not return permissions

### Requirement: Enriched session includes profile extras

`GET /api/me/session` and alias `GET /api/me/authorization/current` SHALL include optional profile fields from `user_profile` when present: `contact_email` (string), `widget_preferences` (object with boolean keys `suppliers`, `contracts`, `templates`), and `avatar_url` (string signed GCS URL valid 1440 minutes). The handler SHALL load `avatar_gcs_path`, `contact_email`, and `widget_preferences` via `loadSessionMetaForUser`. When `avatar_gcs_path` is non-null, the server SHALL generate `avatar_url` using `gcsService.getSignedUrl({ gcsPath, expiresInMinutes: 1440 })` and SHALL NOT expose the raw GCS path to the client.

#### Scenario: User with avatar receives signed URL in session

- **WHEN** an authenticated user has `avatar_gcs_path` set in `user_profile`
- **THEN** `GET /api/me/session` returns **200**
- **AND** the JSON body includes property `avatar_url` as a non-empty string
- **AND** the body does not include `avatar_gcs_path`

#### Scenario: User with contact email and widget preferences

- **WHEN** an authenticated user has `contact_email` and `widget_preferences` set
- **THEN** `GET /api/me/session` returns **200**
- **AND** the JSON body includes `contact_email` matching the stored value
- **AND** the JSON body includes `widget_preferences` as a JSON object

#### Scenario: User without profile extras omits optional fields

- **WHEN** an authenticated user has NULL for all three profile extra columns
- **THEN** `GET /api/me/session` returns **200**
- **AND** the JSON body does not include `avatar_url`, `contact_email`, or `widget_preferences` (or they are omitted/null per existing optional-field convention)

