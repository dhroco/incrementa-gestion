## ADDED Requirements

### Requirement: Migration removes contador navigation nodes and all grants

The backend SHALL include a new Knex migration (timestamped `202605280001_drop_contador_navigation_nodes.js`) whose `up` function executes in order: (1) identify `navigation_node` rows where `code ILIKE '%CONTADOR%'`, (2) `DELETE FROM profile_navigation_grant WHERE navigation_node_id IN (...)` for those node IDs, (3) `DELETE FROM navigation_node WHERE code ILIKE '%CONTADOR%'`. The migration SHALL NOT modify any existing migration files. The `down` function SHALL throw an error documenting irreversibility.

#### Scenario: Migration applies cleanly on Postgres

- **WHEN** `knex migrate:latest` runs against the target database
- **THEN** the migration completes without error
- **AND** no row in `navigation_node` has a code matching `ILIKE '%CONTADOR%'`

#### Scenario: Admin grants for contador nodes removed

- **WHEN** the diagnostic query joins `profile_navigation_grant`, `navigation_node`, and `profile` filtering `nn.code ILIKE '%CONTADOR%'`
- **THEN** zero rows are returned

### Requirement: Navigation seed excludes contador nodes and assign-accountants action

After this change, `backend/seeds/002_navigation_authorization_seed.js` SHALL NOT define, upsert, or grant navigation nodes with codes `NAV_ITEM_ADMIN_GLOBAL_CONTADORES`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT`, or `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS`. Other seed entries SHALL remain unchanged.

#### Scenario: Fresh seed does not recreate contador menu

- **WHEN** `knex seed:run` executes after migrations on a database without contador navigation nodes
- **THEN** `navigation_node` contains no row with code matching `ILIKE '%CONTADOR%'`
- **AND** `profile_navigation_grant` contains no grant for `ADMINISTRADOR_PLATAFORMA` on contador-related nodes

### Requirement: Sidebar iconography excludes contadores

`frontend/src/navigation/sidebarIconography.jsx` SHALL NOT map icon or route keys for `NAV_ITEM_ADMIN_GLOBAL_CONTADORES` or path `/app/admin-global/contadores`. Other sidebar mappings SHALL remain unchanged.

#### Scenario: No contadores icon mapping in source

- **WHEN** reading `sidebarIconography.jsx`
- **THEN** the strings `NAV_ITEM_ADMIN_GLOBAL_CONTADORES` and `/app/admin-global/contadores` are absent

### Requirement: Orphan delete-accountant npm script removed

`backend/package.json` SHALL NOT define a `delete-accountant` script referencing `scripts/delete-accountant-user.js`.

#### Scenario: Package scripts omit delete-accountant

- **WHEN** reading `backend/package.json` scripts section
- **THEN** no script named `delete-accountant` exists

### Requirement: Platform admin sidebar omits Contadores entry

After migration and code cleanup, a user with profile `ADMINISTRADOR_PLATAFORMA` (e.g. `admin@incrementa.la`) SHALL NOT see a sidebar menu item labeled "Contadores" when the navigation tree is loaded from the backend session/navigation API.

#### Scenario: Admin login hides Contadores menu item

- **WHEN** `admin@incrementa.la` logs in with valid credentials and the sidebar renders
- **THEN** no visible menu entry has label "Contadores"
