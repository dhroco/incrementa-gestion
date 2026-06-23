## ADDED Requirements

### Requirement: Shared form CSS for supplier tabs and blocks

The frontend MUST define CSS classes in `frontend/src/styles/shared-form.css` for supplier (and company-style) form layouts: `.company-form-tabs-layout`, `.company-shell-tabs`, `.company-shell-tabs-bar`, `.company-shell-tab`, `.company-shell-tabs-panel`, `.company-form-page-stack`, `.company-form-block-title`, and `.company-form-block-card` (used with `.clause-card`). Tab styling MUST match the gestion-control reference: selected tab with white background and border merge with panel, unselected tabs in muted gray with hover state.

#### Scenario: Tab bar renders with selected state
- **WHEN** a supplier edit page renders with active tab "Datos básicos"
- **THEN** the selected tab button has `aria-selected="true"` and visually connects to the panel below via shared border styling

#### Scenario: Create page uses stacked blocks
- **WHEN** a user opens supplier create page
- **THEN** the form container uses `.company-form-page-stack` with vertically stacked block cards

### Requirement: Supplier form section components

The frontend MUST export `SupplierBasicDataSection` containing the supplier type selector and all type-dependent fields (persona natural, empresa, representante legal, personería), and `SupplierSocialNetworksSection` containing exclusively the social networks table. Both sections MUST accept the same props currently used by `SupplierFormSections` (form, onChange, readOnly, typeLocked, fieldErrors, social network handlers).

#### Scenario: Basic data section renders type-specific fields
- **WHEN** supplier type is `empresa` in create mode
- **THEN** `SupplierBasicDataSection` shows empresa fields and hides persona natural-only fields

#### Scenario: Social networks section is isolated
- **WHEN** either section is rendered independently
- **THEN** social network rows appear only in `SupplierSocialNetworksSection`

### Requirement: Supplier create page block layout

The supplier create page (`/app/proveedores/nuevo`) MUST render two separate block cards without tabs: (1) title "Datos básicos del proveedor" with `SupplierBasicDataSection`, and (2) title "Redes sociales" with `SupplierSocialNetworksSection`. Each block MUST use `.ph-card.clause-card.company-form-block-card` and `.company-form-block-title`.

#### Scenario: Create form shows two blocks
- **WHEN** an authorized user opens `/app/proveedores/nuevo`
- **THEN** two vertically stacked block cards are visible and no tab bar is shown

### Requirement: Supplier view and edit tab layout

The supplier view page (`/app/proveedores/:id`) and edit page (`/app/proveedores/:id/edit`) MUST render three tabs with ids `datos_basicos`, `redes_sociales`, and `antecedentes` and labels "Datos básicos", "Redes sociales", and "Antecedentes contractuales". Tab 1 MUST contain `SupplierBasicDataSection`, tab 2 MUST contain `SupplierSocialNetworksSection`, tab 3 MUST contain `SupplierDocumentHistoryPanel`. Tab markup MUST use `.company-form-tabs-layout`, `.company-shell-tabs`, `.company-shell-tabs-bar`, `.company-shell-tab` with `role="tab"` and `aria-selected`, and `.company-shell-tabs-panel`.

#### Scenario: View page shows three tabs
- **WHEN** an authorized user opens a supplier detail page
- **THEN** three tabs are visible and the default active tab is "Datos básicos"

#### Scenario: Edit page type locked
- **WHEN** a user edits an existing supplier in tab "Datos básicos"
- **THEN** the supplier type selector remains locked (`typeLocked={true}`)

### Requirement: Validation error tab navigation

When form validation fails on supplier create or edit submit, the UI MUST automatically switch to the first tab containing a field error, following the same pattern as employee forms in gestion-control. Fields in `SupplierBasicDataSection` MUST map to tab `datos_basicos`; `social_networks` errors MUST map to tab `redes_sociales`.

#### Scenario: Social network error switches tab
- **WHEN** a user submits edit form with incomplete social network row
- **THEN** active tab changes to "Redes sociales" and the error is visible

#### Scenario: Basic field error switches tab
- **WHEN** a user submits with invalid RUT in datos básicos
- **THEN** active tab is "Datos básicos"
