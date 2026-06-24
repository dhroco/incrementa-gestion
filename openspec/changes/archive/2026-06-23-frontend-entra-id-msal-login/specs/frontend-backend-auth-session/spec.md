## MODIFIED Requirements

### Requirement: Auth state shape and selectors remain stable at the Redux boundary

The frontend auth slice SHALL expose the same top-level enriched state fields and selector functions used by the application (`initialized`, `user`, enriched profile fields, `enrichedIsActive`, and existing enriched `select*` exports) except that `enrichedNavigation` and `mustChangePassword` SHALL remain removed. CASL rules SHALL NOT be stored in Redux; they SHALL live in the frontend ability singleton. The Redux `session` object SHALL NOT be the source of truth for API access tokens or authentication status; MSAL SHALL hold token cache and account state. Redux MAY retain a minimal `user` object `{ id, email }` derived from enriched session or MSAL account claims for display compatibility. `selectIsAuthenticated` SHALL NOT be used as the primary authentication guard; route guards SHALL use MSAL authentication state instead.

#### Scenario: Selectors continue to work for layout and profile

- **WHEN** a layout component calls `selectEnrichedProfile` or `selectAvatarUrl` after enriched session load
- **THEN** values reflect the latest `GET /api/me/session` response
- **AND** no selector named `selectMustChangePassword` is exported or used

#### Scenario: Authentication guard uses MSAL not Redux session

- **WHEN** `RequireAuth` evaluates whether to allow access
- **THEN** it uses MSAL authenticated account state
- **AND** does not require `state.auth.session.accessToken` to be present

### Requirement: fetchEnrichedSessionThunk uses backend session endpoint

`fetchEnrichedSessionThunk` SHALL call `GET /api/me/session` with `Authorization: Bearer <accessToken>` obtained from `acquireApiAccessToken()` (MSAL), not from Redux `session.accessToken`. On success it SHALL call `ability.update(unpackRules(data.permissions))` on the shared ability singleton from `frontend/src/lib/ability.js`. It SHALL populate `enrichedProfile`, `enrichedIsActive`, and other enriched identity fields as today. It SHALL NOT populate `mustChangePassword`, `enrichedNavigation`, or read `navigation` from the response. It SHALL NOT set enrichment status `accountant_inactive` or hydrate accountant `assignedCompanies`.

#### Scenario: Enriched session after Microsoft login hydrates ability

- **WHEN** MSAL login completes and `fetchEnrichedSessionThunk` runs
- **THEN** the Network tab shows `GET /api/me/session` with a valid Bearer token from MSAL
- **AND** the ability singleton reflects permissions from `permissions` in the response
- **AND** Redux does not contain `enrichedNavigation`

#### Scenario: Inactive user uses unified inactive handling only

- **WHEN** `GET /api/me/session` returns **403** for an inactive platform user
- **THEN** Redux enrichment status reflects user inactive (not `accountant_inactive`)

### Requirement: signOutThunk clears client session

`signOutThunk` SHALL initiate MSAL `logoutRedirect` as best-effort, then clear Redux enriched auth state including enriched fields. It SHALL reset the ability singleton with `ability.update([])`. It SHALL NOT call `POST /api/auth/logout` or depend on Redux-stored refresh tokens.

#### Scenario: Logout from header menu

- **WHEN** the user chooses "Salir"
- **THEN** MSAL logout redirect is triggered
- **AND** Redux enriched state is cleared
- **AND** the ability singleton has no rules
- **AND** navigation eventually returns to `/login` after Microsoft logout completes

### Requirement: AuthInitializer has no Supabase dependency

`AuthInitializer` SHALL await `msalInstance.handleRedirectPromise()`, set the active MSAL account when applicable, dispatch `fetchEnrichedSessionThunk` when an authenticated account exists, and then set `initialized` to **true**. It SHALL NOT dispatch `initAuthThunk` or read `incrementa.*` localStorage token keys.

#### Scenario: Application mount

- **WHEN** the React tree mounts `AuthInitializer`
- **THEN** redirect promise handling completes before `initialized` becomes true
- **AND** no import from `tokenStorage.js` occurs in the bootstrap path

#### Scenario: Cold start without prior login

- **WHEN** MSAL has no cached accounts after bootstrap
- **THEN** `initialized` is **true**
- **AND** no enriched session fetch is required for guest routes

### Requirement: apiClient reads token from Redux store

`apiClient` SHALL obtain the access token by calling `acquireApiAccessToken()` for all HTTP helpers (`apiGet`, `apiPost`, `apiPut`, etc.). It SHALL NOT read `store.getState().auth.session?.accessToken`.

