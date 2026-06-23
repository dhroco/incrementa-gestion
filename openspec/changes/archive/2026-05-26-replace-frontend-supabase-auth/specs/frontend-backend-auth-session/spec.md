## ADDED Requirements

### Requirement: Auth state shape and selectors remain stable at the Redux boundary

The frontend auth slice SHALL expose the same top-level state fields and selector functions used by the application (`initialized`, `session`, `user`, enriched profile/navigation fields, `mustChangePassword`, `enrichedIsActive`, and existing `select*` exports). The `session` object stored in Redux SHALL use camelCase token fields: `accessToken`, `refreshToken`, and `expiresAt` (milliseconds since epoch). The `user` object SHALL be `{ id, email }` where `id` is the Keycloak subject UUID.

#### Scenario: Selectors continue to work for guards and layout

- **WHEN** a route guard calls `selectIsAuthenticated` or `selectMustChangePassword`
- **THEN** behavior matches the pre-migration contract (boolean derived from Redux state)
- **AND** no Supabase client is imported

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

`signOutThunk` SHALL call `POST /api/auth/logout` with Bearer access token and body `{ refresh_token }` as best-effort (errors ignored), then clear localStorage and Redux auth state including enriched fields.

#### Scenario: Logout from header menu

- **WHEN** the user chooses "Salir"
- **THEN** localStorage token keys are removed
- **AND** Redux `session` is **null**
- **AND** navigation redirects to `/login`

### Requirement: refreshSessionThunk renews tokens via backend

`refreshSessionThunk` SHALL call `POST /api/auth/refresh` with `{ refresh_token }` from the current session. On **200**, it SHALL update Redux and localStorage with new tokens and `expiresAt`. On **401** or **400**, it SHALL dispatch `signOutThunk`.

#### Scenario: API 401 triggers refresh attempt

- **WHEN** an authenticated API call receives **401**
- **THEN** `apiClient` dispatches `refreshSessionThunk` once
- **AND** does not automatically retry the original HTTP request

#### Scenario: Refresh failure ends session

- **WHEN** `POST /api/auth/refresh` returns **401**
- **THEN** `signOutThunk` runs and clears client session

### Requirement: fetchEnrichedSessionThunk uses backend session endpoint

`fetchEnrichedSessionThunk` SHALL call `GET /api/me/session` with `Authorization: Bearer <accessToken>` from Redux. It SHALL continue to populate `enrichedProfile`, `enrichedNavigation`, `enrichedCompany`, `mustChangePassword`, and `enrichedIsActive` according to the existing enrichment logic (including accountant inactive and profile-not-assigned cases).

#### Scenario: Enriched session after login

- **WHEN** login succeeds
- **THEN** the Network tab shows `GET /api/me/session` with a valid Bearer token
- **AND** Redux receives profile and navigation data from the response

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

### Requirement: Mandatory password change uses backend password endpoint

`MandatoryPasswordChangePage` SHALL update the password via `PUT /api/me/password` with body `{ newPassword }` using the shared API client (Bearer token). On success, it SHALL call `POST /api/me/password-rotation-complete` and then `fetchEnrichedSessionThunk({ force: true })` as today. Client-side validation SHALL require at least 8 characters and matching confirmation fields.

#### Scenario: User with mustChangePassword completes rotation

- **WHEN** an authenticated user with `mustChangePassword: true` submits a valid new password
- **THEN** `PUT /api/me/password` returns success
- **AND** password rotation complete is recorded
- **AND** enriched session reload clears the mandatory change gate

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
