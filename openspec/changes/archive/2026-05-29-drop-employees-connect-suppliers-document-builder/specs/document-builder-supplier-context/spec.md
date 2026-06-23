## ADDED Requirements

### Requirement: Document Builder supplier selection

The Document Builder UI MUST allow the user to select one global supplier (not filtered by company) in addition to the selected company. The selector MUST display supplier display name (full name or razón social), RUT, and supplier type as a chip (`Persona Natural` or `Empresa`). The UI MUST use `fetchSuppliersList` from `suppliersApi` and MUST NOT load employees.

#### Scenario: Supplier list loads without company filter
- **WHEN** an authorized user opens Document Builder with document constructor grant
- **THEN** the supplier selector lists suppliers from the global suppliers API independent of company scope

#### Scenario: Supplier selection stored in state
- **WHEN** the user selects a supplier from the list
- **THEN** the document builder Redux state stores the selected supplier id for generation

### Requirement: Document Builder generate API uses supplier

The backend document builder generate endpoint MUST accept `supplierId` (string UUID) instead of `employeeIds`. It MUST load the supplier via `supplierService.getSupplierById`, reject missing or invalid suppliers with HTTP 400 and a message in Spanish, and MUST NOT query the `employee` table.

#### Scenario: Generate with valid supplier
- **WHEN** an authorized client posts generate with valid `companyId`, `supplierId`, and template
- **THEN** the server returns HTTP 200 with a generated PDF document referencing the supplier

#### Scenario: Generate without supplier
- **WHEN** an authorized client posts generate without `supplierId`
- **THEN** the server responds with HTTP 400 and a Spanish validation message

### Requirement: Proveedor variable substitution

`buildSubstitutionMap` in `documentBuilderVariableContext.js` MUST map supplier fields to these template keys:

- `proveedor_nombre` — `full_name` (persona natural) or `razon_social` (empresa)
- `proveedor_rut` — `rut_display` or `rut_empresa_display`
- `proveedor_direccion` — `address` or `direccion_empresa`
- `proveedor_giro` — `giro` or empty string for persona natural
- `proveedor_rep_legal` — `nombre_rep_legal` or empty string for persona natural
- `proveedor_rep_legal_rut` — `rut_rep_legal_display` or empty string for persona natural
- `proveedor_tipo` — `Persona Natural` or `Empresa`

Company variables (`company_*`) MUST remain unchanged.

#### Scenario: Persona natural substitution
- **WHEN** a template contains `{{proveedor_nombre}}` and the selected supplier is persona natural with `full_name` "Ana Pérez"
- **THEN** the generated document text contains "Ana Pérez"

#### Scenario: Empresa substitution
- **WHEN** a template contains `{{proveedor_giro}}` and the selected supplier is empresa with giro "Servicios TI"
- **THEN** the generated document text contains "Servicios TI"

### Requirement: Variable catalog proveedor group

The frontend variable catalog MUST define group `proveedor` with the seven `proveedor_*` variables specified in the change brief. The group `trabajador` and all `worker_*` variables MUST be removed. `VariableCatalog.jsx` MUST expose the proveedor group and MUST NOT expose trabajador.

#### Scenario: Editor variable picker
- **WHEN** a user opens the variable catalog in the rich text editor
- **THEN** a Proveedor group is available with the seven proveedor variables and no Trabajador group

### Requirement: Generated document persists supplier reference

The `generated_document` table MUST reference `supplier_id` instead of `employee_id` after migration `202605290006`. New PDF generation MUST persist the selected supplier id.

#### Scenario: Persisted row references supplier
- **WHEN** document generation succeeds for supplier id `S1`
- **THEN** the inserted `generated_document` row has `supplier_id` equal to `S1`
