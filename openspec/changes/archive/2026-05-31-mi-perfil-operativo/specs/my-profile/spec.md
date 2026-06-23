## ADDED Requirements

### Requirement: user_profile stores profile extras

The system SHALL add nullable columns to `user_profile`: `avatar_gcs_path` (TEXT), `contact_email` (TEXT), and `widget_preferences` (JSONB). Migration file SHALL be `202606020001_add_profile_extras_to_user_profile.js` with reversible `down` dropping all three columns.

#### Scenario: Migration applies successfully

- **WHEN** the migration runs on an existing database
- **THEN** `user_profile` has columns `avatar_gcs_path`, `contact_email`, and `widget_preferences`
- **AND** all three columns accept NULL for existing rows

### Requirement: Authenticated user can update contact email and widget preferences

The backend SHALL expose `PUT /api/me/profile` protected by OIDC Bearer authentication. The authenticated subject `req.auth.userId` SHALL identify the row in `user_profile` via `WHERE user_id = ?`. The request body SHALL accept optional JSON fields `contact_email` (string) and `widget_preferences` (object). At least one field MUST be present. On success the response status SHALL be **200** with body `{ "ok": true }`.

#### Scenario: Update contact email only

- **WHEN** an authenticated user sends `{ "contact_email": "contacto@empresa.cl" }` with a valid email format
- **THEN** the response status is **200**
- **AND** `user_profile.contact_email` is updated for that user
- **AND** `updated_at` is set to the current timestamp

#### Scenario: Update widget preferences only

- **WHEN** an authenticated user sends `{ "widget_preferences": { "suppliers": true, "contracts": false, "templates": true } }`
- **THEN** the response status is **200**
- **AND** `user_profile.widget_preferences` stores the JSON object

#### Scenario: Invalid contact email rejected

- **WHEN** the body includes `contact_email` with an invalid email format
- **THEN** the response status is **400**
- **AND** the error message is in Spanish (es-CL)

#### Scenario: Invalid widget preferences rejected

- **WHEN** `widget_preferences` is not an object, or contains keys other than `suppliers`, `contracts`, `templates`, or non-boolean values
- **THEN** the response status is **400**
- **AND** the error message is in Spanish (es-CL)

#### Scenario: Unauthenticated request

- **WHEN** a client calls `PUT /api/me/profile` without a valid Bearer token
- **THEN** the response status is **401**

### Requirement: Authenticated user can upload avatar image

The backend SHALL expose `POST /api/me/avatar` protected by OIDC Bearer authentication. The endpoint SHALL accept `multipart/form-data` with a single file field using multer `memoryStorage()` applied only to this route (not globally). Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`. Maximum file size: 2 MB.

#### Scenario: Successful avatar upload

- **WHEN** an authenticated user uploads a valid image file within size and type limits
- **THEN** the file is stored in GCS at path `avatars/{userProfileId}/{uuid}.{ext}`
- **AND** `user_profile.avatar_gcs_path` is updated for that user
- **AND** any previous `avatar_gcs_path` file is deleted from GCS before upload
- **AND** the response status is **200** with body `{ "ok": true, "avatar_url": "<signed-url>" }` where the signed URL expires in 1440 minutes

#### Scenario: Invalid file type rejected

- **WHEN** the uploaded file MIME type is not jpeg, png, or webp
- **THEN** the response status is **400**
- **AND** the error message is in Spanish (es-CL)

#### Scenario: File too large rejected

- **WHEN** the uploaded file exceeds 2 MB
- **THEN** the response status is **400**
- **AND** the error message is in Spanish (es-CL)

#### Scenario: Missing file rejected

- **WHEN** the request has no file in the multipart body
- **THEN** the response status is **400**

### Requirement: My Profile page allows avatar contact email and widget configuration

The frontend SHALL provide a functional `MyProfilePage` with three sections: (1) Avatar — circular 80×80 image with generic icon fallback, file input accepting jpeg/png/webp, immediate preview on select, upload via `POST /api/me/avatar` with loading spinner and error display; (2) Personal data — read-only name and role, editable contact email with inline Save calling `PUT /api/me/profile`; initial contact email from Redux `contactEmail` or fallback to login email; (3) Dashboard widgets — title "Widgets del Dashboard", three checkboxes (Proveedores, Contratos, Plantillas) initialized from `widgetPreferences` defaulting all true when null, debounced 800ms PUT on change.

#### Scenario: User uploads new avatar

- **WHEN** the user selects a valid image on Mi Perfil
- **THEN** a preview is shown immediately
- **AND** `POST /api/me/avatar` is called with FormData
- **AND** on success Redux is updated with the new `avatar_url`

#### Scenario: User saves contact email

- **WHEN** the user edits contact email and clicks Save
- **THEN** `PUT /api/me/profile` is called with `{ contact_email }`
- **AND** on success Redux `contactEmail` is updated
- **AND** a success or error message is displayed in Spanish (es-CL)

#### Scenario: User toggles widget preference

- **WHEN** the user changes any widget checkbox
- **THEN** after 800ms debounce `PUT /api/me/profile` is called with `{ widget_preferences }`
- **AND** Redux `widgetPreferences` is updated on success

### Requirement: meApi provides profile update helpers

The frontend SHALL provide `frontend/src/api/meApi.js` (or extend existing module) with:

- `updateMyProfile(payload, { accessToken })` — `PUT /api/me/profile`
- `uploadMyAvatar(file, { accessToken })` — `POST /api/me/avatar` with FormData

Both SHALL use the authenticated Bearer token and follow existing API client error-handling patterns.

#### Scenario: updateMyProfile sends JSON body

- **WHEN** `updateMyProfile({ contact_email: "a@b.cl" }, { accessToken })` is called
- **THEN** the request uses method PUT, JSON Content-Type, and Authorization Bearer header

#### Scenario: uploadMyAvatar sends multipart

- **WHEN** `uploadMyAvatar(file, { accessToken })` is called
- **THEN** the request uses method POST with FormData and does not set Content-Type manually (browser boundary)
