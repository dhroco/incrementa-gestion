# dashboard-live-widgets Specification

## Purpose
Live dashboard widgets backed by real PostgreSQL counts for suppliers, contracts, and templates, with CASL-gated visibility per widget.
## Requirements
### Requirement: Dashboard stats endpoint returns live counts

The system SHALL expose `GET /api/dashboard/stats` that returns aggregated counts from PostgreSQL for suppliers, contracts (drafts and signed documents), and active standard templates. All COUNT queries SHALL execute in parallel. Knex COUNT results SHALL be converted to JavaScript numbers before serialization.

#### Scenario: Authenticated user with Dashboard read permission receives stats

- **WHEN** an authenticated user with CASL permission `read` on subject `Dashboard` calls `GET /api/dashboard/stats`
- **THEN** the response status is 200
- **AND** the envelope includes `suppliers.total`, `suppliers.personaNatural`, `suppliers.empresa` as numbers
- **AND** the envelope includes `contracts.draftPending` (draft_document with status `draft`) and `contracts.signedTotal` (document table count) as numbers
- **AND** the envelope includes `templates.activeTotal` (template joined to template_standard with status `active`) as a number
- **AND** the envelope includes `templates.mostRecentName` as the name of the most recently created active standard template, or `null` if none exist

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/dashboard/stats` is made without a valid JWT
- **THEN** the response status is 401 with a structured error in Spanish (es-CL)

#### Scenario: User without Dashboard read permission is forbidden

- **WHEN** an authenticated user without CASL permission `read` on subject `Dashboard` calls `GET /api/dashboard/stats`
- **THEN** the response status is 403 with a structured error in Spanish (es-CL)

#### Scenario: Database failure returns safe error

- **WHEN** a database error occurs while fetching dashboard stats
- **THEN** the response status is 500
- **AND** the error message is in Spanish (es-CL) without exposing internal database details

### Requirement: Placeholder dashboard endpoint remains available

The system SHALL keep `GET /api/placeholder/dashboard` unchanged and operational alongside the new stats endpoint.

#### Scenario: Placeholder endpoint still responds

- **WHEN** an authenticated user with `read Dashboard` calls `GET /api/placeholder/dashboard`
- **THEN** the response status is 200 with the existing hardcoded placeholder payload

### Requirement: Dashboard page displays permission-gated widgets

The dashboard page SHALL replace the placeholder UI with up to three inline widgets (Suppliers, Contracts, Templates). Each widget SHALL render only when the user has the corresponding CASL permission **and** the user's widget preference for that widget is not explicitly `false`. CASL permissions: `read Supplier`, `use DocumentBuilder`, and `read Template` respectively. When `widget_preferences` is null or absent, all three preferences SHALL default to enabled (`true`). Widget visibility SHALL be computed as: `prefs = widgetPreferences ?? { suppliers: true, contracts: true, templates: true }`; `showSuppliers = prefs.suppliers !== false && ability.can('read', 'Supplier')`; `showContracts = prefs.contracts !== false && ability.can('use', 'DocumentBuilder')`; `showTemplates = prefs.templates !== false && ability.can('read', 'Template')`.

#### Scenario: User sees only permitted widgets

- **WHEN** a user opens the dashboard and has `read Supplier` but not `use DocumentBuilder` or `read Template`
- **THEN** only the Suppliers widget is displayed
- **AND** Contracts and Templates widgets are not rendered

#### Scenario: User with no module permissions sees empty state

- **WHEN** a user has `read Dashboard` but lacks all three module permissions
- **THEN** the dashboard shows a friendly empty message indicating no widgets are available for their profile

#### Scenario: User hides widget via preference despite CASL permission

- **WHEN** a user has `read Supplier` and `widget_preferences.suppliers` is `false`
- **THEN** the Suppliers widget is not rendered
- **AND** other widgets with permission and preference not false still render

#### Scenario: Widget preference cannot override missing CASL permission

- **WHEN** a user has `widget_preferences.contracts` set to `true` but lacks `use DocumentBuilder`
- **THEN** the Contracts widget is not rendered

#### Scenario: Null widget preferences show all permitted widgets

- **WHEN** a user has null `widget_preferences` and has all three module CASL permissions
- **THEN** all three widgets are displayed

### Requirement: Suppliers widget shows live metrics and actions

The Suppliers widget SHALL display the total supplier count as the primary metric, a secondary description, a one-line breakdown of persona natural vs empresa counts, and action buttons at the bottom of the card.

#### Scenario: Suppliers widget displays metrics from API

- **WHEN** the Suppliers widget is visible and stats have loaded successfully
- **THEN** the primary number shows `suppliers.total` formatted with es-CL locale
- **AND** the breakdown line shows persona natural and empresa counts

#### Scenario: Create supplier action requires create permission

- **WHEN** the user has `read Supplier` and `create Supplier`
- **THEN** a primary-style action navigates to `/app/proveedores/nuevo`

- **WHEN** the user has `read Supplier` but not `create Supplier`
- **THEN** the create action is not shown
- **AND** the list action navigates to `/app/proveedores`

### Requirement: Contracts widget shows draft and signed counts

The Contracts widget SHALL display draft documents pending signature (`draftPending`) as the primary metric, signed document total as secondary context, and action buttons at the bottom.

#### Scenario: Contracts widget displays metrics from API

- **WHEN** the Contracts widget is visible and stats have loaded successfully
- **THEN** the primary number shows `contracts.draftPending`
- **AND** the breakdown or secondary line references `contracts.signedTotal` signed documents

#### Scenario: Document builder action navigates to constructor

- **WHEN** the user clicks the primary action on the Contracts widget
- **THEN** navigation goes to `/app/gestion-contratos/constructor-documento`

#### Scenario: View contracts action is non-interactive

- **WHEN** the Contracts widget renders the "Ver contratos" control
- **THEN** it is not a navigable link
- **AND** it appears visually disabled with reduced opacity and `cursor: not-allowed`

### Requirement: Templates widget shows active count and most recent name

The Templates widget SHALL display the count of active standard templates as the primary metric and the name of the most recently created active template as secondary context.

#### Scenario: Templates widget displays metrics from API

- **WHEN** the Templates widget is visible and stats have loaded successfully
- **THEN** the primary number shows `templates.activeTotal`
- **AND** the secondary line shows `templates.mostRecentName` or a fallback when null

#### Scenario: Template actions navigate to correct routes

- **WHEN** the user clicks the list action on the Templates widget
- **THEN** navigation goes to `/app/gestion-contratos/templates-estandar`

- **WHEN** the user has `create Template` and clicks create
- **THEN** navigation goes to `/app/gestion-contratos/templates-estandar/nueva`

### Requirement: Dashboard widgets have distinct gradient card styling

Each widget SHALL be rendered as a card with very rounded corners, a gradient background, white text, subtle decorative elements, and action buttons with primary (white background, widget-colored text) and secondary (semi-transparent background, white border) variants. Widget colors SHALL be: Suppliers purple gradient, Contracts orange gradient, Templates dark gold gradient.

#### Scenario: Loading state preserves widget structure

- **WHEN** dashboard stats are loading
- **THEN** each visible widget maintains its card layout and minimum height
- **AND** displays a loading indicator or placeholder within the card without breaking visual structure

### Requirement: Dashboard styles are isolated

Dashboard-specific styles SHALL live in `frontend/src/styles/dashboard.css`. The change SHALL NOT modify `AppRouter.jsx`, `variables.css`, or `global.css`.

#### Scenario: Global styles unchanged

- **WHEN** the dashboard is implemented
- **THEN** `AppRouter.jsx`, `variables.css`, and `global.css` are not modified as part of this change

### Requirement: Dashboard API client fetches stats

The frontend SHALL provide an API helper (e.g. `dashboardApi.js`) that calls `GET /api/dashboard/stats` using the authenticated session token, following existing `apiClient` patterns.

#### Scenario: Successful fetch returns parsed stats

- **WHEN** `fetchDashboardStats` is called with a valid access token
- **THEN** it returns the stats object on success
- **AND** propagates structured errors on failure consistent with other API modules

