## MODIFIED Requirements

### Requirement: MCP tool listar_plantillas

The server SHALL expose tool `listar_plantillas` that calls `standardTemplatesService.listStandardTemplates({ search?, supplier_type? })`. The tool description MUST explain that it lists standard contract templates available for document generation and returns id, name, code, and status. The tool description MUST instruct Claude to pass `supplier_type` once the supplier's type is known (from `listar_proveedores` or `obtener_proveedor`) to return only compatible templates. Optional parameter `supplier_type` SHALL accept `'persona_natural'` or `'empresa'`.

#### Scenario: List templates without filter
- **WHEN** Claude invokes `listar_plantillas` with no search term and no supplier_type
- **THEN** the tool returns all standard templates ordered by recency

#### Scenario: List templates filtered by supplier type
- **WHEN** Claude invokes `listar_plantillas` with `supplier_type: 'empresa'`
- **THEN** every returned template has `supplier_type` equal to `'empresa'`
