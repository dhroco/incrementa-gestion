## 1. Lectura previa

- [x] 1.1 Leer `backend/seeds/002_navigation_authorization_seed.js` completo
- [x] 1.2 Leer `backend/test/meNavigationApi.test.js`
- [x] 1.3 Leer `frontend/src/navigation/authorizationSelectors.test.js`
- [x] 1.4 Leer `frontend/src/pages/PlatformUsersListPage.jsx`, `StandardTemplatesListPage.jsx`, `StandardTemplateEditor.jsx`

## 2. Base de datos

- [x] 2.1 Crear `backend/migrations/202605290013_nav_labels_and_restructure.js`: UPDATE labels Usuarios y Plantillas; mover `NAV_ITEM_SISTEMA_ROLES_PERMISOS` (parent Admin Global, sort 215); DELETE grants y nodo `NAV_MENU_SISTEMA`; `down` vacío
- [x] 2.2 Ejecutar `knex migrate:latest` en local y verificar labels, parent/sort y ausencia de `NAV_MENU_SISTEMA`

## 3. Seeds

- [x] 3.1 Quitar `NAV_MENU_SISTEMA` de `CODES_IN_SCOPE` y eliminar variable `menuSistemaId` / bloque menú Sistema
- [x] 3.2 Renombrar labels: `NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA` y acciones → `Usuarios` / `Usuarios (Lectura|Crear|Editar)`
- [x] 3.3 Renombrar labels: `NAV_ITEM_CONTRATOS_PLANTILLAS` y acciones → `Plantillas` / `Plantillas (Lectura|Crear|Editar)`
- [x] 3.4 Mover definición `NAV_ITEM_SISTEMA_ROLES_PERMISOS` al bloque Admin Global (después Empresas, antes Usuarios), `parent_id: menuAdminGlobalId`, `sort_order: 215`
- [x] 3.5 Actualizar `adminAllowed`: quitar `NAV_MENU_SISTEMA`; mantener `NAV_ITEM_SISTEMA_ROLES_PERMISOS`

## 4. Frontend — textos visibles

- [x] 4.1 Breadcrumbs `Usuarios` en `PlatformUserCreatePage`, `PlatformUserViewPage`, `PlatformUserEditPage`
- [x] 4.2 `PlatformUsersListPage`: `ariaLabel` y mensaje empty state sin "plataforma"
- [x] 4.3 Breadcrumb `Plantillas` en `StandardTemplateViewPage` y `StandardTemplateEditor` (create: `Nueva plantilla`)
- [x] 4.4 `StandardTemplatesListPage`: botón `Nueva plantilla`
- [x] 4.5 Confirmar que `DocumentBuilderPage` y mensajes lowercase "plantilla" no se modifican

## 5. Tests

- [x] 5.1 `meNavigationApi.test.js`: reemplazar `NAV_ITEM_INICIO_INSTRUCTIVO` por `NAV_ITEM_INICIO_DASHBOARD` y ajustar assertions
- [x] 5.2 `authorizationSelectors.test.js`: usar `NAV_ITEM_TEST_NO_ROUTE` en lugar de `NAV_ITEM_INICIO_BANDEJA_TAREAS`

## 6. Verificación

- [x] 6.1 `npm test` en backend (`meNavigationApi`) y frontend (`authorizationSelectors`)
- [x] 6.2 Grep: sin `Usuarios plataforma` / `Templates estándar` en breadcrumbs objetivo; sin `NAV_MENU_SISTEMA` en seed
- [x] 6.3 Smoke manual: sidebar admin con estructura Inicio → Dashboard; Admin global → Empresas | Roles y permisos | Usuarios | Proveedores; Gestión contratos → Plantillas | Constructor de documento
