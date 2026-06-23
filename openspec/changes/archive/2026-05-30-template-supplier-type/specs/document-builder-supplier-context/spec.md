## MODIFIED Requirements

### Requirement: Document Builder lists only standard templates

The Document Builder template selector (UI and `listEligibleTemplates` API) MUST expose only standard templates. Company-scoped templates MUST NOT appear in the list. `GET /api/document-builder/templates` SHALL accept optional query parameter `supplier_type` with values `'persona_natural'` or `'empresa'`. When provided with a valid value, the API MUST return only standard templates whose `supplier_type` matches. Each item in the response MUST include `supplier_type`. When `supplier_type` is provided but invalid, the API MUST respond HTTP 400 with a message in Spanish.

#### Scenario: Template list contains only standard items

- **WHEN** an authorized user opens Document Builder with a valid company selected
- **THEN** the template list shows only templates from `template_standard` and no section or items for templates por empresa

#### Scenario: listEligibleTemplates API response

- **WHEN** an authorized client calls `GET /api/document-builder/templates`
- **THEN** every item in the response has `kind: 'standard'`, ids reference rows in `template_standard`, and each item includes `supplier_type`

#### Scenario: listEligibleTemplates filtered by supplier type

- **WHEN** an authorized client calls `GET /api/document-builder/templates?companyId=<id>&supplier_type=empresa`
- **THEN** every returned item has `supplier_type` equal to `'empresa'`

#### Scenario: listEligibleTemplates invalid supplier_type

- **WHEN** an authorized client calls `GET /api/document-builder/templates?supplier_type=foo`
- **THEN** the server responds HTTP 400 with a Spanish validation message
