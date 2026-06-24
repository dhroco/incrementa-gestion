# remove-keycloak-ropc-cleanup Specification

## Purpose
TBD - created by archiving change remove-keycloak-ropc-cleanup. Update Purpose after archive.
## Requirements
### Requirement: Backend has no Keycloak admin or ROPC code

The backend codebase (excluding `node_modules`, archived OpenSpec paths, and historical comments in migrations/seeds) SHALL NOT contain `keycloakAdminClient.js`, `oidcAuthService.js`, or `authController.js`. `backend/app.js` SHALL NOT register `POST /api/auth/login`, `POST /api/auth/refresh`, or `POST /api/auth/logout`. `backend/config.js` SHALL NOT expose `KEYCLOAK_ADMIN_URL`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_REALM`, `OIDC_CLIENT_ID`, or `OIDC_CLIENT_SECRET`. It SHALL continue to expose `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, and all `GRAPH_*` variables.

#### Scenario: Grep backend executable code

- **WHEN** searching `backend/` (excluding `node_modules` and test fixtures that mock removed modules) for `keycloakAdminClient`, `oidcAuthService`, and `/api/auth/login`
- **THEN** no active imports or route registrations remain

#### Scenario: Config retains Entra validation variables

- **WHEN** reading `backend/config.js` for any environment
- **THEN** `OIDC_ISSUER_URL` and `OIDC_AUDIENCE` are present
- **AND** `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, and `GRAPH_CLIENT_SECRET` are present
- **AND** no `KEYCLOAK_*` keys exist

### Requirement: Frontend has no ROPC or Keycloak password recovery UI

The frontend SHALL NOT include `ForgotPasswordPage`, `ResetPasswordPage`, `SessionKeepAlive.jsx`, `tokenStorage.js`, or `jwtUtils.js` when no production module imports them. The router SHALL NOT register `/forgot-password` or `/reset-password`. The auth slice SHALL NOT export `signInWithPasswordThunk`, `refreshSessionThunk`, `initAuthThunk`, `selectSession`, or other ROPC-specific selectors tied to Redux-stored tokens.

#### Scenario: Router auth routes

- **WHEN** inspecting `frontend/src/routes/AppRouter.jsx`
- **THEN** only MSAL-based login route(s) exist for unauthenticated entry
- **AND** forgot/reset password routes are absent

#### Scenario: Build succeeds without legacy auth modules

- **WHEN** `npm run build` runs in `frontend/`
- **THEN** the build completes with no unresolved imports from deleted auth files

### Requirement: Keycloak local infra removed

The repository SHALL NOT contain directory `infra/keycloak/`.

#### Scenario: Infra directory absent

- **WHEN** listing `infra/` at repository root
- **THEN** no `keycloak` subdirectory exists

### Requirement: Automated verification passes

After cleanup, backend unit tests and frontend build/tests SHALL pass.

#### Scenario: Backend tests green

- **WHEN** `npm test` runs in `backend/`
- **THEN** all tests pass

#### Scenario: Frontend build and tests green

- **WHEN** `npm run build` and `npm test` run in `frontend/`
- **THEN** build succeeds and all tests pass
