## MODIFIED Requirements

### Requirement: Client list page

The frontend MUST provide `ClientListPage` with columns Nombre, Marca, Cuenta marca, and N° productos/campañas (count of `product_campaigns`). It MUST offer search, **Ver** and **Editar** actions styled as system links (`#F62D84`), and **Nuevo cliente** when the user can `create` on `Client`. Styling MUST match Proveedores list (cards, tables, pill buttons).

#### Scenario: List displays campaign count

- **WHEN** an authorized user opens the client list
- **THEN** each row shows the number of product campaigns for that client
- **AND** the column header reads **N° productos/campañas**

### Requirement: Client view and upsert pages

The frontend MUST provide `ClientViewPage` and `ClientUpsertPage` using `ClientFormPageStack` with blocks **Datos del cliente** and **Productos/Campañas**. User-visible labels, placeholders, empty states, and aria-labels in the product/campaign section MUST use **Producto/Campaña** or **Productos/Campañas** (not «Campaña» alone). The campaigns table MUST support add row, delete row, and edit `name` per row, following the editable social networks pattern in Proveedores. Internal prop names, API fields, and database column names MUST remain unchanged (`product_campaigns`, etc.).

#### Scenario: Create flow shows Producto/Campaña labels

- **WHEN** an authorized user navigates to create client
- **THEN** the second form block title reads **Productos/Campañas**
- **AND** add-row control reads **Agregar producto/campaña** (or equivalent consistent wording)

#### Scenario: Read-only empty state wording

- **WHEN** a client has no product campaigns in view mode
- **THEN** the empty message uses **producto/campaña** terminology in Spanish
