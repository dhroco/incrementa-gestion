# company-short-name Specification

## Purpose
TBD - created by archiving change add-company-short-name. Update Purpose after archive.
## Requirements
### Requirement: Company short_name column

The system MUST store a mandatory commercial name for each company in column `company.short_name` (TEXT NOT NULL). Migration `202606010004_add_short_name_to_company.js` MUST add the column nullable, backfill existing rows with `business_name`, then set NOT NULL. Rollback MUST drop the column.

#### Scenario: Existing companies backfilled

- **WHEN** migration `202606010004` runs on a database with companies lacking `short_name`
- **THEN** every row has `short_name` equal to its `business_name` before NOT NULL is applied

#### Scenario: New company requires short_name at database level

- **WHEN** an insert omits `short_name` after migration
- **THEN** the database rejects the insert

### Requirement: Company payload validation for short_name

`companyService.validateCompanyPayload` MUST read `short_name` from `payload.short_name` or `payload.shortName` (trimmed). When `requireAll` is true and the value is empty, validation MUST fail with message `Nombre comercial es obligatorio.` in Spanish. The validated data object MUST include `short_name` when a non-null trimmed value exists, or `undefined` when absent (partial update). `listCompanies` MUST select `c.short_name`.

#### Scenario: Create rejects missing short_name

- **WHEN** an authorized client POSTs company create without `short_name`
- **THEN** the API responds with validation error including `Nombre comercial es obligatorio.`

#### Scenario: Create accepts short_name

- **WHEN** an authorized client POSTs company create with `short_name: "Dynamics"`
- **THEN** the company is persisted with `short_name` equal to `"Dynamics"`

#### Scenario: Partial update without short_name preserves value

- **WHEN** an authorized client PUTs company update changing only unrelated fields and omitting `short_name`
- **THEN** the existing `short_name` in the database is unchanged

#### Scenario: List companies includes short_name

- **WHEN** an authorized client calls the company list endpoint
- **THEN** each company item includes `short_name`

### Requirement: Company forms require commercial name

The frontend company create and edit flows MUST collect "Nombre comercial" as a required field positioned after "Razón Social" and before RUT. State MUST flow via outlet context (`shortName`, `setShortName`) from `CompanyCreateLayout` and `CompanyEditLayout`. Edit layout MUST initialize from loaded `data.short_name`. `buildCompanyMutationPayload` MUST send `short_name`; `validateHeadquartersForCompanySubmit` MUST reject empty short name with `El nombre comercial es obligatorio.` before RUT validation. Submit MUST be disabled when short name is empty.

#### Scenario: Create form blocks submit without short name

- **WHEN** a user fills Razón Social and RUT but leaves Nombre comercial empty
- **THEN** submit remains disabled or validation shows `El nombre comercial es obligatorio.`

#### Scenario: Edit form loads short name

- **WHEN** a user opens company edit for a company with `short_name: "Dynamics"`
- **THEN** the Nombre comercial field displays `Dynamics`

#### Scenario: View page shows commercial name

- **WHEN** a user opens the company detail view
- **THEN** "Nombre comercial" is displayed alongside "Razón Social"

