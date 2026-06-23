## ADDED Requirements

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
