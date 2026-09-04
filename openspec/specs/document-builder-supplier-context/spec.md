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
- `fecha_contrato`, `lugar_contrato`, `mes_ejecucion`, `cantidad_reels`, `formato_reel`, `precio_numero`, `precio_texto`

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

#### Scenario: formato_reel detected as missing without override

- **WHEN** a template contains `{{formato_reel}}` and no override is provided
- **THEN** `formato_reel` appears in unresolved keys

#### Scenario: company_branches not substituted

- **WHEN** a template contains `{{company_branches}}` and document generation runs
- **THEN** the placeholder is not mapped by `buildSubstitutionMap` and renders as unresolved or empty per existing template engine behavior

### Requirement: Variable catalog proveedor group

The frontend variable catalog MUST define group `proveedor` with proveedor variables including `proveedor_red_social` and `proveedor_cuenta_social`. The catalog MUST NOT expose `proveedor_tipo` or `company_branches`. Group `contrato` MUST include `fecha_contrato`, `lugar_contrato`, `mes_ejecucion`, `cantidad_reels`, `formato_reel`, `precio_numero`, and `precio_texto`. The catalog MUST NOT expose `contract_type`, `work_schedule`, or `signing_city`.

#### Scenario: Editor variable picker without obsolete variables

- **WHEN** a user opens the variable catalog in the rich text editor
- **THEN** `proveedor_tipo`, `contract_type`, `work_schedule`, and `signing_city` are not listed
- **AND** `lugar_contrato` and `fecha_contrato` are available under contrato

#### Scenario: Proveedor social variables listed

- **WHEN** a user opens the proveedor group in the variable catalog
- **THEN** `proveedor_red_social` and `proveedor_cuenta_social` are listed

#### Scenario: Formato de reel listed under contrato

- **WHEN** a user opens the contrato group in the variable catalog
- **THEN** `formato_reel` is listed with label "Formato de reel"

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

### Requirement: Contract variable formato_reel

The system SHALL define contract variable `formato_reel` (label "Formato de reel", group `contrato`, source `contract`) holding the publication format that accompanies `cantidad_reels` in clause 2.3.

`VARIABLE_META` MUST declare it with `type: 'select'`, and `buildMissingFields` MUST populate `field.options` with the closed catalog `FORMATO_REEL_OPTIONS`: Reel, Video, Historia, Story, Post, Carrusel, Short.

`backend/utils/formatReels.js` MUST expose `formatFormatoReel(formato, cantidad)`, which renders the format in lowercase agreeing in number with `cantidad_reels`: singular when the quantity is exactly 1, plural otherwise. Matching MUST ignore case, diacritics and a trailing `s`, so "Vídeos", "videos" and "Video" resolve to the same catalog entry. Catalog entries carry explicit plurals so anglicisms are not mangled ("reel" → "reels", never "reeles"). A format outside the catalog MUST be lowercased and pluralized with the generic Spanish rule (vowel → `s`, `-ión` → `-iones`, otherwise `es`). An empty value MUST be returned untouched. When the quantity is absent or not an integer, the singular MUST be used.

#### Scenario: Singular format

- **WHEN** `formato_reel` is "Reel" and `cantidad_reels` is 1
- **THEN** the rendered format is `"reel"`

#### Scenario: Plural format

- **WHEN** `formato_reel` is "Video" and `cantidad_reels` is 3
- **THEN** the rendered format is `"videos"`

#### Scenario: Anglicism plural is not over-applied

- **WHEN** `formato_reel` is "Reel" and `cantidad_reels` is 2
- **THEN** the rendered format is `"reels"` and never `"reeles"`

#### Scenario: Format outside the catalog

- **WHEN** `formato_reel` is "Publicación" and `cantidad_reels` is 3
- **THEN** the rendered format is `"publicaciones"`

#### Scenario: Missing quantity falls back to singular

- **WHEN** `formato_reel` is "Video" and `cantidad_reels` is empty
- **THEN** the rendered format is `"video"`

#### Scenario: Format offered as a select

- **WHEN** generation reports `formato_reel` as a missing field
- **THEN** the field has `type` `select` and `options` listing Reel, Video, Historia, Story, Post, Carrusel and Short

### Requirement: Contract variable cantidad_reels rendered in words and figures

`cantidad_reels` SHALL be rendered as cardinal words followed by the figure in parentheses, without a noun: 1 → `"un (1)"`, 3 → `"tres (3)"`, 21 → `"veintiún (21)"`. The noun is supplied separately by `formato_reel`.

`backend/utils/formatReels.js` MUST expose `formatCantidadReels(value)` for this, reusing `cardinal` exported from `backend/utils/formatDuracion.js` so apocopation matches `duracion_ejecucion` and `dias_cesion`. Thousands separators in the input MUST be accepted. An empty or non-numeric value MUST be returned untouched.

`preprocessMissingFieldOverrides` MUST resolve `formato_reel` before rewriting `cantidad_reels`, since number agreement depends on the parsed integer.

