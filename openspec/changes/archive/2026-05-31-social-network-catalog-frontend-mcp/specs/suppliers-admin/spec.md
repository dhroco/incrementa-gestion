## MODIFIED Requirements

### Requirement: Suppliers admin UI

The frontend MUST provide list, read-only detail, and create/edit pages at `/app/proveedores`, `/app/proveedores/nuevo`, `/app/proveedores/:id`, and `/app/proveedores/:id/edit`. The UI MUST hide "Nuevo proveedor" without CREATE grant and "Editar" without EDIT grant; validate required fields and RUT on the client; display RUT as `XX.XXX.XXX-X`; show conditional sections for persona natural vs empresa including optional personería; and follow corporate UI tokens (pill buttons, white cards, Nunito Sans, link color `#F62D84`).

Social networks MUST be captured and displayed using `SocialNetworkSelector` (catalog-based visual selector with icons), not a free-text editable table with hardcoded network name options. Form state and create/update payloads MUST send `social_networks` as an array of `{ catalog_id, account_name }` where `catalog_id` is a UUID referencing `social_network_catalog`. The field `network_name` MUST NOT be used in form state or submit payloads.

The create page MUST display the form as two vertically stacked block cards ("Datos básicos del proveedor" and "Redes sociales") without tabs. The view and edit pages MUST display three tabs: "Datos básicos", "Redes sociales", and "Antecedentes contractuales". The third tab MUST show contract history (signed documents and drafts in progress) for the supplier. On validation failure during submit, the UI MUST navigate to the tab containing the first field error.

Client-side validation of social networks MUST require both `catalog_id` and non-empty `account_name` for each submitted network entry. Validation error messages MUST be in Spanish (es-CL).

#### Scenario: Create flow

- **WHEN** a user with CREATE grant opens `/app/proveedores/nuevo`, completes a valid empresa form including social networks via the catalog selector, and saves
- **THEN** the user is redirected to list or detail and the new supplier appears in the list
- **AND** the create payload contains `social_networks` with `catalog_id` and `account_name` only

#### Scenario: Type locked on edit

- **WHEN** a user edits an existing supplier
- **THEN** the supplier type selector is not changeable

#### Scenario: Read-only user

- **WHEN** a user has only READ grant
- **THEN** create and edit actions are not visible but list and detail remain accessible

#### Scenario: Detail shows contract history tab

- **WHEN** a user with READ grant opens `/app/proveedores/:id` and selects "Antecedentes contractuales"
- **THEN** signed and in-progress contract tables are displayed for that supplier

#### Scenario: Detail shows social networks with icons

- **WHEN** a user with READ grant opens `/app/proveedores/:id` and selects "Redes sociales"
- **THEN** assigned networks are displayed with icon, catalog name, and account handle via `SocialNetworkSelector` in read-only mode

#### Scenario: Incomplete social network rejected on submit

- **WHEN** a user selects a network in the catalog selector but leaves the account handle empty and submits
- **THEN** validation fails with a Spanish error message
- **AND** the active tab switches to "Redes sociales" if applicable
