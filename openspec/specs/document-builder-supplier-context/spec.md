# document-builder-supplier-context Specification

## Purpose
TBD - created by archiving change drop-employees-connect-suppliers-document-builder. Update Purpose after archive.
## Requirements
### Requirement: Document Builder supplier selection

The Document Builder UI MUST allow the user to select one global supplier (not filtered by company) in addition to the selected company. The selector MUST display supplier display name (full name or razón social), RUT, and supplier type as a chip (`Persona Natural` or `Empresa`). The UI MUST use `fetchSuppliersList` from `suppliersApi` and MUST NOT load employees. After supplier selection, the UI MUST present an optional client selector before template selection; the user MAY proceed without selecting a client.

#### Scenario: Supplier list loads without company filter

- **WHEN** an authorized user opens Document Builder with document constructor grant
- **THEN** the supplier selector lists suppliers from the global suppliers API independent of company scope

#### Scenario: Supplier selection stored in state

- **WHEN** the user selects a supplier from the list
- **THEN** the document builder state stores the selected supplier id for generation

#### Scenario: Optional client selection after supplier

- **WHEN** the user has completed supplier selection
- **THEN** an optional client selector is shown before templates
- **AND** generation may proceed with no client selected

### Requirement: Document Builder generate API uses supplier

The backend document builder generate endpoint MUST accept `supplierId` (string UUID) instead of `employeeIds`. It MUST load the supplier via `supplierService.getSupplierById`, reject missing or invalid suppliers with HTTP 400 and a message in Spanish, and MUST NOT query the `employee` table. The endpoint MUST additionally accept optional `clientId` (string UUID). When `clientId` is provided, the server MUST load the client via `clientService.getClientById` and reject invalid ids with HTTP 400 in Spanish. When `clientId` is omitted, generation MUST proceed without client substitution data.

#### Scenario: Generate with valid supplier

- **WHEN** an authorized client posts generate with valid `companyId`, `supplierId`, and template
- **THEN** the server returns HTTP 200 with a generated PDF document referencing the supplier

#### Scenario: Generate without supplier

- **WHEN** an authorized client posts generate without `supplierId`
- **THEN** the server responds with HTTP 400 and a Spanish validation message

#### Scenario: Generate with optional clientId

- **WHEN** an authorized client posts generate with valid `supplierId` and valid optional `clientId`
- **THEN** the server returns HTTP 200 and persists `client_id` on the draft document

#### Scenario: Generate with invalid clientId

- **WHEN** an authorized client posts generate with a non-existent `clientId`
- **THEN** the server responds with HTTP 400 and a Spanish validation message

### Requirement: Proveedor variable substitution

`buildSubstitutionMap` in `documentBuilderVariableContext.js` MUST map supplier fields to these template keys:

- `proveedor_nombre` — `full_name` (persona natural) or `razon_social` (empresa)
- `proveedor_rut` — `rut_display` or `rut_empresa_display`
- `proveedor_direccion` — `address` or `direccion_empresa`
- `proveedor_giro` — `giro` or empty string for persona natural
- `proveedor_rep_legal` — `nombre_rep_legal` or empty string for persona natural
- `proveedor_rep_legal_rut` — `rut_rep_legal_display` or empty string for persona natural

The map MUST NOT include `proveedor_tipo`, `contract_type`, `work_schedule`, `signing_city`, or `contract_date`.

The map MUST include contract and supplier override keys initialized to empty string so unresolved detection works:

- `proveedor_red_social`, `proveedor_cuenta_social`
- `fecha_contrato`, `lugar_contrato`, `mes_ejecucion`, `cantidad_reels`, `precio_numero`, `precio_texto`

Company variables (`company_*`) MUST remain available except `company_branches`, which MUST NOT be defined in the substitution map.

#### Scenario: Persona natural substitution

- **WHEN** a template contains `{{proveedor_nombre}}` and the selected supplier is persona natural with `full_name` "Ana Pérez"
- **THEN** the generated document text contains "Ana Pérez"

#### Scenario: Empresa substitution

- **WHEN** a template contains `{{proveedor_giro}}` and the selected supplier is empresa with giro "Servicios TI"
- **THEN** the generated document text contains "Servicios TI"

#### Scenario: New contract variables detected as missing without override

- **WHEN** a template contains `{{lugar_contrato}}` and no override is provided
- **THEN** `lugar_contrato` appears in unresolved keys

#### Scenario: company_branches not substituted

- **WHEN** a template contains `{{company_branches}}` and document generation runs
- **THEN** the placeholder is not mapped by `buildSubstitutionMap` and renders as unresolved or empty per existing template engine behavior

### Requirement: Variable catalog proveedor group

The frontend variable catalog MUST define group `proveedor` with proveedor variables including `proveedor_red_social` and `proveedor_cuenta_social`. The catalog MUST NOT expose `proveedor_tipo` or `company_branches`. Group `contrato` MUST include `fecha_contrato`, `lugar_contrato`, `mes_ejecucion`, `cantidad_reels`, `precio_numero`, and `precio_texto`. The catalog MUST NOT expose `contract_type`, `work_schedule`, or `signing_city`.

#### Scenario: Editor variable picker without obsolete variables

