## MODIFIED Requirements

### Requirement: Auth state shape and selectors remain stable at the Redux boundary

The frontend auth slice SHALL expose the same top-level state fields and selector functions used by the application (`initialized`, `session`, `user`, enriched profile fields, `mustChangePassword`, `enrichedIsActive`, and existing `select*` exports) except that `enrichedNavigation` SHALL be removed. CASL rules SHALL NOT be stored in Redux; they SHALL live in the frontend ability singleton. The `session` object stored in Redux SHALL use camelCase token fields: `accessToken`, `refreshToken`, and `expiresAt` (milliseconds since epoch). The `user` object SHALL be `{ id, email }` where `id` is the Keycloak subject UUID.

#### Scenario: Selectors continue to work for guards and layout

- **WHEN** a route guard calls `selectIsAuthenticated` or `selectMustChangePassword`
- **THEN** behavior matches the pre-migration contract (boolean derived from Redux state)
- **AND** no Supabase client is imported

### Requirement: fetchEnrichedSessionThunk uses backend session endpoint

`fetchEnrichedSessionThunk` SHALL call `GET /api/me/session` with `Authorization: Bearer <accessToken>` from Redux. On success it SHALL call `ability.update(unpackRules(data.permissions))` on the shared ability singleton from `frontend/src/lib/ability.js`. It SHALL populate `enrichedProfile`, `mustChangePassword`, and `enrichedIsActive` (and other enriched identity fields as today). It SHALL NOT populate `enrichedNavigation` or read `navigation` from the response. It SHALL NOT set enrichment status `accountant_inactive` or hydrate accountant `assignedCompanies`.

#### Scenario: Enriched session after login hydrates ability

- **WHEN** login succeeds and `fetchEnrichedSessionThunk` runs
- **THEN** the Network tab shows `GET /api/me/session` with a valid Bearer token
- **AND** the ability singleton reflects permissions from `permissions` in the response
- **AND** Redux does not contain `enrichedNavigation`

#### Scenario: Inactive user uses unified inactive handling only

- **WHEN** `GET /api/me/session` returns **403** for an inactive platform user
- **THEN** Redux enrichment status reflects user inactive (not `accountant_inactive`)

### Requirement: signOutThunk clears client session

`signOutThunk` SHALL call `POST /api/auth/logout` with Bearer access token and body `{ refresh_token }` as best-effort (errors ignored), then clear localStorage and Redux auth state including enriched fields. It SHALL reset the ability singleton with `ability.update([])`.

#### Scenario: Logout from header menu

- **WHEN** the user chooses "Salir"
- **THEN** localStorage token keys are removed
- **AND** Redux `session` is **null**
- **AND** the ability singleton has no rules
- **AND** navigation redirects to `/login`

## REMOVED Requirements

### Requirement: enrichedNavigation in Redux

**Reason**: Navigation tree and granted codes are replaced by static menu config and CASL ability singleton.

**Migration**: Components reading `selectEnrichedNavigation` or `navigation.grantedCodes` MUST use `useAbility(AbilityContext)` and `MENU_CONFIG` for menu titles and action visibility.
