# backend-oidc-auth-middleware Specification

## Purpose
OIDC JWT validation middleware for Express, JWKS discovery, and backend OIDC configuration.
## Requirements
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

### Requirement: JWKS is resolved from OIDC discovery

The middleware SHALL obtain the JWKS URL by fetching the OpenID Connect discovery document at `{OIDC_ISSUER_URL}/.well-known/openid-configuration` and reading the `jwks_uri` field. The middleware SHALL NOT hardcode JWKS or discovery URLs beyond appending the standard discovery path to `OIDC_ISSUER_URL`.

#### Scenario: Discovery on first authenticated request

- **WHEN** the first request requiring JWT validation arrives and JWKS has not been initialized
- **THEN** the middleware fetches the discovery document from the configured issuer
- **AND** uses `jwks_uri` from the response to construct the remote JWKS set

### Requirement: Issuer and audience validation

The middleware SHALL pass `issuer: OIDC_ISSUER_URL` to `jwtVerify`. When `OIDC_AUDIENCE` is configured (default **`incrementa-backend`** if unset in application config), the middleware SHALL validate the token audience against that value.

#### Scenario: Token from wrong issuer

- **WHEN** a request presents a JWT whose `iss` does not match `OIDC_ISSUER_URL`
- **THEN** the response status is **401**

### Requirement: Invalid or unreachable JWKS yields 401

The middleware SHALL respond with HTTP **401** (not **500**) when the token is expired, has an invalid signature, fails audience/issuer checks, or when JWKS verification fails including network errors reaching the JWKS endpoint. Error payloads SHALL use Spanish messages consistent with the existing Supabase auth middleware.

#### Scenario: Expired or tampered token

- **WHEN** a request presents an expired or signature-invalid JWT
- **THEN** the response status is **401**
- **AND** the error code is `AUTH_INVALID_OR_EXPIRED_TOKEN`

#### Scenario: JWKS endpoint unreachable

- **WHEN** JWKS verification cannot complete due to a network failure to the JWKS endpoint
- **THEN** the response status is **401**
- **AND** the response is not **500**

### Requirement: JWKS client is cached and discovery is lazy

The middleware SHALL instantiate `createRemoteJWKSet` once per server process (module scope) after resolving `jwks_uri`. OIDC discovery and JWKS initialization SHALL occur lazily on the first request that needs validation, not during application module load, so the HTTP server can start when the IdP is temporarily unavailable.

#### Scenario: Server starts before IdP

- **WHEN** the backend process starts and Keycloak is not running
- **THEN** the server starts without throwing due to OIDC discovery
- **WHEN** the first authenticated request arrives while the IdP is still down
- **THEN** the client receives **401**

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

### Requirement: Express app uses OIDC middleware

`backend/app.js` SHALL import `requireOidcAuth` from `./middleware/requireOidcAuth` instead of `requireSupabaseAuth`, and SHALL use it as the default `requireAuth` dependency. No other lines in `backend/app.js` SHALL be changed for this requirement.

#### Scenario: Default auth dependency

- **WHEN** `createApp()` is called without a `requireAuth` override
- **THEN** protected routes use `requireOidcAuth`

### Requirement: Legacy Supabase middleware file is retained

The file `backend/middleware/requireSupabaseAuth.js` SHALL remain in the repository (not deleted) until a follow-up cleanup change.

#### Scenario: File still present after merge

- **WHEN** this change is merged
- **THEN** `requireSupabaseAuth.js` still exists

### Requirement: Local environment script documents OIDC variables

`backend/SET_VARS_AMBIENTE_LOCAL.cmd` SHALL set at least:

- `OIDC_ISSUER_URL=http://localhost:8080/realms/incrementa`
- `OIDC_AUDIENCE=incrementa-backend`

#### Scenario: Developer loads local env script

- **WHEN** a developer runs `SET_VARS_AMBIENTE_LOCAL.cmd` before `npm run dev`
- **THEN** `OIDC_ISSUER_URL` and `OIDC_AUDIENCE` are available to the Node process

### Requirement: Keycloak standalone documentation without Docker

The repository SHALL remove root `docker-compose.yml` and `infra/keycloak/scripts/bootstrap-test-users.sh`. It SHALL keep `infra/keycloak/import/incrementa-realm.json`. `infra/keycloak/README.md` SHALL document Keycloak as a standalone Java application (not Docker), including the documented Windows start command with `kc.bat start-dev --import-realm`. `infra/keycloak/.env.example` SHALL omit Docker-only bootstrap variables (`TEST_USER_*`).

#### Scenario: No Docker compose for Keycloak

- **WHEN** a developer clones the repository after this change
- **THEN** there is no root `docker-compose.yml` for Keycloak
- **AND** `infra/keycloak/README.md` describes standalone startup

### Requirement: No frontend or authorization-layer changes

This change SHALL NOT modify any file under `frontend/`. It SHALL NOT modify `requireNavigationGrant` or other authorization middleware behavior—only the initial authentication middleware and related backend configuration and Keycloak docs.

#### Scenario: Scope boundary

- **WHEN** this change is merged
- **THEN** no `frontend/` source files are changed
- **AND** navigation grant middleware behavior is unchanged

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

