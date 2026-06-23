## ADDED Requirements

### Requirement: Platform user create accepts minimal payload

`POST /api/platform/users` (via `createPlatformUser`) SHALL accept only `email`, `profile_code`, and optional `is_active` (default `true`). It SHALL NOT require nor persist `full_name`, `phone`, `rut`, `rut_body`, or `rut_dv` from the request body. Validation errors SHALL be returned in Spanish (es-CL).

#### Scenario: Valid minimal create payload

- **WHEN** a platform admin submits `{ email, profile_code }` with a valid email and existing Keycloak user
- **THEN** the service creates `user_profile` with `email`, `profile_id`, `is_active`, and Keycloak `user_id`
- **AND** does not require `full_name` in the request

#### Scenario: Invalid create without email or role

- **WHEN** `email` or `profile_code` is missing or invalid
- **THEN** the API returns HTTP **400** with code `VALIDATION_ERROR` and Spanish messages

### Requirement: full_name populated from Keycloak on create

On successful Keycloak lookup during create, `user_profile.full_name` SHALL be set from the `fullName` returned by `findUserIdByEmail` (built from Keycloak `firstName` and `lastName`). If both name parts are empty or undefined, `full_name` SHALL fall back to the normalized email.

#### Scenario: Keycloak user with first and last name

- **WHEN** Keycloak returns `firstName: "Ana"` and `lastName: "Pérez"` for the email
- **THEN** `user_profile.full_name` is persisted as `"Ana Pérez"`

#### Scenario: Keycloak user without name parts

- **WHEN** Keycloak returns empty or undefined `firstName` and `lastName`
- **THEN** `user_profile.full_name` is persisted as the normalized email

### Requirement: Platform user update excludes personal fields

`PATCH /api/platform/users/:id` (via `updatePlatformUser`) SHALL accept updates to `email`, `profile_code`, and `is_active` only. It SHALL NOT accept nor update `full_name`, `phone`, `rut_body`, or `rut_dv`. Email updates SHALL continue to call Keycloak `updateUserEmail` when email changes.

#### Scenario: Update role and active flag

- **WHEN** admin submits `{ profile_code, is_active }` for an existing platform user
- **THEN** only `profile_id` and `is_active` are updated in `user_profile`
- **AND** `full_name` remains unchanged

#### Scenario: Ignored full_name in update body

- **WHEN** admin submits `{ full_name: "Otro Nombre" }` in the update payload
- **THEN** `full_name` in the database is not modified

### Requirement: Platform user API responses exclude phone and RUT

List and detail endpoints for platform users SHALL NOT include `phone`, `rut_body`, or `rut_dv` in response bodies. They MAY include `full_name` as read-only display data. Search/filter on list SHALL NOT query `phone`.

#### Scenario: User detail response shape

- **WHEN** admin fetches a platform user by id
- **THEN** the response includes `email`, `full_name`, `profile_code`, `is_active`, and identifiers
- **AND** does not include `phone`, `rut_body`, or `rut_dv`

### Requirement: Drop personal columns from user_profile

A Knex migration SHALL remove columns `phone`, `rut_body`, and `rut_dv` from `user_profile`. Each `DROP COLUMN` SHALL be guarded with `hasColumn` for idempotency. The migration `down` SHALL recreate the three columns as nullable.

#### Scenario: Migration up on existing schema

- **WHEN** `knex migrate:latest` runs and the columns exist
- **THEN** `phone`, `rut_body`, and `rut_dv` are dropped from `user_profile`

#### Scenario: Migration down restores nullable columns

- **WHEN** `knex migrate:rollback` runs after the up migration
- **THEN** `phone`, `rut_body`, and `rut_dv` exist again as nullable columns

### Requirement: Platform users admin UI minimal forms

The platform user admin UI SHALL reflect the minimal access-registration model.

#### Scenario: Create form fields

- **WHEN** admin opens the create platform user page
- **THEN** the form shows only Email, Rol (profile), and Activo (toggle, default on)
- **AND** does not show nombre, teléfono, or RUT inputs

#### Scenario: Edit form fields

- **WHEN** admin opens the edit platform user page
- **THEN** the form allows editing Email, Rol, and Activo only
- **AND** does not show editable nombre, teléfono, or RUT fields

#### Scenario: List and view without phone and RUT

- **WHEN** admin views the platform users list or detail page
- **THEN** teléfono and RUT are not displayed
- **AND** nombre may appear as read-only informational text on detail (not editable)
