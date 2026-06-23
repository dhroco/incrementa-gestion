## MODIFIED Requirements

### Requirement: Auth state shape and selectors remain stable at the Redux boundary

The frontend auth slice SHALL expose the same top-level state fields and selector functions used by the application (`initialized`, `session`, `user`, enriched profile fields, `enrichedIsActive`, and existing `select*` exports) except that `enrichedNavigation` and `mustChangePassword` SHALL be removed. CASL rules SHALL NOT be stored in Redux; they SHALL live in the frontend ability singleton. The `session` object stored in Redux SHALL use camelCase token fields: `accessToken`, `refreshToken`, and `expiresAt` (milliseconds since epoch). The `user` object SHALL be `{ id, email }` where `id` is the Keycloak subject UUID.

#### Scenario: Selectors continue to work for guards and layout

- **WHEN** a route guard calls `selectIsAuthenticated`
- **THEN** behavior matches the authenticated contract without Supabase imports
- **AND** no selector named `selectMustChangePassword` is exported or used

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

## REMOVED Requirements

### Requirement: Mandatory password change uses backend password endpoint

**Reason**: Application no longer enforces password rotation; Keycloak owns credentials. `MandatoryPasswordChangePage` and related API routes are removed.

**Migration**: Users and admins change passwords in Keycloak Admin Console or account console.
