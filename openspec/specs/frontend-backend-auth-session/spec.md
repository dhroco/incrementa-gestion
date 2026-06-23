# frontend-backend-auth-session Specification

## Purpose
TBD - created by archiving change replace-frontend-supabase-auth. Update Purpose after archive.
## Requirements
### Requirement: Auth state shape and selectors remain stable at the Redux boundary

The frontend auth slice SHALL expose the same top-level state fields and selector functions used by the application (`initialized`, `session`, `user`, enriched profile fields, `enrichedIsActive`, and existing `select*` exports) except that `enrichedNavigation` and `mustChangePassword` SHALL be removed. CASL rules SHALL NOT be stored in Redux; they SHALL live in the frontend ability singleton. The `session` object stored in Redux SHALL use camelCase token fields: `accessToken`, `refreshToken`, and `expiresAt` (milliseconds since epoch). The `user` object SHALL be `{ id, email }` where `id` is the Keycloak subject UUID.

#### Scenario: Selectors continue to work for guards and layout

- **WHEN** a route guard calls `selectIsAuthenticated`
- **THEN** behavior matches the authenticated contract without Supabase imports
- **AND** no selector named `selectMustChangePassword` is exported or used

### Requirement: Token persistence in localStorage

The frontend SHALL persist session tokens under these keys only: `incrementa.access_token`, `incrementa.refresh_token`, and `incrementa.expires_at` (numeric timestamp in milliseconds as a string). On successful login or refresh, all three keys SHALL be written. On sign-out or invalid session cleanup, all three keys SHALL be removed.

#### Scenario: Page reload restores session

- **WHEN** the user has previously logged in and reloads the application
- **THEN** `initAuthThunk` reads the three localStorage keys
- **AND** dispatches `sessionUpdated` with `{ accessToken, refreshToken, expiresAt }`
- **AND** calls `fetchEnrichedSessionThunk` when tokens exist

#### Scenario: Invalid stored session is cleared

- **WHEN** `initAuthThunk` restores tokens but `GET /api/me/session` returns **401**
- **THEN** localStorage keys are cleared
- **AND** Redux session is set to null
- **AND** `initialized` becomes **true** without an authenticated session

### Requirement: initAuthThunk bootstraps application auth

The frontend SHALL provide `initAuthThunk` that runs once at application start (via `AuthInitializer`). If no tokens exist in localStorage, it SHALL set `initialized` to **true** without a session. If tokens exist, it SHALL hydrate Redux and attempt enriched session loading.

#### Scenario: Cold start without prior login

- **WHEN** localStorage has no incrementa token keys
- **THEN** `initialized` is **true**
- **AND** `session` is **null**

### Requirement: signInWithPasswordThunk uses backend login

`signInWithPasswordThunk` SHALL call `POST /api/auth/login` with JSON `{ email, password }` where `email` is normalized via `normalizeAuthEmail`. On **200**, it SHALL map `access_token`, `refresh_token`, and `expires_in` to Redux session and localStorage, then dispatch `fetchEnrichedSessionThunk`. On failure, it SHALL reject with a user-visible message in Spanish (es-CL). The login page UI SHALL NOT change.

#### Scenario: Successful login with test admin user

- **WHEN** the user submits valid credentials for `admin@incrementa.la`
- **THEN** tokens are stored in localStorage and Redux
- **AND** `GET /api/me/session` is invoked with `Authorization: Bearer <accessToken>`
- **AND** the user is routed to `/app/dashboard` without Supabase errors in the console

#### Scenario: Invalid credentials

- **WHEN** `POST /api/auth/login` returns **401**
- **THEN** the thunk rejects with a generic Spanish error message
- **AND** no tokens are written to localStorage

### Requirement: signOutThunk clears client session

`signOutThunk` SHALL call `POST /api/auth/logout` with Bearer access token and body `{ refresh_token }` as best-effort (errors ignored), then clear localStorage and Redux auth state including enriched fields. It SHALL reset the ability singleton with `ability.update([])`.

#### Scenario: Logout from header menu

- **WHEN** the user chooses "Salir"
- **THEN** localStorage token keys are removed
- **AND** Redux `session` is **null**
- **AND** the ability singleton has no rules
- **AND** navigation redirects to `/login`

### Requirement: refreshSessionThunk renews tokens via backend

