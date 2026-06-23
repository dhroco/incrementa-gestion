## ADDED Requirements

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

## MODIFIED Requirements

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
