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