`refreshSessionThunk` SHALL call `POST /api/auth/refresh` with `{ refresh_token }` from the current session. On **200**, it SHALL update Redux and localStorage with new tokens and `expiresAt`. On **401** or **400**, it SHALL dispatch `signOutThunk`. In addition to reactive invocation from `apiClient` on **401**, the thunk MAY be invoked proactively by `SessionKeepAlive` before access token expiry.

#### Scenario: API 401 triggers refresh attempt

- **WHEN** an authenticated API call receives **401**
- **THEN** `apiClient` dispatches `refreshSessionThunk` once
- **AND** does not automatically retry the original HTTP request

#### Scenario: Refresh failure ends session

- **WHEN** `POST /api/auth/refresh` returns **401**
- **THEN** `signOutThunk` runs and clears client session

#### Scenario: Proactive refresh before expiry

- **WHEN** `SessionKeepAlive` dispatches `refreshSessionThunk` before `expiresAt`
- **AND** `POST /api/auth/refresh` returns **200**
- **THEN** Redux and localStorage receive updated tokens and `expiresAt`
- **AND** subsequent API calls use the new access token without requiring a **401**

### Requirement: fetchEnrichedSessionThunk uses backend session endpoint

`fetchEnrichedSessionThunk` SHALL call `GET /api/me/session` with `Authorization: Bearer <accessToken>` from Redux. On success it SHALL call `ability.update(unpackRules(data.permissions))` on the shared ability singleton from `frontend/src/lib/ability.js`. It SHALL populate `enrichedProfile` and `enrichedIsActive` (and other enriched identity fields as today). It SHALL NOT populate `mustChangePassword`, `enrichedNavigation`, or read `navigation` from the response. It SHALL NOT set enrichment status `accountant_inactive` or hydrate accountant `assignedCompanies`.

#### Scenario: Enriched session after login hydrates ability

- **WHEN** login succeeds and `fetchEnrichedSessionThunk` runs
- **THEN** the Network tab shows `GET /api/me/session` with a valid Bearer token
- **AND** the ability singleton reflects permissions from `permissions` in the response
- **AND** Redux does not contain `enrichedNavigation`
- **AND** no `mustChangePassword` field is stored in Redux

#### Scenario: Inactive user uses unified inactive handling only

- **WHEN** `GET /api/me/session` returns **403** for an inactive platform user
- **THEN** Redux enrichment status reflects user inactive (not `accountant_inactive`)

### Requirement: AuthInitializer has no Supabase dependency

`AuthInitializer` SHALL dispatch only `initAuthThunk()` on mount and return `null`. It SHALL NOT subscribe to Supabase auth events.

#### Scenario: Application mount

- **WHEN** the React tree mounts `AuthInitializer`
- **THEN** exactly one `initAuthThunk` dispatch occurs
- **AND** no import from `supabaseClient.js` exists in the auth bootstrap path

### Requirement: apiClient reads token from Redux store

`apiClient` SHALL obtain the access token from `store.getState().auth.session?.accessToken` for all HTTP helpers (`apiGet`, `apiPost`, `apiPut`, etc.). It SHALL NOT call `supabase.auth.getSession()`.

#### Scenario: Authenticated API request

- **WHEN** `apiGet('/api/...')` runs with an active Redux session
- **THEN** the request includes `Authorization: Bearer <accessToken>`

### Requirement: Password recovery pages show administrator message

`ForgotPasswordPage` and `ResetPasswordPage` SHALL display only: "Para recuperar tu contraseña, contacta al administrador de la plataforma." They SHALL NOT call Supabase or any external recovery API.

#### Scenario: User opens forgot password route

- **WHEN** the user navigates to the forgot-password route
- **THEN** the static Spanish message is visible
- **AND** no Supabase client is loaded for that flow

### Requirement: Supabase auth client removed from frontend

The file `frontend/src/auth/supabaseClient.js` SHALL be deleted. No production frontend module SHALL import `@supabase/supabase-js` for end-user authentication. Frontend configuration SHALL NOT require `supabaseUrl` or `supabaseAnonKey` for auth.

#### Scenario: Codebase search after migration

- **WHEN** searching `frontend/src` for `supabaseClient` or `supabase.auth`
- **THEN** no auth-related imports remain (excluding unrelated backend documentation)

### Requirement: invalidateSessionThunk equivalent to sign out

