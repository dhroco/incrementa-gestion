## ADDED Requirements

### Requirement: Suppliers consumed by Document Builder

The existing supplier list API (`GET /api/suppliers`) MUST be reusable by the Document Builder without a company filter. Users with document constructor navigation grant AND supplier read grant (`NAV_ACTION_PROVEEDORES_READ`) MUST be able to load the global supplier list for document generation. No new supplier CRUD endpoints are required for this integration.

#### Scenario: Document Builder loads suppliers
- **WHEN** an authorized user with proveedores read grant opens Document Builder
- **THEN** the client successfully loads suppliers via the same list API used on the Proveedores admin page

#### Scenario: Missing proveedores read grant
- **WHEN** a user has document constructor grant but lacks proveedores read grant
- **THEN** the supplier selector does not load data and shows an appropriate error or empty state in Spanish
