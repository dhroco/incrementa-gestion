## MODIFIED Requirements

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
