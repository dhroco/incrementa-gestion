## REMOVED Requirements

### Requirement: Password recovery pages show administrator message

**Reason**: Forgot/reset password pages and routes are removed; password recovery is handled by Microsoft Entra, not in-app static pages.

**Migration**: Users reset passwords via Microsoft Entra self-service or tenant administrator. Login screen uses MSAL only.

## MODIFIED Requirements

### Requirement: AuthInitializer has no Supabase dependency

`AuthInitializer` SHALL await `msalInstance.handleRedirectPromise()`, set the active MSAL account when applicable, dispatch `fetchEnrichedSessionThunk` when an authenticated account exists, and then set `initialized` to **true**. It SHALL NOT dispatch `initAuthThunk` or read legacy `incrementa.*` localStorage token keys. It SHALL NOT import `tokenStorage.js`.

#### Scenario: Application mount

- **WHEN** the React tree mounts `AuthInitializer`
- **THEN** redirect promise handling completes before `initialized` becomes true
- **AND** no import from `tokenStorage.js` or `jwtUtils.js` occurs in the bootstrap path

#### Scenario: Cold start without prior login

- **WHEN** MSAL has no cached accounts after bootstrap
- **THEN** `initialized` is **true**
- **AND** no enriched session fetch is required for guest routes

### Requirement: signOutThunk clears client session

`signOutThunk` SHALL initiate MSAL `logoutRedirect` as best-effort, then clear Redux enriched auth state including enriched fields. It SHALL reset the ability singleton with `ability.update([])`. It SHALL NOT call `POST /api/auth/logout` or depend on Redux-stored refresh tokens.

#### Scenario: Logout from header menu

- **WHEN** the user chooses "Salir"
- **THEN** MSAL logout redirect is triggered
- **AND** Redux enriched state is cleared
- **AND** the ability singleton has no rules
- **AND** navigation eventually returns to `/login` after Microsoft logout completes
