## ADDED Requirements

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

## MODIFIED Requirements

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
