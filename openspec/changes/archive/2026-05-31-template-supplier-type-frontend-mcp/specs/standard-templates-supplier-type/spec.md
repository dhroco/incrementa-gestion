## ADDED Requirements

### Requirement: Standard templates UI captures supplier_type

The standard templates create and edit forms (`StandardTemplateEditor.jsx`) SHALL include a required "Tipo de proveedor" field implemented as a native `<select className="clause-input">` with options `persona_natural` (label "Persona Natural") and `empresa` (label "Empresa"). The field MUST be included in the create and update API payload as `supplier_type`. Client-side validation MUST prevent submit when `supplier_type` is missing or invalid, consistent with other required fields (`name`, `code`). On edit load, the select MUST reflect the template's current `supplier_type` from the API response.

#### Scenario: Create form requires supplier type
- **WHEN** an authorized user opens the create standard template form
- **THEN** a "Tipo de proveedor" select is visible with options Persona Natural and Empresa
- **AND** the Guardar button is disabled until name, code, and supplier_type are valid

#### Scenario: Create submits supplier_type
- **WHEN** an authorized user fills name, code, selects supplier_type "Empresa", and saves
- **THEN** the POST payload to `/api/standard-templates` includes `supplier_type: 'empresa'`

#### Scenario: Edit loads and saves supplier_type
- **WHEN** an authorized user opens edit for a template with `supplier_type: 'persona_natural'`
- **THEN** the select shows Persona Natural selected
- **AND** saving sends `supplier_type` in the PUT payload

### Requirement: Standard templates list displays supplier_type

The standard templates list page (`StandardTemplatesListPage.jsx`) SHALL display a sortable column "Tipo de proveedor" showing the supplier type for each template using the existing `SupplierTypeChip` component or equivalent read-only display.

#### Scenario: List column shows supplier type
- **WHEN** an authorized user views the standard templates list
- **THEN** each row displays a chip or label indicating Persona Natural or Empresa from `item.supplier_type`

### Requirement: Standard template view displays supplier_type

The standard template read-only view (`StandardTemplateViewPage.jsx`) SHALL display the template's `supplier_type` in the metadata section.

#### Scenario: View page shows supplier type
- **WHEN** an authorized user opens a template in view mode
- **THEN** the metadata panel shows the supplier type (Persona Natural or Empresa)
