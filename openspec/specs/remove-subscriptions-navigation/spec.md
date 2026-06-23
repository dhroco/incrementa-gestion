# remove-subscriptions-navigation Specification

## Purpose
TBD - created by archiving change remove-subscriptions-navigation. Update Purpose after archive.
## Requirements
### Requirement: Migration removes suscripciones navigation nodes and grants

The backend SHALL include Knex migration `202605290011_drop_suscripciones_navigation_nodes.js` whose `up` function: (1) selects `navigation_node` rows where `code ILIKE '%SUSCRIPCIONES%'`, (2) deletes matching rows from `profile_navigation_grant`, (3) deletes those nodes from `navigation_node`. The migration SHALL NOT modify existing migration files. The `down` function MAY be empty (irreversible).

#### Scenario: Migration applies cleanly

- **WHEN** `knex migrate:latest` runs against a database that had suscripciones navigation nodes
- **THEN** the migration completes without error
- **AND** no row in `navigation_node` has a code matching `ILIKE '%SUSCRIPCIONES%'`

#### Scenario: Grants for suscripciones nodes removed

- **WHEN** querying `profile_navigation_grant` joined to `navigation_node` where `navigation_node.code ILIKE '%SUSCRIPCIONES%'`
- **THEN** zero rows are returned

### Requirement: Navigation seed excludes suscripciones menu and items

After this change, `backend/seeds/002_navigation_authorization_seed.js` SHALL NOT define, upsert, or grant navigation nodes with codes `NAV_MENU_GESTION_SUSCRIPCIONES`, `NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES`, `NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION`, or `NAV_ITEM_SUSCRIPCIONES_FACTURACION`. Other seed entries SHALL remain unchanged.

#### Scenario: Fresh seed does not recreate suscripciones menu

- **WHEN** `knex seed:run` executes after migrations on a database without suscripciones navigation nodes
- **THEN** `navigation_node` contains no row with code matching `ILIKE '%SUSCRIPCIONES%'`
- **AND** `profile_navigation_grant` for `ADMINISTRADOR_PLATAFORMA` contains no grant on suscripciones-related nodes

### Requirement: Sidebar iconography excludes suscripciones items

`frontend/src/navigation/sidebarIconography.jsx` SHALL NOT map icon keys for `NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES`, `NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION`, or `NAV_ITEM_SUSCRIPCIONES_FACTURACION`. Unused MUI icon imports introduced solely for suscripciones SHALL be removed.

#### Scenario: No suscripciones icon mappings in source

- **WHEN** reading `sidebarIconography.jsx`
- **THEN** the strings `NAV_ITEM_SUSCRIPCIONES_TARIFAS_PLANES`, `NAV_ITEM_SUSCRIPCIONES_SUSCRIPCION_RENOVACION`, and `NAV_ITEM_SUSCRIPCIONES_FACTURACION` are absent from `ICON_KEY_BY_NAV_CODE`

### Requirement: Platform admin sidebar omits Gestión de suscripciones

After migration and code cleanup, a user with profile `ADMINISTRADOR_PLATAFORMA` SHALL NOT see a sidebar menu section labeled "Gestión de suscripciones" nor its child items when the navigation tree is loaded from the backend.

#### Scenario: Admin login hides suscripciones menu

- **WHEN** a platform admin user logs in with valid credentials and the sidebar renders
- **THEN** no visible menu entry has label "Gestión de suscripciones"
- **AND** no child items for Tarifas y planes, Suscripción / renovación, or Facturación appear under suscripciones

