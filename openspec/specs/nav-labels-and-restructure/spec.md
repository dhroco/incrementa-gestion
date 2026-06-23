# nav-labels-and-restructure Specification

## Purpose
TBD - created by archiving change nav-labels-and-restructure. Update Purpose after archive.
## Requirements
### Requirement: Migration renames navigation labels and restructures admin menu

The backend SHALL include Knex migration `202605290013_nav_labels_and_restructure.js` whose `up` function, in order: (1) sets `label` and `module_title` to `Usuarios` for `NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA`, (2) sets `label` and `module_title` to `Plantillas` for `NAV_ITEM_CONTRATOS_PLANTILLAS`, (3) sets `parent_id` to `NAV_MENU_ADMIN_GLOBAL` and `sort_order` to `215` for `NAV_ITEM_SISTEMA_ROLES_PERMISOS`, (4) deletes `profile_navigation_grant` rows for `NAV_MENU_SISTEMA` then deletes the `NAV_MENU_SISTEMA` node. The `down` function MAY be empty.

#### Scenario: Labels updated in database

- **WHEN** the migration runs
- **THEN** `navigation_node` where `code` is `NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA` has `label` and `module_title` equal to `Usuarios`
- **AND** `navigation_node` where `code` is `NAV_ITEM_CONTRATOS_PLANTILLAS` has `label` and `module_title` equal to `Plantillas`

#### Scenario: Roles y permisos under Administración global

- **WHEN** the migration runs
- **THEN** `NAV_ITEM_SISTEMA_ROLES_PERMISOS` has `parent_id` pointing to `NAV_MENU_ADMIN_GLOBAL`
- **AND** `sort_order` is `215`

#### Scenario: Sistema menu removed

- **WHEN** the migration runs
- **THEN** no row exists in `navigation_node` with `code` `NAV_MENU_SISTEMA`
- **AND** no `profile_navigation_grant` references the deleted menu node id

### Requirement: Navigation seed matches migration labels and tree

`backend/seeds/002_navigation_authorization_seed.js` SHALL define `NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA` and its action children with labels using `Usuarios` (not `Usuarios plataforma`). It SHALL define `NAV_ITEM_CONTRATOS_PLANTILLAS` and its action children with labels using `Plantillas` (not `Templates estándar`). It SHALL define `NAV_ITEM_SISTEMA_ROLES_PERMISOS` with `parent_id` of Admin Global menu, `sort_order` `215`, placed in the Admin Global block after Empresas and before Usuarios. It SHALL NOT define or grant `NAV_MENU_SISTEMA`. Grants for `ADMINISTRADOR_PLATAFORMA` SHALL include `NAV_ITEM_SISTEMA_ROLES_PERMISOS` and SHALL NOT include `NAV_MENU_SISTEMA`.

#### Scenario: Fresh seed produces expected admin sidebar labels

- **WHEN** `knex seed:run` runs after migrations on a clean database
- **THEN** navigation labels for usuarios and plantillas items match `Usuarios` and `Plantillas`
- **AND** `NAV_MENU_SISTEMA` is absent
- **AND** Roles y permisos is a child of Admin Global with sort_order 215

### Requirement: Frontend breadcrumbs and visible copy use new Spanish labels

Platform user pages (`PlatformUserCreatePage`, `PlatformUserViewPage`, `PlatformUserEditPage`, `PlatformUsersListPage`) SHALL display breadcrumb label `Usuarios` and list copy `Buscar usuarios` / `No hay usuarios registrados.` Standard template pages (`StandardTemplateViewPage`, `StandardTemplateEditor`, `StandardTemplatesListPage`) SHALL use breadcrumb `Plantillas`, create breadcrumb `Nueva plantilla`, and list button `Nueva plantilla`. These pages SHALL NOT change routes or success/empty messages that already use lowercase `plantilla`.

#### Scenario: Platform users breadcrumb

- **WHEN** reading platform user create/view/edit page source
- **THEN** breadcrumb label is `Usuarios` linking to the users list path
- **AND** the string `Usuarios plataforma` is absent from breadcrumbs

#### Scenario: Standard templates breadcrumb and create label

- **WHEN** reading standard template editor and list page source
- **THEN** list breadcrumb uses `Plantillas`
- **AND** create mode uses `Nueva plantilla`
- **AND** the string `Templates estándar` is absent from those breadcrumbs

### Requirement: Navigation tests use current or synthetic node codes

`backend/test/meNavigationApi.test.js` SHALL NOT reference `NAV_ITEM_INICIO_INSTRUCTIVO`; it SHALL use `NAV_ITEM_INICIO_DASHBOARD` (or another code present in the current seed) with assertions updated accordingly. `frontend/src/navigation/authorizationSelectors.test.js` SHALL use synthetic code `NAV_ITEM_TEST_NO_ROUTE` for items with `routePath: null` instead of deleted `NAV_ITEM_INICIO_BANDEJA_TAREAS`.

#### Scenario: Backend navigation API test passes

- **WHEN** `npm test` runs `meNavigationApi.test.js`
- **THEN** all tests pass without referencing deleted navigation codes

#### Scenario: Frontend selector test uses synthetic code

- **WHEN** reading the sidebar null-route test in `authorizationSelectors.test.js`
- **THEN** the child item code is `NAV_ITEM_TEST_NO_ROUTE`
- **AND** `NAV_ITEM_INICIO_BANDEJA_TAREAS` is not used
