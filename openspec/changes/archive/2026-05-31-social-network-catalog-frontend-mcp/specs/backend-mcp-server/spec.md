## MODIFIED Requirements

### Requirement: MCP tool crear_proveedor

The server SHALL expose tool `crear_proveedor` accepting a supplier payload matching `supplierService.createSupplier` expectations (`supplier_type`, type-specific fields, optional `social_networks`). It SHALL pass `userId: MCP_USER_ID`. The tool description MUST document that optional `social_networks` is an array of objects with `catalog_id` (UUID from `social_network_catalog`) and `account_name` (handle, e.g. `@miempresa`). The description MUST instruct Claude to call `listar_catalogo_redes` before setting social networks to obtain valid `catalog_id` values.

#### Scenario: Create persona natural supplier

- **WHEN** Claude invokes `crear_proveedor` with valid persona natural fields
- **THEN** the tool returns `ok: true` with the created supplier including formatted RUT

#### Scenario: Create supplier with catalog social networks

- **WHEN** Claude invokes `crear_proveedor` with `social_networks` containing valid `catalog_id` and `account_name` obtained from `listar_catalogo_redes`
- **THEN** the tool returns `ok: true` with the created supplier including the social networks

### Requirement: MCP tool actualizar_proveedor

The server SHALL expose tool `actualizar_proveedor` with required `id` and partial `payload`. It SHALL call `supplierService.updateSupplier(id, { payload, userId: MCP_USER_ID })`. The tool description MUST document that when `social_networks` is sent it replaces the full list and each entry MUST include `catalog_id` (UUID from catalog) and `account_name`. The description MUST instruct Claude to call `listar_catalogo_redes` before updating social networks.

#### Scenario: Update supplier social networks

- **WHEN** Claude invokes `actualizar_proveedor` with a new `social_networks` array using valid `catalog_id` values
- **THEN** the tool returns the updated supplier with replaced social networks

## ADDED Requirements

### Requirement: MCP tool listar_catalogo_redes

The server SHALL expose tool `listar_catalogo_redes` that calls `supplierService.listSocialNetworkCatalog()` directly (without internal HTTP). The tool description MUST state that Claude should call this tool before creating or updating supplier social networks to obtain valid `catalog_id` UUIDs. The response MUST return `ok: true` with `data.items` where each item includes at least `id`, `code`, and `name`.

#### Scenario: List social network catalog

- **WHEN** Claude invokes `listar_catalogo_redes`
- **THEN** the tool returns `ok: true` with catalog entries including `id`, `code`, and `name` for each network

#### Scenario: Catalog used before create

- **WHEN** Claude needs to set social networks on `crear_proveedor`
- **THEN** the tool description directs Claude to invoke `listar_catalogo_redes` first to resolve `catalog_id` values
