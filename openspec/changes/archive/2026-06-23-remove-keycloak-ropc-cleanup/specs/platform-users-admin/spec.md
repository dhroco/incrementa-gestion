## MODIFIED Requirements

### Requirement: Platform user create accepts minimal payload

`POST /api/platform/users` (via `createPlatformUser`) SHALL accept only `email`, `profile_code`, and optional `is_active` (default `true`). It SHALL NOT require nor persist `full_name`, `phone`, `rut`, `rut_body`, or `rut_dv` from the request body. Validation errors SHALL be returned in Spanish (es-CL).

#### Scenario: Valid minimal create payload

- **WHEN** a platform admin submits `{ email, profile_code }` with a valid email and an existing Microsoft Entra directory user (validated via Graph)
- **THEN** the service creates `user_profile` with `email`, `profile_id`, `is_active`, and Entra `user_id` (oid)
- **AND** does not require `full_name` in the request

#### Scenario: Invalid create without email or role

- **WHEN** `email` or `profile_code` is missing or invalid
- **THEN** the API returns HTTP **400** with code `VALIDATION_ERROR` and Spanish messages

### Requirement: full_name populated from Keycloak on create

On successful Entra directory lookup during create via Microsoft Graph, `user_profile.full_name` SHALL be set from the `fullName` returned by `findUserByEmail` (Graph `displayName`). If `displayName` is empty or missing, `full_name` SHALL fall back to the normalized email.

#### Scenario: Entra user with displayName

- **WHEN** Graph returns `displayName: "Ana Pérez"` for the email
- **THEN** `user_profile.full_name` is persisted as `"Ana Pérez"`

#### Scenario: Entra user without displayName

- **WHEN** Graph returns empty or missing `displayName`
- **THEN** `user_profile.full_name` is persisted as the normalized email

### Requirement: Platform user update excludes personal fields

`PATCH /api/platform/users/:id` (via `updatePlatformUser`) SHALL accept updates to `profile_code` and `is_active` only. It SHALL NOT accept, persist, or propagate changes to `email`. It SHALL NOT call any Graph write operation. It SHALL NOT accept nor update `full_name`, `phone`, `rut_body`, or `rut_dv`.

#### Scenario: Update role and active flag

- **WHEN** admin submits `{ profile_code, is_active }` for an existing platform user
- **THEN** only `profile_id` and `is_active` are updated in `user_profile`
- **AND** `full_name` and `email` remain unchanged

#### Scenario: Ignored email in update body

- **WHEN** admin submits `{ email: "otro@ejemplo.cl" }` in the update payload
- **THEN** `email` in the database is not modified
- **AND** no call is made to Graph to change identity email

#### Scenario: Ignored full_name in update body

- **WHEN** admin submits `{ full_name: "Otro Nombre" }` in the update payload
- **THEN** `full_name` in the database is not modified

### Requirement: Platform users admin UI minimal forms

The platform user admin UI SHALL reflect the minimal access-registration model.

#### Scenario: Create form fields

- **WHEN** admin opens the create platform user page
- **THEN** the form shows only Email, Rol (profile), and Activo (toggle, default on)
- **AND** does not show nombre, teléfono, or RUT inputs

#### Scenario: Edit form fields

- **WHEN** admin opens the edit platform user page
- **THEN** the form allows editing Rol and Activo only
- **AND** displays Email as read-only (non-editable field or static text using readonly form styling)
- **AND** does not show editable nombre, teléfono, or RUT fields

#### Scenario: List and view without phone and RUT

- **WHEN** admin views the platform users list or detail page
- **THEN** teléfono and RUT are not displayed
- **AND** nombre may appear as read-only informational text on detail (not editable)

## RENAMED Requirements

- FROM: `### Requirement: full_name populated from Keycloak on create`
- TO: `### Requirement: full_name populated from Entra on create`