#### Scenario: Authenticated API request

- **WHEN** `apiGet('/api/...')` runs with an active MSAL account
- **THEN** the request includes `Authorization: Bearer <accessToken>` from MSAL silent acquisition

### Requirement: invalidateSessionThunk equivalent to sign out

Call sites that previously dispatched `invalidateSessionThunk` for expired sessions SHALL continue to use `signOutThunk` or a thin wrapper with the same clearing behavior. Session-expired user messaging in Spanish MAY be preserved where already shown.

#### Scenario: Unauthorized API response after failed token renewal

- **WHEN** an API call receives **401** and MSAL cannot silently renew the token
- **THEN** the client initiates interactive MSAL token acquisition or sign-out
- **AND** the user may see a session-expired message in Spanish

### Requirement: Auth slice stores profile extras from enriched session

The frontend auth slice SHALL store `avatarUrl`, `contactEmail`, and `widgetPreferences` at the top level of auth state (alongside `enrichedEmail`, `enrichedProfile`, etc.). `fetchEnrichedSessionThunk` SHALL populate these from `GET /api/me/session` response fields `avatar_url`, `contact_email`, and `widget_preferences` when present. The slice SHALL export selectors `selectAvatarUrl`, `selectContactEmail`, and `selectWidgetPreferences`. The slice SHALL export reducer action `updateProfileData({ contactEmail, widgetPreferences, avatarUrl })` that updates these fields without forcing re-login.

#### Scenario: Enriched session hydrates profile extras

- **WHEN** `fetchEnrichedSessionThunk` succeeds and the session response includes `avatar_url`, `contact_email`, and `widget_preferences`
- **THEN** Redux state contains matching values in `avatarUrl`, `contactEmail`, and `widgetPreferences`

#### Scenario: updateProfileData after profile save

- **WHEN** the user saves contact email or widget preferences on Mi Perfil
- **THEN** the app dispatches `updateProfileData` with the new values
- **AND** `selectContactEmail` or `selectWidgetPreferences` reflect the update without a full session reload

#### Scenario: Profile extras cleared on sign out

- **WHEN** `signOutThunk` completes or session is cleared
- **THEN** `avatarUrl`, `contactEmail`, and `widgetPreferences` are reset to null

## REMOVED Requirements

### Requirement: Token persistence in localStorage

**Reason**: Access and refresh tokens are managed by MSAL cache (`localStorage` under MSAL keys), not custom `incrementa.*` keys.

**Migration**: Remove reads/writes of `incrementa.access_token`, `incrementa.refresh_token`, and `incrementa.expires_at` from auth bootstrap and thunks. Token lifecycle is handled by MSAL `acquireTokenSilent` / `acquireTokenRedirect`.

### Requirement: initAuthThunk bootstraps application auth

**Reason**: Replaced by MSAL redirect handling and account restoration in `AuthInitializer`.

**Migration**: Delete `initAuthThunk`; bootstrap via `handleRedirectPromise()` and active account selection.

### Requirement: signInWithPasswordThunk uses backend login

**Reason**: Login moves to Microsoft Entra ID; ROPC against `/api/auth/login` is no longer used in the UI.

**Migration**: Users authenticate via "Continuar con Microsoft". Backend ROPC endpoints remain until stage 5.5 cleanup.

### Requirement: refreshSessionThunk renews tokens via backend

**Reason**: Token renewal is handled by MSAL silent/redirect acquisition, not `/api/auth/refresh`.

**Migration**: Remove `refreshSessionThunk`; `apiClient` renews via `acquireApiAccessToken()` on **401**.

### Requirement: SessionKeepAlive schedules proactive token refresh

**Reason**: MSAL acquires fresh tokens on demand; Redux no longer stores `expiresAt` for scheduling.

**Migration**: Do not mount `SessionKeepAlive` in authenticated routes. Component may remain until stage 5.5 cleanup.

### Requirement: SessionKeepAlive mounted for authenticated routes

**Reason**: Proactive ROPC refresh timer is obsolete with MSAL on-demand renewal.

**Migration**: Remove `<SessionKeepAlive />` from `RequireAuth.jsx`.

### Requirement: Reactive 401 refresh remains unchanged

**Reason**: The previous behavior dispatched `refreshSessionThunk` against the backend; MSAL replaces this path.

**Migration**: On **401**, `apiClient` SHALL attempt one `acquireApiAccessToken()` retry; on `InteractionRequiredAuthError`, trigger `acquireTokenRedirect`; otherwise dispatch sign-out or surface unauthorized handling consistent with `signOutThunk`.
