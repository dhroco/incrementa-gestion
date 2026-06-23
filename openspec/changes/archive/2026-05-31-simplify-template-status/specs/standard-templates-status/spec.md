## ADDED Requirements

### Requirement: Template status allows only active and inactive

The `template.status` column SHALL allow only `'active'` and `'inactive'`. Migration `202606010001_simplify_template_status` SHALL set `status = 'inactive'` for all rows where `status = 'draft'`, drop constraint `template_status_check`, add a new check `status IN ('active', 'inactive')`, and set column default to `'inactive'`. The migration `down` SHALL restore the previous check including `'draft'` and default `'active'`.

#### Scenario: Draft rows become inactive on migrate

- **WHEN** migration `202606010001` runs on a database with template rows where `status = 'draft'`
- **THEN** those rows have `status = 'inactive'`
- **AND** the check constraint rejects `'draft'` on subsequent inserts or updates

#### Scenario: New template default is inactive at database level

- **WHEN** a row is inserted into `template` without an explicit `status`
- **THEN** PostgreSQL applies default `'inactive'`

#### Scenario: Invalid status rejected at database level

- **WHEN** an insert or update sets `template.status` to `'draft'` or any value other than `'active'` or `'inactive'`
- **THEN** PostgreSQL rejects the operation via check constraint

### Requirement: Standard templates CRUD accepts only active and inactive

`createStandardTemplate` and `updateStandardTemplate` in `standardTemplatesService.js` SHALL treat `'inactive'` as the default status when omitted or invalid. Allowed values SHALL be `'active'` and `'inactive'` only. Persisted status MUST NOT be `'draft'`.

#### Scenario: Create template defaults to inactive

- **WHEN** an authorized client posts to `/api/standard-templates` without `status` in the payload
- **THEN** the created template has `status: 'inactive'`

#### Scenario: Create template with invalid status coerced to inactive

- **WHEN** an authorized client posts with `status: 'draft'` or another invalid value
- **THEN** the server persists `status: 'inactive'`

#### Scenario: Update template with active status

- **WHEN** an authorized client puts to `/api/standard-templates/:id` with `status: 'active'`
- **THEN** the server responds HTTP 200 with `status: 'active'`

### Requirement: listStandardTemplates optional internal status filter

`listStandardTemplates` SHALL accept optional parameter `status`. When `status` is `'active'` or `'inactive'`, the query MUST include `WHERE t.status = <status>`. When `status` is omitted, the query MUST return templates regardless of status. This parameter is for internal consumers (e.g. MCP); `GET /api/standard-templates` MUST NOT expose a new public `status` query parameter in this change.

#### Scenario: List all templates without status filter

- **WHEN** `listStandardTemplates` is called without `status`
- **THEN** both active and inactive standard templates are returned

#### Scenario: List only active templates

- **WHEN** `listStandardTemplates` is called with `status: 'active'`
- **THEN** every returned item has `status` equal to `'active'`

### Requirement: Standard template editor uses active and inactive only

`StandardTemplateEditor.jsx` SHALL initialize and create templates with status `'inactive'`. The edit form status `<select>` SHALL offer only `active` (label Activo) and `inactive` (label Inactivo). The create form readonly status label MUST show Inactivo. The editor MUST NOT offer a Borrador/draft option.

#### Scenario: Create form shows inactive status

- **WHEN** an authorized user opens the create standard template form
- **THEN** the readonly status field displays "Inactivo"
- **AND** the save payload includes `status: 'inactive'`

#### Scenario: Edit form excludes draft option

- **WHEN** an authorized user opens edit for a template with `status: 'inactive'`
- **THEN** the status select shows Activo and Inactivo only
- **AND** Inactivo is selected

#### Scenario: Unknown status loads as inactive

- **WHEN** edit loads a template whose `status` is not recognized
- **THEN** the editor state defaults to `'inactive'`

### Requirement: Template status Spanish labels

`mapTemplateStatusToSpanish` in `frontend/src/utils/templateStatus.js` SHALL map `'active'` to "Activo", `'inactive'` to "Inactivo", and any other value to "Inactivo" (not "Borrador").

#### Scenario: Active label

- **WHEN** `mapTemplateStatusToSpanish('active')` is called
- **THEN** the result is "Activo"

#### Scenario: Inactive and unknown labels

- **WHEN** `mapTemplateStatusToSpanish('inactive')` or `mapTemplateStatusToSpanish('draft')` is called
- **THEN** the result is "Inactivo"

### Requirement: Admin template list shows all statuses

`StandardTemplatesListPage.jsx` SHALL continue listing all standard templates (active and inactive) without a status filter control. Status column labels MUST use `mapTemplateStatusToSpanish`.

#### Scenario: List includes inactive templates

- **WHEN** an authorized user views the standard templates list and inactive templates exist
- **THEN** those rows appear with status label "Inactivo"

#### Scenario: Former draft rows display as inactive

- **WHEN** a template had `status = 'draft'` before migration and the user opens the list after migration
- **THEN** the row displays status "Inactivo"
