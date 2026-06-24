# backend-auth-session-endpoints Specification

## Purpose
Enriched session API for authenticated users (`GET /api/me/session`). Legacy ROPC auth endpoints (`/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`) were removed; authentication is via MSAL on the frontend.
## Requirements
### Requirement: Enriched session excludes removed profile behaviors

`GET /api/me/session` (and alias `/api/me/authorization/current`) SHALL NOT include response fields `assignedCompanies` or accountant-specific inactive handling for profile codes `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`. The handler SHALL NOT return HTTP 403 with an accountant-inactive error body. Session meta loading SHALL NOT query table `accountant`. Automatic injection of `company` context based on `USUARIO_EMPRESA_ADMINISTRADOR` scope SHALL NOT occur.

#### Scenario: Platform admin session payload shape

- **WHEN** a user with only profile `ADMINISTRADOR_PLATAFORMA` calls `GET /api/me/session`
- **THEN** the response status is **200**
- **AND** the JSON body does not contain property `assignedCompanies`
- **AND** `profile.code` is `ADMINISTRADOR_PLATAFORMA`

#### Scenario: No accountant inactive gate

- **WHEN** any authenticated user calls `GET /api/me/session`
- **THEN** the server does not respond with the accountant-inactive error code/body previously produced for disabled accountants

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

### Requirement: Enriched session includes profile extras

`GET /api/me/session` and alias `GET /api/me/authorization/current` SHALL include optional profile fields from `user_profile` when present: `contact_email` (string), `widget_preferences` (object with boolean keys `suppliers`, `contracts`, `templates`), and `avatar_url` (string signed GCS URL valid 1440 minutes). The handler SHALL load `avatar_gcs_path`, `contact_email`, and `widget_preferences` via `loadSessionMetaForUser`. When `avatar_gcs_path` is non-null, the server SHALL generate `avatar_url` using `gcsService.getSignedUrl({ gcsPath, expiresInMinutes: 1440 })` and SHALL NOT expose the raw GCS path to the client.

#### Scenario: User with avatar receives signed URL in session

- **WHEN** an authenticated user has `avatar_gcs_path` set in `user_profile`
- **THEN** `GET /api/me/session` returns **200**
- **AND** the JSON body includes property `avatar_url` as a non-empty string
- **AND** the body does not include `avatar_gcs_path`

#### Scenario: User with contact email and widget preferences

- **WHEN** an authenticated user has `contact_email` and `widget_preferences` set
- **THEN** `GET /api/me/session` returns **200**
- **AND** the JSON body includes `contact_email` matching the stored value
- **AND** the JSON body includes `widget_preferences` as a JSON object

#### Scenario: User without profile extras omits optional fields

- **WHEN** an authenticated user has NULL for all three profile extra columns
- **THEN** `GET /api/me/session` returns **200**
- **AND** the JSON body does not include `avatar_url`, `contact_email`, or `widget_preferences` (or they are omitted/null per existing optional-field convention)
