## Why

Tras la limpieza de nodos de navegación obsoletos, quedan etiquetas en inglés o técnicas ("Usuarios plataforma", "Templates estándar") que no coinciden con el lenguaje del producto, y el menú "Sistema" con un solo hijo ("Roles y permisos") añade un nivel innecesario. Además, tests de navegación siguen referenciando códigos eliminados (`NAV_ITEM_INICIO_INSTRUCTIVO`, `NAV_ITEM_INICIO_BANDEJA_TAREAS`), lo que rompe o desactualiza la suite.

## What Changes

- Migración `202605290013_nav_labels_and_restructure.js`: renombrar labels en BD, mover `NAV_ITEM_SISTEMA_ROLES_PERMISOS` bajo `NAV_MENU_ADMIN_GLOBAL` (sort_order 215), eliminar `NAV_MENU_SISTEMA` y sus grants.
- Seed `002_navigation_authorization_seed.js`: sincronizar labels, reordenar definición de Roles y permisos, quitar menú Sistema y grant `NAV_MENU_SISTEMA`.
- Frontend: breadcrumbs y textos visibles "Usuarios plataforma" → "Usuarios", "Templates estándar" / "Nuevo template" → "Plantillas" / "Nueva plantilla" en páginas de usuarios y plantillas estándar (sin tocar Constructor de documento ni mensajes que ya dicen "plantilla").
- Tests: `meNavigationApi.test.js` usa `NAV_ITEM_INICIO_DASHBOARD`; `authorizationSelectors.test.js` usa código ficticio `NAV_ITEM_TEST_NO_ROUTE`.
- **Delta spec** `cleanup-navigation-nodes`: actualizar requisitos que exigen `NAV_MENU_SISTEMA` y labels antiguos.

**Menú resultante (admin plataforma):**
- INICIO → Dashboard
- ADMINISTRACIÓN GLOBAL → Empresas | Roles y permisos | Usuarios | Proveedores
- GESTIÓN DE CONTRATOS → Plantillas | Constructor de documento

**Sin cambio:** códigos de nodo (`NAV_ITEM_*`), rutas URL, módulo Constructor de documento, `DocumentBuilderPage`.

## Capabilities

### New Capabilities

- `nav-labels-and-restructure`: Renombrado de labels de navegación, reubicación de Roles y permisos, eliminación del menú Sistema, alineación seed/migración/frontend/tests.

### Modified Capabilities

- `cleanup-navigation-nodes`: El seed y el sidebar ya no mantienen `NAV_MENU_SISTEMA`; labels de usuarios y plantillas pasan a "Usuarios" y "Plantillas"; Roles y permisos vive bajo Administración global.

## Impact

- **Base de datos**: UPDATE labels; UPDATE parent/sort de un nodo; DELETE menú Sistema.
- **Seeds**: estructura y grants de `002_navigation_authorization_seed.js`.
- **Frontend**: breadcrumbs y aria-labels en ~8 archivos de usuarios/plantillas.
- **Tests**: 2 archivos de test de navegación.
- **API**: sin cambio de endpoints; solo metadatos de navegación en sesión (`/me`).

## Consideraciones de seguridad

- No se alteran grants de acción (`NAV_ACTION_*`); solo visibilidad/organización del árbol y textos.
- Eliminar `NAV_MENU_SISTEMA` requiere borrar grants del menú vacío; el ítem `NAV_ITEM_SISTEMA_ROLES_PERMISOS` conserva su grant existente.
- Migración con `down` vacío: ejecutar en `local`/`dev` antes de `prod`; respaldar BD si aplica.
