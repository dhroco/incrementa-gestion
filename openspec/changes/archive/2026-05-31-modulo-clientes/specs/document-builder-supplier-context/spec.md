## MODIFIED Requirements

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
