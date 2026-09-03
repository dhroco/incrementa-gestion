## MODIFIED Requirements

### Requirement: MCP tool listar_proveedores

The server SHALL expose tool `listar_proveedores` that calls `supplierService.listSuppliers({ search? })`. Each returned supplier MUST include `email` and `phone` (`null` when absent). The tool description MUST state that Claude should call this tool before creating a supplier to check for existing matches by name or RUT, and MUST state that the listing includes contact fields `email` and `phone`.

#### Scenario: Search suppliers

- **WHEN** Claude invokes `listar_proveedores` with a search string matching a RUT fragment
- **THEN** matching suppliers are returned in the JSON response

#### Scenario: List includes contact fields

- **WHEN** Claude invokes `listar_proveedores`
- **THEN** each supplier in the JSON includes `email` and `phone`

### Requirement: MCP tool obtener_proveedor

The server SHALL expose tool `obtener_proveedor` with required parameter `id` (UUID). It SHALL call `supplierService.getSupplierById(id)` and return the full supplier record including social networks, `email`, and `phone`. The tool description MUST mention that the detail includes email and phone.

#### Scenario: Get existing supplier

- **WHEN** Claude invokes `obtener_proveedor` with a valid supplier id
- **THEN** the tool returns `ok: true` with supplier details including `email` and `phone`

#### Scenario: Supplier not found

- **WHEN** Claude invokes `obtener_proveedor` with an unknown id
- **THEN** the tool returns `ok: false` with code `NOT_FOUND`

### Requirement: MCP tool crear_proveedor

The server SHALL expose tool `crear_proveedor` accepting a supplier payload matching `supplierService.createSupplier` expectations (`supplier_type`, type-specific fields, required `email`, optional `phone`, optional `social_networks`). It SHALL pass `userId: MCP_USER_ID`. Validation of email and phone SHALL be performed by `supplierService` (same rules as `POST /api/suppliers`); the tool MUST NOT add a separate validation path. The tool description MUST document that `email` is required (valid mailbox, stored lowercase), that optional `phone` is stored as typed, and that optional `social_networks` is an array of objects with `catalog_id` (UUID from `social_network_catalog`) and `account_name` (handle, e.g. `@miempresa`). The description MUST instruct Claude to call `listar_catalogo_redes` before setting social networks to obtain valid `catalog_id` values. Error messages MUST be in Spanish and MUST NOT include the submitted email or phone values.

#### Scenario: Create persona natural supplier

- **WHEN** Claude invokes `crear_proveedor` with valid persona natural fields including a valid `email`
- **THEN** the tool returns `ok: true` with the created supplier including formatted RUT and the normalized `email`

#### Scenario: Create without email rejected

- **WHEN** Claude invokes `crear_proveedor` with valid type fields but without `email`
- **THEN** the tool returns `ok: false` with a Spanish `message` stating that email is required
- **AND** no supplier row is inserted

#### Scenario: Create supplier with catalog social networks

- **WHEN** Claude invokes `crear_proveedor` with a valid `email` and `social_networks` containing valid `catalog_id` and `account_name` obtained from `listar_catalogo_redes`
- **THEN** the tool returns `ok: true` with the created supplier including the social networks

### Requirement: MCP tool actualizar_proveedor

The server SHALL expose tool `actualizar_proveedor` with required `id` and partial `payload`. It SHALL call `supplierService.updateSupplier(id, { payload, userId: MCP_USER_ID })`. The payload MAY include `email` and `phone` with the same optional-on-update rules as `PUT /api/suppliers/:id` (omitted leaves the column unchanged; a supplier that already has NULL email can be updated without sending `email`). The tool description MUST document that when `social_networks` is sent it replaces the full list and each entry MUST include `catalog_id` (UUID from catalog) and `account_name`, and MUST document optional `email` and `phone`. The description MUST instruct Claude to call `listar_catalogo_redes` before updating social networks.

#### Scenario: Update supplier social networks

- **WHEN** Claude invokes `actualizar_proveedor` with a new `social_networks` array using valid `catalog_id` values
- **THEN** the tool returns the updated supplier with replaced social networks

#### Scenario: Update email on existing supplier

- **WHEN** Claude invokes `actualizar_proveedor` with `{ email: "contacto@agencia.cl" }` for an existing id
- **THEN** the tool returns `ok: true` with the supplier `email` equal to `contacto@agencia.cl`

#### Scenario: Update without email on legacy supplier

- **WHEN** Claude invokes `actualizar_proveedor` with a payload that omits `email` for a supplier whose email is NULL
- **THEN** the tool returns `ok: true`
- **AND** `email` remains NULL
