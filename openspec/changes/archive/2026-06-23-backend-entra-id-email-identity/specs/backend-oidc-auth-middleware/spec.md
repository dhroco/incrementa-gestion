## MODIFIED Requirements

### Requirement: OIDC JWT middleware validates Bearer tokens

The backend SHALL provide `backend/middleware/requireOidcAuth.js` that validates the `Authorization: Bearer <token>` header using the **jose** library (`createRemoteJWKSet` and `jwtVerify`). On success it SHALL set `req.auth = { userId, email }` where `userId` is the JWT `sub` claim and `email` is derived from the token as specified in the email extraction requirement below. The middleware SHALL NOT add role or custom authorization claims to `req.auth`.

#### Scenario: Valid access token

- **WHEN** a protected route receives a request with a valid, non-expired JWT signed by the configured OIDC issuer
- **THEN** the middleware calls `next()`
- **AND** `req.auth.userId` equals the token `sub`
- **AND** `req.auth.email` equals the normalized email extracted from the token when available

#### Scenario: Missing Bearer token

- **WHEN** a protected route receives a request without a Bearer token
- **THEN** the response status is **401**
- **AND** the error code is `AUTH_MISSING_TOKEN`
- **AND** the message is in Spanish (es-CL)

### Requirement: Application configuration exposes OIDC settings

`backend/config.js` SHALL expose `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, and `OIDC_CLIENT_ID` for all environments (`local`, `dev`, `prod`) via `process.env`, with `process.env` taking precedence over file defaults. For `local` only, when environment variables are unset, defaults SHALL target Microsoft Entra ID:

- `OIDC_ISSUER_URL`: `https://login.microsoftonline.com/60322b4a-13bf-4f19-89ae-efe4a54ffed6/v2.0`
- `OIDC_AUDIENCE`: `dc734f4a-5f25-4e88-b728-aab4715f2122`
- `OIDC_CLIENT_ID`: `dc734f4a-5f25-4e88-b728-aab4715f2122`

For `dev` and `prod`, unset variables SHALL remain empty strings or existing environment-specific defaults without Entra-specific hardcoded values.

#### Scenario: Local development Entra defaults

- **WHEN** `ENVIRONMENT` is `local` and `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, and `OIDC_CLIENT_ID` are unset in `process.env`
- **THEN** the effective issuer is the Microsoft Entra v2.0 tenant URL
- **AND** the effective audience and client id are `dc734f4a-5f25-4e88-b728-aab4715f2122`

#### Scenario: Environment variable override

- **WHEN** `OIDC_ISSUER_URL` is set in `process.env`
- **THEN** the configured value overrides any file default regardless of `ENVIRONMENT`

## ADDED Requirements

### Requirement: Email extraction from OIDC token claims

`requireOidcAuth` SHALL extract the raw email from JWT claim `email` when it is a string, otherwise from claim `preferred_username` when it is a string. The middleware SHALL normalize the result with `normalizeAuthEmail` from `backend/lib/normalizeAuthEmail.js`. If normalization yields an empty string, `req.auth.email` SHALL be `null`.

#### Scenario: Email in standard claim

- **WHEN** the token payload includes `"email": " User@Example.com "`
- **THEN** `req.auth.email` equals `"user@example.com"`

#### Scenario: Email in preferred_username (Entra)

- **WHEN** the token payload has no `email` claim
- **AND** `"preferred_username": "user@example.com"`
- **THEN** `req.auth.email` equals `"user@example.com"`

#### Scenario: No email claims

- **WHEN** neither `email` nor `preferred_username` is a non-empty string
- **THEN** `req.auth.email` is `null`
