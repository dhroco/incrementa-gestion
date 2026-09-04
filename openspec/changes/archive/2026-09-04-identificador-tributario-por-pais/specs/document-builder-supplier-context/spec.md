## ADDED Requirements

### Requirement: Template country code

Table `template` MUST have nullable `country_code` (`varchar(2)`, ISO-3166-1 alpha-2). The migration MUST set `'MX'` on templates `CONTRATO_0016` and `CONTRATO_0017` and `'CL'` on every other existing `template` row.

#### Scenario: Mexican templates tagged MX

- **WHEN** the template country-code migration completes
- **THEN** `CONTRATO_0016` and `CONTRATO_0017` have `country_code` `MX`
- **AND** every other existing template row has `country_code` `CL`

### Requirement: Generate rejects country mismatch

`generateAndPersist` MUST compare `supplier.country_code` with `template.country_code` after loading both rows and before placeholder substitution. When `template.country_code` is non-null and differs from the supplier's country, the service MUST return `ok: false`, HTTP-equivalent status 400, `code: 'VALIDATION_ERROR'`, and a Spanish (es-CL) message that names both countries (e.g. Chile and México) and MUST NOT include document numbers. The check MUST run for real generate and for `dryRun: true`, on REST and MCP.

#### Scenario: Matching countries generate

- **WHEN** an authorized client generates (or dry-runs) CONTRATO_0016 with a Mexican supplier
- **THEN** the country rule does not reject the request

#### Scenario: Chilean template with Mexican supplier rejected

- **WHEN** an authorized client generates or dry-runs a template with `country_code` `CL` for a supplier with `country_code` `MX`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the message is in Spanish and names Chile and México
- **AND** the message does not contain the supplier's RFC
- **AND** no PDF is uploaded and no draft row is written

#### Scenario: Mexican template with Chilean supplier rejected

- **WHEN** an authorized client generates or dry-runs CONTRATO_0016 for a supplier with `country_code` `CL`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the message names México and Chile

### Requirement: Mexican templates say RFC not cédula

CONTRATO_0016 and CONTRATO_0017 MUST replace the phrase «cédula de identidad» with «RFC» in their Tiptap `content_json`. The migration MUST write a prior copy of each template's `content_json` to `template_content_backup` before mutating. Other template wording MUST NOT be translated in this change. Variable ids including `proveedor_rut` MUST NOT be renamed.

#### Scenario: Backup then replace wording

- **WHEN** the Mexican-wording migration completes
- **THEN** `template_content_backup` contains a row for CONTRATO_0016 and CONTRATO_0017
- **AND** those templates' text contains `RFC` in the former «cédula de identidad» position
- **AND** their `{{proveedor_rut}}` variable nodes remain `proveedor_rut`

## MODIFIED Requirements

### Requirement: Document Builder supplier selection

The Document Builder UI MUST allow the user to select one global supplier (not filtered by company) in addition to the selected company. The selector MUST display supplier display name (full name or razón social), the supplier's formatted document identifier (`document_display`, without running a non-RUT value through `formatRutDisplay`), and supplier type as a chip (`Persona Natural` or `Empresa`). The UI MUST use `fetchSuppliersList` from `suppliersApi` and MUST NOT load employees. After supplier selection, the UI MUST present an optional client selector before template selection; the user MAY proceed without selecting a client.

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

#### Scenario: Mexican supplier shows RFC in the selector

- **WHEN** the supplier list includes a persona natural with RFC `LEGF870121MGA`
- **THEN** the selector displays `LEGF870121MGA`
- **AND** it does not display a Chilean-punctuated corruption of that value

### Requirement: Proveedor variable substitution

`buildSubstitutionMap` in `documentBuilderVariableContext.js` MUST map supplier fields to these template keys:

- `proveedor_nombre` — `full_name` (persona natural) or `razon_social` (empresa)
- `proveedor_rut` — `document_display` (the country's identifier in its display format). The variable id MUST remain `proveedor_rut`.
- `proveedor_direccion` — `address` or `direccion_empresa`
- `proveedor_giro` — `giro` or empty string for persona natural
- `proveedor_rep_legal` — `nombre_rep_legal` or empty string for persona natural
- `proveedor_rep_legal_rut` — `rep_document_display` or empty string for persona natural / when absent

The map MUST NOT include `proveedor_tipo`, `contract_type`, `work_schedule`, `signing_city`, or `contract_date`.

The map MUST include contract and supplier override keys initialized to empty string so unresolved detection works:

- `proveedor_red_social`, `proveedor_cuenta_social`
- `fecha_contrato`, `lugar_contrato`, `mes_ejecucion`, `cantidad_reels`, `formato_reel`, `precio_numero`, `precio_texto`

Company variables (`company_*`) MUST remain available except `company_branches`, which MUST NOT be defined in the substitution map. Company RUT fields MUST continue to use `company.rut_body` / `rut_dv` (Incrementa is always Chilean).

#### Scenario: Persona natural substitution

- **WHEN** a template contains `{{proveedor_nombre}}` and the selected supplier is persona natural with `full_name` "Ana Pérez"
- **THEN** the generated document text contains "Ana Pérez"

#### Scenario: Empresa substitution

- **WHEN** a template contains `{{proveedor_giro}}` and the selected supplier is empresa with giro "Servicios TI"
- **THEN** the generated document text contains "Servicios TI"

#### Scenario: Chilean proveedor_rut keeps dotted format

- **WHEN** a template contains `{{proveedor_rut}}` and the selected Chilean supplier has canonical `document_number` `12345678-5`
- **THEN** the generated document text contains `12.345.678-5`

#### Scenario: Mexican proveedor_rut substitutes RFC

- **WHEN** a template contains `{{proveedor_rut}}` and the selected Mexican supplier has RFC `LEGF870121MGA`
- **THEN** the generated document text contains `LEGF870121MGA`

#### Scenario: New contract variables detected as missing without override

- **WHEN** a template contains `{{lugar_contrato}}` and no override is provided
- **THEN** `lugar_contrato` appears in unresolved keys

#### Scenario: formato_reel detected as missing without override

- **WHEN** a template contains `{{formato_reel}}` and no override is provided
- **THEN** `formato_reel` appears in unresolved keys

#### Scenario: company_branches not substituted

- **WHEN** a template contains `{{company_branches}}` and document generation runs
- **THEN** the placeholder is not mapped by `buildSubstitutionMap` and renders as unresolved or empty per existing template engine behavior
