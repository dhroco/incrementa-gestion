## ADDED Requirements

### Requirement: MSAL browser dependencies installed

The frontend SHALL declare `@azure/msal-browser` and `@azure/msal-react` as production dependencies in `frontend/package.json`.

#### Scenario: Dependencies available at build time

- **WHEN** the frontend is built or tests run
- **THEN** both MSAL packages resolve without import errors

### Requirement: MSAL configuration from environment with local defaults

The frontend SHALL provide `frontend/src/config/msalConfig.js` exporting `msalConfig` and `API_SCOPE`. Configuration SHALL read `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, and `VITE_AZURE_API_SCOPE` from `import.meta.env` with these defaults when unset:

- `clientId`: `dc734f4a-5f25-4e88-b728-aab4715f2122`
- `authority`: `https://login.microsoftonline.com/60322b4a-13bf-4f19-89ae-efe4a54ffed6`
- `API_SCOPE`: `api://dc734f4a-5f25-4e88-b728-aab4715f2122/access_as_user`

`msalConfig.auth.redirectUri` and `postLogoutRedirectUri` SHALL be `window.location.origin`. Cache SHALL use `cacheLocation: 'localStorage'`.

#### Scenario: Local dev resolves redirect URI

- **WHEN** the app runs at `http://localhost:5173`
- **THEN** MSAL `redirectUri` is `http://localhost:5173`

#### Scenario: API scope is never Graph

- **WHEN** MSAL requests tokens for login or silent acquisition
- **THEN** the requested scopes array includes only `API_SCOPE` (the application API scope)
- **AND** does not include `User.Read`, `openid` combined with Graph resource scopes, or other Microsoft Graph scopes

### Requirement: MSAL singleton instance exportable outside React

The frontend SHALL create a single `PublicClientApplication` in `frontend/src/auth/msalInstance.js` using `msalConfig` and export it as `msalInstance`. Other modules (including `apiClient.js`) SHALL import this singleton directly without using React context.

#### Scenario: apiClient imports singleton

- **WHEN** `apiClient.js` needs an access token
- **THEN** it imports `msalInstance` from `msalInstance.js`
- **AND** does not import `@azure/msal-react` hooks

### Requirement: Application wrapped with MsalProvider

`App.jsx` SHALL wrap the React tree with `<MsalProvider instance={msalInstance}>` inside the Redux `Provider` and outside routed content.

#### Scenario: MSAL hooks available in routed components

- **WHEN** a route component calls `useMsal()` or `useIsAuthenticated()`
- **THEN** the hook receives the shared `msalInstance` without error

### Requirement: Redirect-based login flow

The frontend SHALL authenticate users with Microsoft Entra ID using the Authorization Code + PKCE redirect flow. `LoginPage` SHALL call `msalInstance.loginRedirect({ scopes: [API_SCOPE] })` when the user activates "Continuar con Microsoft". The frontend SHALL NOT use popup login (`loginPopup`) for the primary login path.

#### Scenario: User initiates login

- **WHEN** the user clicks "Continuar con Microsoft" on `/login`
- **THEN** the browser navigates to the Microsoft Entra ID login page
- **AND** no email/password form fields are shown on the login page

### Requirement: Redirect return handled before route evaluation

On application start, `AuthInitializer` (or equivalent bootstrap component) SHALL await `msalInstance.handleRedirectPromise()` before setting auth initialization complete and before protected routes decide redirect-to-login. If the redirect response includes an account, the frontend SHALL call `msalInstance.setActiveAccount(account)`. If no redirect response but cached accounts exist, it SHALL set the first account as active.

#### Scenario: Successful redirect after Microsoft login

- **WHEN** the user completes Microsoft login and returns to the app origin
- **THEN** `handleRedirectPromise` resolves with an account
- **AND** that account becomes the active MSAL account
- **AND** `fetchEnrichedSessionThunk` is dispatched before the user sees authenticated private routes

#### Scenario: Page reload with cached MSAL session

- **WHEN** the user reloads the app with a valid MSAL account in localStorage cache
- **THEN** `handleRedirectPromise` resolves without error
- **AND** an active account is set from cache
- **AND** enriched session loading proceeds

### Requirement: Shared API access token acquisition helper

The frontend SHALL provide `acquireApiAccessToken()` (e.g. in `frontend/src/auth/msalToken.js`) that:

1. Resolves the active MSAL account (`getActiveAccount()` or first cached account).
2. Calls `acquireTokenSilent({ scopes: [API_SCOPE], account })`.
3. On `InteractionRequiredAuthError`, calls `acquireTokenRedirect({ scopes: [API_SCOPE], account })` and returns `null`.
4. Returns the access token string on success, or `null` when no account exists.

#### Scenario: Silent token acquisition succeeds

- **WHEN** a valid MSAL account exists and silent acquisition succeeds
- **THEN** `acquireApiAccessToken()` returns a non-empty access token string

#### Scenario: Interaction required triggers redirect

- **WHEN** `acquireTokenSilent` throws `InteractionRequiredAuthError`
- **THEN** `acquireTokenRedirect` is invoked with `API_SCOPE`
- **AND** the helper returns `null` without throwing to callers

### Requirement: Logout clears MSAL session and app state

`signOutThunk` SHALL call `msalInstance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })`, reset the CASL ability singleton with `ability.update([])`, and clear Redux enriched auth state. It SHALL NOT require a Redux-stored refresh token.

#### Scenario: User signs out from header menu

- **WHEN** the user chooses "Salir"
- **THEN** MSAL logout redirect is initiated
- **AND** Redux enriched profile and permissions are cleared
- **AND** the ability singleton has no rules

### Requirement: Login page UI preserves branding without password recovery links

`LoginPage.jsx` SHALL retain the existing login shell (logo, background, card layout). It SHALL display one primary action button labeled "Continuar con Microsoft" using the system `.btn` class. It SHALL NOT render email/password fields, submit handlers for ROPC, or links to forgot-password or reset-password routes within the login form.

#### Scenario: Login page appearance

- **WHEN** an unauthenticated user opens `/login`
- **THEN** the Incrementa logo and card layout are visible
- **AND** only the Microsoft continuation button is offered for sign-in
- **AND** no "¿Olvidó su contraseña?" link is present

### Requirement: Route guards use MSAL authentication state

`RequireAuth` SHALL treat the user as authenticated when MSAL reports an authenticated active account (e.g. via `useIsAuthenticated()`), after auth bootstrap `initialized` is true. `GuestOnlyRoute` SHALL redirect authenticated MSAL users away from guest routes using the same enrichment routing rules as today.

#### Scenario: Unauthenticated access to private route

- **WHEN** MSAL has no authenticated account and bootstrap is complete
- **THEN** navigating to `/app/*` redirects to `/login`

#### Scenario: Authenticated user opens login

- **WHEN** MSAL is authenticated and enrichment succeeds
- **THEN** navigating to `/login` redirects to the private app default path
