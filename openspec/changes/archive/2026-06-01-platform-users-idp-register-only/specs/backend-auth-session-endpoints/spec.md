## MODIFIED Requirements

### Requirement: Enriched session returns CASL permissions instead of navigation

`GET /api/me/session` and alias `GET /api/me/authorization/current` SHALL include property `permissions` containing packed CASL rules from `buildPackedRulesForUser(userId)` for the authenticated user. The response SHALL include `profile: { code, label }`, identity fields (`userId`, `email`, `name` where applicable), session meta (`isActive`), and SHALL NOT include property `navigation` with `tree`, `routes`, or `grantedCodes`. The response SHALL NOT include `mustChangePassword`.

#### Scenario: Platform admin session includes packed rules

- **WHEN** a user with profile `ADMINISTRADOR_PLATAFORMA` calls `GET /api/me/session` with a valid Bearer token
- **THEN** the response status is **200**
- **AND** the JSON body contains property `permissions` (array)
- **AND** the JSON body does not contain property `navigation`
- **AND** `profile.code` is `ADMINISTRADOR_PLATAFORMA`
- **AND** `mustChangePassword` is absent from the response body

#### Scenario: Session without profile still follows existing error contract

- **WHEN** an authenticated user has no assigned profile
- **THEN** the handler responds as today (e.g. **404** with no-profile body) and does not return permissions
