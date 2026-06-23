## ADDED Requirements

### Requirement: Document Builder lists only standard templates

The Document Builder template selector (UI and `listEligibleTemplates` API) MUST expose only standard templates. Company-scoped templates MUST NOT appear in the list.

#### Scenario: Template list contains only standard items
- **WHEN** an authorized user opens Document Builder with a valid company selected
- **THEN** the template list shows only templates from `template_standard` and no section or items for templates por empresa

#### Scenario: listEligibleTemplates API response
- **WHEN** an authorized client calls `GET /api/document-builder/templates`
- **THEN** every item in the response has `kind: 'standard'` and ids reference rows in `template_standard`

### Requirement: Document Builder generate rejects company templates

The document builder generate endpoint MUST accept only standard templates. Requests with `template.kind` equal to `company` MUST be rejected with HTTP 400 and a message in Spanish.

#### Scenario: Generate with standard template
- **WHEN** an authorized client posts generate with `template: { kind: 'standard', id: '<uuid>' }`, valid `companyId`, and valid `supplierId`
- **THEN** the server generates a PDF and persists `standard_template_id` without `company_template_id`

#### Scenario: Generate with company template rejected
- **WHEN** an authorized client posts generate with `template: { kind: 'company', id: '<uuid>' }`
- **THEN** the server responds with HTTP 400 and a Spanish validation message

## MODIFIED Requirements

### Requirement: Generated document persists supplier reference

The `generated_document` table MUST reference `supplier_id` instead of `employee_id` after migration `202605290006`. New PDF generation MUST persist the selected supplier id and standard template id when applicable.

#### Scenario: Persisted row references supplier
- **WHEN** document generation succeeds for supplier id `S1` with standard template id `T1`
- **THEN** the inserted `generated_document` row has `supplier_id` equal to `S1` and `standard_template_id` equal to `T1`