#### Scenario: Quantity in words and figures

- **WHEN** generation receives `missingFieldOverrides: { cantidad_reels: '3' }`
- **THEN** the substitution map has `cantidad_reels` equal to `"tres (3)"`

#### Scenario: Quantity apocopation

- **WHEN** generation receives `missingFieldOverrides: { cantidad_reels: '21' }`
- **THEN** the substitution map has `cantidad_reels` equal to `"veintiún (21)"`

#### Scenario: Non-numeric quantity is left alone

- **WHEN** generation receives `missingFieldOverrides: { cantidad_reels: 'varios' }`
- **THEN** the substitution map has `cantidad_reels` equal to `"varios"`

### Requirement: Clause 2.3 pairs quantity and format

Every active standard template SHALL express clause 2.3 as "… la generación y publicación de `{{cantidad_reels}}` `{{formato_reel}}` en …", with the `formato_reel` variable node immediately following the `cantidad_reels` node, separated by a single space.

Inactive templates MUST NOT be modified.

#### Scenario: Clause 2.3 renders a single reel

- **WHEN** a contract is generated with `cantidad_reels` 1 and `formato_reel` "Reel"
- **THEN** clause 2.3 reads "… la generación y publicación de un (1) reel en …"

#### Scenario: Clause 2.3 renders several videos

- **WHEN** a contract is generated with `cantidad_reels` 3 and `formato_reel` "Video"
- **THEN** clause 2.3 reads "… la generación y publicación de tres (3) videos en …"

### Requirement: Date variables rendered in Chilean legal format

All date-typed template variables SHALL be rendered as "15 de marzo de 2024" — day without leading zero, month name in lowercase Spanish, four-digit year. This applies to `fecha_contrato`, `fecha_escritura` (Fecha Escritura Pública) and `fecha_estatuto` (Fecha Certificado Estatuto).

`backend/utils/formatFechaEs.js` MUST expose `formatFechaEs(value)` as the single implementation, and both `documentBuilderVariableContext.js` and `documentBuilderService.js` MUST use it. Neither file may keep its own `MESES_ES` list or private date formatter.

The function MUST accept both forms the value arrives in:

- A `Date` instance, which is what `pg` returns for `date` columns. Its **local** components MUST be read, never the UTC ones: `pg` builds the value at local midnight, so `toISOString()` would shift the day backwards in timezones west of Greenwich, Chile included.
- An ISO string (`YYYY-MM-DD`, optional time), which is what the form and the MCP send as an override. It MUST be parsed component-wise, for the same reason.

Any other value MUST be returned unchanged, so an already-formatted date passes through. An invalid `Date`, `null` and `undefined` MUST yield the empty string.

#### Scenario: Supplier date stored in the database

- **WHEN** an empresa supplier has `fecha_certificado_estatuto` stored and a contract is generated
- **THEN** `fecha_estatuto` renders as "27 de mayo de 2025"
- **AND** it never renders the JavaScript `Date` English form such as "Tue May 27 2025 00:00:00 GMT-0400 (Chile Standard Time)"

#### Scenario: Date supplied as an override

- **WHEN** generation receives `missingFieldOverrides: { fecha_escritura: '2024-03-15' }`
- **THEN** the substitution map has `fecha_escritura` equal to `"15 de marzo de 2024"`

#### Scenario: Day is not shifted by timezone

- **WHEN** the value is a `Date` built at local midnight on 31 December 2024
- **THEN** it renders as "31 de diciembre de 2024"

#### Scenario: Day has no leading zero

- **WHEN** the value is `'2024-03-05'`
- **THEN** it renders as "5 de marzo de 2024"

#### Scenario: Already formatted value passes through

- **WHEN** the value is `'15 de marzo de 2024'`
- **THEN** it is returned unchanged

#### Scenario: Empty values

- **WHEN** the value is `null`, `undefined` or an invalid `Date`
- **THEN** the result is the empty string

### Requirement: Date overrides are formatted before substitution

`preprocessMissingFieldOverrides` SHALL format every date-typed override through `formatFechaEs`, driven by a single list `DATE_OVERRIDE_KEYS` containing `fecha_contrato`, `fecha_escritura` and `fecha_estatuto`.

This is required because an override replaces the value already formatted by `buildSubstitutionMap`; without it, a supplier-sourced date entered by hand reaches the PDF as a raw ISO string.

#### Scenario: Personería override does not bypass formatting

- **WHEN** a supplier has no `fecha_escritura_publica` stored and the user supplies `fecha_escritura` as `'2024-03-15'`
- **THEN** the PERSONERÍA clause reads "de fecha 15 de marzo de 2024" and never "de fecha 2024-03-15"

#### Scenario: Contract date keeps its existing behaviour

- **WHEN** generation receives `missingFieldOverrides: { fecha_contrato: '2026-08-06' }`
- **THEN** the substitution map has `fecha_contrato` equal to `"6 de agosto de 2026"`

