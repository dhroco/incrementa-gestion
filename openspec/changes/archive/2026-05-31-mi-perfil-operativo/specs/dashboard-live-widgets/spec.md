## MODIFIED Requirements

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
