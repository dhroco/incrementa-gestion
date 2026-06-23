## MODIFIED Requirements

### Requirement: MCP tool listar_empresas

The server SHALL expose tool `listar_empresas` that queries the `company` table directly via Knex, returning at minimum `id`, `business_name`, `short_name`, and display RUT fields needed to select a company for contract generation.

#### Scenario: List companies for contract context

- **WHEN** Claude invokes `listar_empresas`
- **THEN** the tool returns `ok: true` with an array of companies each including `id`, `business_name`, `short_name`, and formatted `rut`
