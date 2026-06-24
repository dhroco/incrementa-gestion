## REMOVED Requirements

### Requirement: Login endpoint proxies Keycloak ROPC

**Reason**: Authentication is exclusively via MSAL on the frontend; backend no longer proxies Resource Owner Password Credentials.

**Migration**: Clients must use Microsoft Entra login (MSAL). `POST /api/auth/login` returns **404** (route not registered).

### Requirement: Refresh endpoint proxies Keycloak refresh grant

**Reason**: Token refresh is handled by MSAL token cache, not backend ROPC refresh.

**Migration**: Use MSAL `acquireTokenSilent` via frontend `acquireApiAccessToken()`.

### Requirement: Logout endpoint revokes refresh token

**Reason**: Logout uses MSAL `logoutRedirect`; backend does not revoke Keycloak refresh tokens.

**Migration**: Frontend `signOutThunk` already uses MSAL logout; no backend logout call required.

### Requirement: Auth routes registered before protected API

**Reason**: ROPC auth routes removed; registration order for `/api/auth/login|refresh|logout` no longer applies.

**Migration**: Protected API continues to use Bearer JWT validation via `requireOidcAuth`.

### Requirement: OIDC client credentials in configuration

**Reason**: `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` were only used for ROPC token exchange.

**Migration**: Remove from env config. JWT validation continues with `OIDC_ISSUER_URL` and `OIDC_AUDIENCE` only.

### Requirement: Keycloak communication uses native fetch only

**Reason**: `oidcAuthService.js` deleted with ROPC endpoints.

**Migration**: None.

### Requirement: IdP network failures return 503

**Reason**: Applied to removed ROPC auth endpoints only. Enriched session and OIDC middleware retain their existing error contracts.

**Migration**: MSAL handles IdP connectivity on the client for login; API returns **401**/**403** per existing middleware for protected routes.
