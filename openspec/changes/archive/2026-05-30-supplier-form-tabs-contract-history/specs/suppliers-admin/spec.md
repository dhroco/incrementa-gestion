## MODIFIED Requirements

### Requirement: Suppliers admin UI

The frontend MUST provide list, read-only detail, and create/edit pages at `/app/proveedores`, `/app/proveedores/nuevo`, `/app/proveedores/:id`, and `/app/proveedores/:id/edit`. The UI MUST hide "Nuevo proveedor" without CREATE grant and "Editar" without EDIT grant; validate required fields and RUT on the client; display RUT as `XX.XXX.XXX-X`; show conditional sections for persona natural vs empresa including optional personería and dynamic social network rows; and follow corporate UI tokens (pill buttons, white cards, Nunito Sans, link color `#F62D84`).

The create page MUST display the form as two vertically stacked block cards ("Datos básicos del proveedor" and "Redes sociales") without tabs. The view and edit pages MUST display three tabs: "Datos básicos", "Redes sociales", and "Antecedentes contractuales". The third tab MUST show contract history (signed documents and drafts in progress) for the supplier. On validation failure during submit, the UI MUST navigate to the tab containing the first field error.

#### Scenario: Create flow
- **WHEN** a user with CREATE grant opens `/app/proveedores/nuevo`, completes a valid empresa form, and saves
- **THEN** the user is redirected to list or detail and the new supplier appears in the list

#### Scenario: Type locked on edit
- **WHEN** a user edits an existing supplier
- **THEN** the supplier type selector is not changeable

#### Scenario: Read-only user
- **WHEN** a user has only READ grant
- **THEN** create and edit actions are not visible but list and detail remain accessible

#### Scenario: Detail shows contract history tab
- **WHEN** a user with READ grant opens `/app/proveedores/:id` and selects "Antecedentes contractuales"
- **THEN** signed and in-progress contract tables are displayed for that supplier

## ADDED Requirements

### Requirement: Supplier documents API

The backend MUST expose `GET /api/suppliers/:id/documents` requiring authentication and CASL authorization `read` on subject `Supplier`. The endpoint MUST return signed documents from table `document` and in-progress drafts from table `draft_document` (excluding `status = 'signed'`), each joined with template name, ordered by date descending. If the supplier id does not exist, respond HTTP 404 in Spanish.

#### Scenario: Documents for existing supplier
- **WHEN** an authorized client requests `/api/suppliers/:id/documents` for a valid supplier
- **THEN** HTTP 200 includes `signed_documents` and `draft_documents` arrays

#### Scenario: Documents for missing supplier
- **WHEN** an authorized client requests documents for a non-existent supplier id
- **THEN** HTTP 404 is returned