### Requirement: Select override values must match resolved options

`generateAndPersist` MUST validate every non-empty `missingFieldOverrides` entry whose field, after mapping secondaries through `SECONDARY_FIELDS`, resolves via `resolveFieldDefinition(key, { clientRow, supplierRow })` to `type: 'select'` with a non-empty `options` array. `resolveFieldDefinition` MUST be the same function `buildMissingFields` uses to set `type` and `options`, so the allowed values cannot drift from the `missingFields` catalog.

Comparison MUST be exact string equality against:

- each option when options are strings (e.g. `FORMATO_REEL_OPTIONS` for `formato_reel`);
- `option.values[<primaryKey>]` when options are `{ label, values }` objects — plus the pair rule in "Supplier social network override must match a stored pair".

The check MUST run on the raw overrides, before `preprocessMissingFieldOverrides`. A mismatch MUST return `ok: false`, HTTP-equivalent status 400, `code: 'VALIDATION_ERROR'`, and a Spanish (es-CL) message that names the field `label` and lists the valid options in `missingFields` order (string options as-is; object options by `label`). The message MUST NOT include the rejected value. Fields that resolve to `text`, `date`, `number`, or select without options MUST NOT be rejected by this rule.

The check MUST apply to real generate and to `dryRun: true` (REST and MCP). It MUST NOT run on `signContract` or on download of an existing draft.

#### Scenario: formato_reel catalog value accepted then formatted

- **WHEN** generation receives `missingFieldOverrides: { formato_reel: "Video", cantidad_reels: "3" }`
- **THEN** the catalog check passes
- **AND** the substitution map has `formato_reel` equal to `"videos"` (existing preprocess)

#### Scenario: formato_reel outside catalog rejected

- **WHEN** generation or dry-run receives `missingFieldOverrides.formato_reel` equal to `"Publicación"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the message is in Spanish, names `Formato de reel`, and lists Reel, Video, Historia, Story, Post, Carrusel and Short
- **AND** the message does not contain `"Publicación"`
- **AND** no PDF is uploaded and no draft row is written

#### Scenario: formato_reel different casing rejected

- **WHEN** generation or dry-run receives `missingFieldOverrides.formato_reel` equal to `"video"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the listed options include `"Video"` and do not treat `"video"` as a match

#### Scenario: Non-select override is not catalog-checked

- **WHEN** generation receives `missingFieldOverrides.lugar_contrato` equal to any non-empty string
- **THEN** this select catalog rule does not reject the value

#### Scenario: Signing a draft does not re-check select catalogs

- **WHEN** `signContract` runs on a draft that has `content_snapshot` and `contract_overrides.formato_reel` equal to the already-rendered `"videos"`
- **THEN** signing proceeds without a `VALIDATION_ERROR` from this rule

### Requirement: Supplier social network override must match a stored pair

When `resolveFieldDefinition('proveedor_red_social', { supplierRow })` yields `type: 'select'` with `{ label, values }` options built from `supplierRow.social_networks`, `generateAndPersist` MUST:

1. Accept a non-empty `proveedor_red_social` only if it equals some `option.values.proveedor_red_social` by exact comparison.
2. When both `proveedor_red_social` and `proveedor_cuenta_social` are non-empty, accept them only if some option has `values` equal to that pair. A cross combination (network from one row, account from another) MUST be rejected even if each piece exists on the supplier.

If the field resolves to `type: 'text'` (no social networks), this pair rule MUST NOT apply. A pair mismatch MUST use the same `VALIDATION_ERROR` path as other select failures, listing option `label` values (e.g. `Instagram — @marca`).

#### Scenario: Matching social pair accepted

- **WHEN** the supplier has social networks `{ name: "Instagram", account_name: "@marca" }` and `{ name: "TikTok", account_name: "@otra" }`
- **AND** generation or dry-run receives `proveedor_red_social: "Instagram"` and `proveedor_cuenta_social: "@marca"`
- **THEN** the pair check passes

#### Scenario: Crossed social pair rejected

- **WHEN** the supplier has social networks `{ name: "Instagram", account_name: "@marca" }` and `{ name: "TikTok", account_name: "@otra" }`
- **AND** generation or dry-run receives `proveedor_red_social: "Instagram"` and `proveedor_cuenta_social: "@otra"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the message is in Spanish, names `Red Social`, and lists `Instagram — @marca` and `TikTok — @otra`
- **AND** the message does not contain the rejected network or account values
- **AND** no PDF is uploaded and no draft row is written

#### Scenario: Unknown social network rejected

- **WHEN** the supplier has social network `{ name: "Instagram", account_name: "@marca" }`
- **AND** generation or dry-run receives `proveedor_red_social: "Facebook"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the listed options include `Instagram — @marca`

#### Scenario: No social networks keeps free text

- **WHEN** the supplier has no `social_networks`
- **AND** generation receives `proveedor_red_social: "Instagram"`
- **THEN** this pair rule does not reject the value

