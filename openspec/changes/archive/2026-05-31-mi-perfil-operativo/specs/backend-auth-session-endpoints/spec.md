## ADDED Requirements

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
