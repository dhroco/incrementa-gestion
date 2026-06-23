# cleanup-navigation-nodes Specification

## Purpose
TBD - created by archiving change cleanup-navigation-nodes. Update Purpose after archive.
## Requirements
### Requirement: Migration removes obsolete navigation nodes by explicit code list

The backend SHALL include Knex migration `202605290012_cleanup_navigation_nodes.js` whose `up` function, in a single transaction: (1) selects `navigation_node` rows where `code` is in the explicit list of 19 codes to delete, (2) deletes matching rows from `profile_navigation_grant`, (3) deletes those nodes from `navigation_node`. The migration SHALL use `whereIn('code', codesToDelete)` and SHALL NOT use ILIKE. The `down` function MAY be empty (irreversible).

The 19 codes to delete SHALL be exactly:
`NAV_ITEM_INICIO_BANDEJA_TAREAS`, `NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS`, `NAV_ITEM_INICIO_INSTRUCTIVO`, `NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA`, `NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ`, `NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE`, `NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT`, `NAV_ITEM_CONTRATOS_CAUSALES_LEGALES`, `NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR`, `NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA`, `NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS`, `NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS`, `NAV_ITEM_CONTRATOS_REPORTES`, `NAV_ITEM_CONTRATOS_EXPORTACION`, `NAV_ITEM_CONTRATOS_IMPORTACION`, `NAV_ITEM_SISTEMA_PARAMETROS`, `NAV_ITEM_SISTEMA_AUDITORIA`, `NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA`, `NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS`.

#### Scenario: Migration applies cleanly

- **WHEN** `knex migrate:latest` runs against a database that had the obsolete navigation nodes
- **THEN** the migration completes without error
- **AND** no row in `navigation_node` has a code from the deletion list

#### Scenario: Grants for deleted nodes removed

- **WHEN** querying `profile_navigation_grant` joined to `navigation_node` where `navigation_node.code` is in the deletion list
- **THEN** zero rows are returned

### Requirement: Migration grants Constructor de documento to platform admin

In the same migration `202605290012_cleanup_navigation_nodes.js`, after deleting obsolete nodes, the `up` function SHALL insert a row into `profile_navigation_grant` linking profile `ADMINISTRADOR_PLATAFORMA` to node `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` if that grant does not already exist (idempotent).

#### Scenario: Platform admin gains constructor navigation grant

- **WHEN** the migration runs and both `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` and `ADMINISTRADOR_PLATAFORMA` exist
- **THEN** exactly one grant exists for that profile-node pair
- **AND** re-running the migration logic does not create duplicate grants

### Requirement: Navigation seed excludes deleted nodes and includes constructor grant

After this change, `backend/seeds/002_navigation_authorization_seed.js` SHALL NOT define, upsert, or grant any of the 19 deleted codes. It SHALL grant `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` to `ADMINISTRADOR_PLATAFORMA` alongside existing surviving grants (Dashboard, Empresas, Usuarios, Proveedores, Plantillas and actions, Roles y permisos). Parent menus `NAV_MENU_INICIO` and `NAV_MENU_GESTION_CONTRATOS` SHALL remain. `NAV_MENU_SISTEMA` SHALL NOT exist; `NAV_ITEM_SISTEMA_ROLES_PERMISOS` SHALL be a child of `NAV_MENU_ADMIN_GLOBAL`.

#### Scenario: Fresh seed does not recreate deleted nodes

- **WHEN** `knex seed:run` executes after migrations on a clean database
- **THEN** `navigation_node` contains no row with any of the 19 deleted codes
- **AND** `profile_navigation_grant` for `ADMINISTRADOR_PLATAFORMA` includes `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO`

#### Scenario: Parent menus retained with reduced children

- **WHEN** reading navigation nodes after seed
- **THEN** `NAV_MENU_INICIO` and `NAV_MENU_GESTION_CONTRATOS` exist
- **AND** `NAV_MENU_SISTEMA` does not exist
- **AND** deleted child codes are absent

### Requirement: Frontend removes Contratos por empresa page and routes

The frontend SHALL delete `frontend/src/pages/ContratosPage.jsx`. `frontend/src/routes/AppRouter.jsx` SHALL NOT import or route to `ContratosPage`. Routes `/app/contratos` and `/app/gestion-contratos/contratos-por-empresa` SHALL be removed. `frontend/eslint.config.js` SHALL NOT reference `ContratosPage.jsx`.

#### Scenario: No ContratosPage in router

- **WHEN** reading `AppRouter.jsx`
- **THEN** the strings `ContratosPage`, `contratos-por-empresa`, and path `contratos` (legacy route) are absent from route definitions and imports

### Requirement: Sidebar iconography excludes deleted navigation items

`frontend/src/navigation/sidebarIconography.jsx` SHALL NOT map icon keys for deleted `NAV_ITEM_*` codes listed in the migration. The route fallback `/app/admin-global/usuarios-internos-empresa` SHALL be removed from `ICON_KEY_BY_ROUTE`. Unused MUI icon imports introduced solely for deleted items SHALL be removed.

#### Scenario: No deleted item icon mappings in source

- **WHEN** reading `sidebarIconography.jsx`
- **THEN** none of the deleted `NAV_ITEM_*` codes appear in `ICON_KEY_BY_NAV_CODE`
- **AND** `usuarios-internos-empresa` is absent from `ICON_KEY_BY_ROUTE`

### Requirement: Platform admin sidebar reflects cleaned navigation tree

After migration and code cleanup, a user with profile `ADMINISTRADOR_PLATAFORMA` SHALL see: under Inicio only Dashboard; under Administración global Empresas, Roles y permisos, Usuarios, and Proveedores; under Gestión de contratos Plantillas and Constructor de documento. The admin SHALL NOT see any of the 16 removed visible menu items or a top-level Sistema menu.

#### Scenario: Admin login shows Constructor de documento

- **WHEN** a platform admin user logs in and the sidebar renders
- **THEN** a menu entry for "Constructor de documento" is visible under Gestión de contratos

#### Scenario: Admin login hides removed items

- **WHEN** a platform admin user logs in and the sidebar renders
- **THEN** no visible entries exist for Bandeja de tareas, Alertas vencimientos, Instructivo, Usuarios internos empresa, Causales legales, Contratos estándar, Contratos por empresa, Repositorio de documentos, Contratos antiguos, Reportes, Exportación, Importación, Parámetros del sistema, Auditoría, Eliminación controlada, or Configuración alertas

#### Scenario: Roles y permisos under Administración global

- **WHEN** a platform admin user logs in and the sidebar renders
- **THEN** "Roles y permisos" appears under Administración global between Empresas and Usuarios
- **AND** no "Sistema" menu group is visible

