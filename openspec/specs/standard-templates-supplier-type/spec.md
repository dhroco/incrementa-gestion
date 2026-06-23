# standard-templates-supplier-type Specification

## Purpose
Standard contract templates declare whether they apply to persona natural or empresa suppliers, enabling backend filtering by supplier type in list APIs and CRUD.
## Requirements
### Requirement: Template supplier_type column

The `template` table SHALL have a column `supplier_type` of type text/varchar, NOT NULL, with a check constraint allowing only `'persona_natural'` or `'empresa'`. The migration that adds this column SHALL delete template rows whose `code` starts with `PLANTILLA-` (development seeds) and SHALL set `supplier_type = 'empresa'` on the template with code `PL0001` before applying the NOT NULL constraint. The migration MUST NOT alter the `template_standard` table.

#### Scenario: Migration cleans development seed templates
- **WHEN** migration `202605300020` runs on a database containing templates with codes `PLANTILLA-SEED-01`, `PLANTILLA-SEED-02`, etc.
- **THEN** those template rows and their `template_standard` rows are removed
- **AND** dependent rows referencing those template ids in `document` or `draft_document` are removed first when those tables exist

#### Scenario: PL0001 receives empresa type
- **WHEN** migration `202605300020` runs and a template row exists with code `PL0001`
- **THEN** that row has `supplier_type` equal to `'empresa'` before the NOT NULL constraint is applied

#### Scenario: Invalid supplier_type rejected at database level
- **WHEN** an insert or update sets `template.supplier_type` to a value other than `'persona_natural'` or `'empresa'`
- **THEN** PostgreSQL rejects the operation via check constraint

### Requirement: Standard templates CRUD requires supplier_type

`createStandardTemplate` and `updateStandardTemplate` in `standardTemplatesService.js` SHALL require a valid `supplier_type` (`'persona_natural'` or `'empresa'`). Requests without a valid value MUST fail with a service error translated to HTTP 400 and a message in Spanish. Persisted and returned template objects MUST include `supplier_type` via `mapTemplateRow`.

#### Scenario: Create template with supplier_type
- **WHEN** an authorized client posts to `/api/standard-templates` with valid payload including `supplier_type: 'persona_natural'`
- **THEN** the server responds HTTP 201 with the created template object including `supplier_type: 'persona_natural'`

#### Scenario: Create template without supplier_type
- **WHEN** an authorized client posts to `/api/standard-templates` without `supplier_type` or with an invalid value
- **THEN** the server responds HTTP 400 with a Spanish validation message
- **AND** no template row is inserted

#### Scenario: Update template supplier_type
- **WHEN** an authorized client puts to `/api/standard-templates/:id` with valid payload including `supplier_type: 'empresa'`
- **THEN** the server responds HTTP 200 with the updated template including `supplier_type: 'empresa'`

#### Scenario: Get template includes supplier_type
- **WHEN** an authorized client gets `/api/standard-templates/:id`
- **THEN** the response body includes `supplier_type`

### Requirement: Standard templates list optional supplier_type filter

`GET /api/standard-templates` SHALL accept optional query parameter `supplier_type`. When provided with a valid value, `listStandardTemplates` SHALL return only templates whose `supplier_type` matches. List items and detail responses SHALL include `supplier_type`. When `supplier_type` is provided but invalid, the API SHALL respond HTTP 400 with a Spanish message.

#### Scenario: List all templates without filter
- **WHEN** an authorized client calls `GET /api/standard-templates` without `supplier_type`
- **THEN** all standard templates are returned, each including `supplier_type`

#### Scenario: List filtered by persona_natural
- **WHEN** an authorized client calls `GET /api/standard-templates?supplier_type=persona_natural`
- **THEN** every item in the response has `supplier_type` equal to `'persona_natural'`

#### Scenario: Invalid supplier_type query param
- **WHEN** an authorized client calls `GET /api/standard-templates?supplier_type=invalid`
- **THEN** the server responds HTTP 400 with a Spanish validation message

### Requirement: Standard templates UI captures supplier_type

The standard templates create and edit forms (`StandardTemplateEditor.jsx`) SHALL include a required "Tipo de proveedor" field implemented as a native `<select className="clause-input">` with options `persona_natural` (label "Persona Natural") and `empresa` (label "Empresa"). The field MUST be included in the create and update API payload as `supplier_type`. Client-side validation MUST prevent submit when `supplier_type` is missing or invalid, consistent with other required fields (`name`, `code`). On edit load, the select MUST reflect the template's current `supplier_type` from the API response.

#### Scenario: Create form requires supplier type
- **WHEN** an authorized user opens the create standard template form
- **THEN** a "Tipo de proveedor" select is visible with options Persona Natural and Empresa
- **AND** the Guardar button is disabled until name, code, and supplier_type are valid

#### Scenario: Create submits supplier_type
- **WHEN** an authorized user fills name, code, selects supplier_type "Empresa", and saves
- **THEN** the POST payload to `/api/standard-templates` includes `supplier_type: 'empresa'`

#### Scenario: Edit loads and saves supplier_type
- **WHEN** an authorized user opens edit for a template with `supplier_type: 'persona_natural'`
- **THEN** the select shows Persona Natural selected
- **AND** saving sends `supplier_type` in the PUT payload

### Requirement: Standard templates list displays supplier_type

The standard templates list page (`StandardTemplatesListPage.jsx`) SHALL display a sortable column "Tipo de proveedor" showing the supplier type for each template using the existing `SupplierTypeChip` component or equivalent read-only display.

#### Scenario: List column shows supplier type
- **WHEN** an authorized user views the standard templates list
- **THEN** each row displays a chip or label indicating Persona Natural or Empresa from `item.supplier_type`

### Requirement: Standard template view displays supplier_type

The standard template read-only view (`StandardTemplateViewPage.jsx`) SHALL display the template's `supplier_type` in the metadata section.

#### Scenario: View page shows supplier type
- **WHEN** an authorized user opens a template in view mode
- **THEN** the metadata panel shows the supplier type (Persona Natural or Empresa)

