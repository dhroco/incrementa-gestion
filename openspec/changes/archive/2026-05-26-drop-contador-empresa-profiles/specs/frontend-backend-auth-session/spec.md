## MODIFIED Requirements

### Requirement: fetchEnrichedSessionThunk uses backend session endpoint

`fetchEnrichedSessionThunk` SHALL call `GET /api/me/session` with `Authorization: Bearer <accessToken>` from Redux. It SHALL populate `enrichedProfile`, `enrichedNavigation`, `enrichedCompany`, `mustChangePassword`, and `enrichedIsActive` according to enrichment logic for platform admin and platform-user flows. It SHALL NOT set enrichment status `accountant_inactive` or hydrate accountant `assignedCompanies` from the session body.

#### Scenario: Enriched session after login

- **WHEN** login succeeds and `fetchEnrichedSessionThunk` runs
- **THEN** the Network tab shows `GET /api/me/session` with a valid Bearer token
- **AND** Redux receives profile and navigation without `assignedCompanies` hydration for removed profiles

#### Scenario: Inactive user uses unified inactive handling only

- **WHEN** `GET /api/me/session` returns **403** for an inactive platform user
- **THEN** Redux enrichment status reflects user inactive (not `accountant_inactive`)

## REMOVED Requirements

### Requirement: Accountant inactive enrichment state

**Reason**: Profile `CONTADOR` is removed from the system.

**Migration**: Remove `accountant_inactive` from `enrichmentStatus` union, delete `enrichedAccountantIsActive` state/selectors, and remove `hydrateAccountantCompanyContext` dispatches tied to `assignedCompanies`.