- **WHEN** a user opens the variable catalog in the rich text editor
- **THEN** `proveedor_tipo`, `contract_type`, `work_schedule`, and `signing_city` are not listed
- **AND** `lugar_contrato` and `fecha_contrato` are available under contrato

#### Scenario: Proveedor social variables listed

- **WHEN** a user opens the proveedor group in the variable catalog
- **THEN** `proveedor_red_social` and `proveedor_cuenta_social` are listed

### Requirement: Generated document persists supplier reference

The `generated_document` table MUST reference `supplier_id` instead of `employee_id` after migration `202605290006`. New PDF generation MUST persist the selected supplier id and standard template id when applicable.

#### Scenario: Persisted row references supplier
- **WHEN** document generation succeeds for supplier id `S1` with standard template id `T1`
- **THEN** the inserted `generated_document` row has `supplier_id` equal to `S1` and `standard_template_id` equal to `T1`

### Requirement: Document Builder lists only standard templates

The Document Builder template selector (UI and `listEligibleTemplates` API) MUST expose only standard templates. Company-scoped templates MUST NOT appear in the list. `GET /api/document-builder/templates` SHALL accept optional query parameter `supplier_type` with values `'persona_natural'` or `'empresa'`. When provided with a valid value, the API MUST return only standard templates whose `supplier_type` matches. Each item in the response MUST include `supplier_type`. When `supplier_type` is provided but invalid, the API MUST respond HTTP 400 with a message in Spanish.

The Document Builder UI (`DocumentBuilderPage.jsx`) MUST automatically pass `supplier_type` from the selected supplier when fetching templates via `fetchDocumentBuilderTemplates`. The UI MUST NOT prompt the user to choose a supplier type separately. Templates MUST NOT load for template selection until a supplier is selected. When the user changes the selected supplier to one with a different `supplier_type`, any previously selected template MUST be cleared.

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

#### Scenario: Document Builder auto-filters templates by selected supplier type
- **WHEN** an authorized user selects a supplier with `supplier_type: 'persona_natural'` in Document Builder
- **THEN** the frontend calls `GET /api/document-builder/templates` with query param `supplier_type=persona_natural`
- **AND** only persona natural templates appear in the template selector

#### Scenario: Changing supplier clears incompatible template selection
- **WHEN** an authorized user had selected a template while supplier A (persona natural) was selected
- **AND** the user then selects supplier B (empresa)
- **THEN** the previously selected template is cleared from Document Builder state

### Requirement: Document Builder generate rejects company templates

The document builder generate endpoint MUST accept only standard templates. Requests with `template.kind` equal to `company` MUST be rejected with HTTP 400 and a message in Spanish.

#### Scenario: Generate with standard template
- **WHEN** an authorized client posts generate with `template: { kind: 'standard', id: '<uuid>' }`, valid `companyId`, and valid `supplierId`
- **THEN** the server generates a PDF and persists `standard_template_id` without `company_template_id`

#### Scenario: Generate with company template rejected
- **WHEN** an authorized client posts generate with `template: { kind: 'company', id: '<uuid>' }`
- **THEN** the server responds with HTTP 400 and a Spanish validation message

### Requirement: Document Builder dry-run validation

`generateAndPersist` in `documentBuilderService.js` SHALL accept `body.dryRun === true`. When dry run is active, the function MUST perform company scope resolution, supplier and template loading, placeholder substitution checks, and return success with `{ valid: true }` when all placeholders resolve. It MUST NOT upload to GCS, insert or update rows in `draft_document` or `document`, or delete existing GCS objects. When placeholders are missing, behavior MUST match the existing `MISSING_PLACEHOLDERS` response (HTTP-equivalent 422 semantics in the service result object).

#### Scenario: Dry run succeeds without side effects

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and all template variables resolve
- **THEN** the result is `ok: true` with validation success and no GCS or database mutations occur

#### Scenario: Dry run reports missing placeholders

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and unresolved template keys exist
- **THEN** the result is `ok: false` with code `MISSING_PLACEHOLDERS` and `missingFieldKeys`, without persisting a document

#### Scenario: Dry run skips duplicate draft check

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and an active duplicate draft would exist for the same month
- **THEN** validation still returns placeholder success without returning `DUPLICATE_DRAFT` and without writing data

### Requirement: Company commercial name substitution

`buildSubstitutionMap` in `documentBuilderVariableContext.js` MUST map `company_nombre_comercial` to the trimmed string value of `company.short_name`, or empty string when absent. `documentBuilderService.js` `VARIABLE_META` MUST define `company_nombre_comercial` with `label: 'Nombre Comercial'`, `type: 'text'`, and `source: 'company'`. The frontend variable catalog group `empresa` MUST list `company_nombre_comercial` immediately after `company_legal_name` with description stating it is the abbreviated or commercial name used in contracts.

#### Scenario: Template resolves commercial name from company

- **WHEN** a template contains `{{company_nombre_comercial}}` and the selected company has `short_name` `"Dynamics"`
- **THEN** the generated document text contains `"Dynamics"`

#### Scenario: Variable catalog lists commercial name

- **WHEN** a user opens the empresa group in the variable catalog
- **THEN** `company_nombre_comercial` appears after `company_legal_name`

#### Scenario: Missing short_name resolves empty

- **WHEN** a template contains `{{company_nombre_comercial}}` and company row has empty `short_name`
- **THEN** the substitution map value for `company_nombre_comercial` is an empty string

