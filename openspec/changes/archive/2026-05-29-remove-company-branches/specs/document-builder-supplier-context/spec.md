## MODIFIED Requirements

### Requirement: Proveedor variable substitution

`buildSubstitutionMap` in `documentBuilderVariableContext.js` MUST map supplier fields to these template keys:

- `proveedor_nombre` — `full_name` (persona natural) or `razon_social` (empresa)
- `proveedor_rut` — `rut_display` or `rut_empresa_display`
- `proveedor_direccion` — `address` or `direccion_empresa`
- `proveedor_giro` — `giro` or empty string for persona natural
- `proveedor_rep_legal` — `nombre_rep_legal` or empty string for persona natural
- `proveedor_rep_legal_rut` — `rut_rep_legal_display` or empty string for persona natural
- `proveedor_tipo` — `Persona Natural` or `Empresa`

Company variables (`company_*`) MUST remain available except `company_branches`, which MUST NOT be defined in the substitution map. `loadCompanyRow` MUST NOT load branch data or attach `branches_text` to the company object.

#### Scenario: Persona natural substitution
- **WHEN** a template contains `{{proveedor_nombre}}` and the selected supplier is persona natural with `full_name` "Ana Pérez"
- **THEN** the generated document text contains "Ana Pérez"

#### Scenario: Empresa substitution
- **WHEN** a template contains `{{proveedor_giro}}` and the selected supplier is empresa with giro "Servicios TI"
- **THEN** the generated document text contains "Servicios TI"

#### Scenario: company_branches not substituted
- **WHEN** a template contains `{{company_branches}}` and document generation runs
- **THEN** the placeholder is not mapped by `buildSubstitutionMap` and renders as unresolved or empty per existing template engine behavior

### Requirement: Variable catalog proveedor group

The frontend variable catalog MUST define group `proveedor` with the seven `proveedor_*` variables. The catalog MUST NOT expose `company_branches`. Other `company_*` variables MUST remain in the catalog. `VariableCatalog.jsx` MUST expose the proveedor group and MUST NOT expose trabajador.

#### Scenario: Editor variable picker without company_branches
- **WHEN** a user opens the variable catalog in the rich text editor
- **THEN** `company_branches` is not listed and other company variables remain available