Call sites that previously dispatched `invalidateSessionThunk` for expired sessions SHALL use `signOutThunk` or a thin wrapper with the same clearing behavior. Session-expired user messaging in Spanish MAY be preserved where already shown.

#### Scenario: Unauthorized API response after failed refresh

- **WHEN** refresh fails following a **401** from an API call
- **THEN** the user session is cleared and may see a session-expired message in Spanish

### Requirement: SessionKeepAlive schedules proactive token refresh

The frontend SHALL provide a React component `SessionKeepAlive` at `frontend/src/auth/SessionKeepAlive.jsx` that reads `session.expiresAt` from Redux via `selectSession`. When `expiresAt` is a finite number, the component SHALL schedule a single `refreshSessionThunk` dispatch to occur 60 seconds before that timestamp (`REFRESH_BEFORE_EXPIRY_MS = 60_000`). When the computed delay is less than or equal to zero, it SHALL dispatch `refreshSessionThunk` immediately. When `expiresAt` is null or absent (no session), it SHALL schedule nothing. Each time `expiresAt` changes (for example after a successful refresh), the component SHALL cancel any prior timer and schedule a new one. The component SHALL return `null` (no UI). It SHALL NOT modify `authSlice`, `refreshSessionThunk`, or `apiClient`.

#### Scenario: Timer fires before token expiry

- **WHEN** the user has an active session with `expiresAt` more than 60 seconds in the future
- **THEN** `SessionKeepAlive` schedules `refreshSessionThunk` for `expiresAt - 60_000` ms
- **AND** no API call receives **401** solely due to access token expiry during normal idle use before that moment

#### Scenario: Successful refresh reschedules the timer

- **WHEN** `refreshSessionThunk` completes successfully and Redux `session.expiresAt` updates
- **THEN** `SessionKeepAlive` clears the previous timer
- **AND** schedules the next refresh 60 seconds before the new `expiresAt`

#### Scenario: No session means no timer

- **WHEN** Redux `session` is **null** or `expiresAt` is **null**
- **THEN** `SessionKeepAlive` does not dispatch `refreshSessionThunk`
- **AND** does not leave a pending timeout

#### Scenario: Near-expiry session refreshes immediately

- **WHEN** `expiresAt - Date.now() - 60_000` is less than or equal to zero
- **THEN** `SessionKeepAlive` dispatches `refreshSessionThunk` immediately without waiting

### Requirement: SessionKeepAlive mounted for authenticated routes

`SessionKeepAlive` SHALL be mounted inside the authenticated route gate (`RequireAuth.jsx`) so it is active whenever `selectIsAuthenticated` is **true** and the user is past auth initialization. It SHALL NOT be mounted on guest-only routes (for example `/login`).

#### Scenario: Authenticated user on private routes

- **WHEN** the user is authenticated and navigates to `/app/dashboard` or `/sin-perfil`
- **THEN** `SessionKeepAlive` is mounted in the React tree
- **AND** proactive refresh scheduling is active

#### Scenario: Guest login page

- **WHEN** the user is on `/login` without an authenticated session
- **THEN** `SessionKeepAlive` is not mounted
- **AND** no proactive refresh is attempted

### Requirement: Reactive 401 refresh remains unchanged

The existing `apiClient` behavior on **401** (dispatch `refreshSessionThunk` once via `handleUnauthorized`, no automatic retry of the original request) SHALL remain unchanged and SHALL serve as a fallback when proactive refresh does not run in time.

#### Scenario: Proactive refresh missed

- **WHEN** an API call receives **401** because the access token expired before proactive refresh completed
- **THEN** `apiClient` still dispatches `refreshSessionThunk` via `handleUnauthorized`
- **AND** does not automatically retry the failed request

### Requirement: Auth slice stores profile extras from enriched session

The frontend auth slice SHALL store `avatarUrl`, `contactEmail`, and `widgetPreferences` at the top level of auth state (alongside `enrichedEmail`, `enrichedProfile`, etc.). `fetchEnrichedSessionThunk` SHALL populate these from `GET /api/me/session` response fields `avatar_url`, `contact_email`, and `widget_preferences` when present. The slice SHALL export selectors `selectAvatarUrl`, `selectContactEmail`, and `selectWidgetPreferences`. The slice SHALL export reducer action `updateProfileData({ contactEmail, widgetPreferences, avatarUrl })` that updates these fields without clearing tokens or forcing re-login.

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

