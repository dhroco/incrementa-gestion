## Why

El sidebar del administrador de plataforma expone muchas entradas de navegación sin funcionalidad implementada (placeholders o rutas huérfanas), lo que confunde al usuario y aumenta la superficie de mantenimiento en seeds, migraciones e iconografía. Además, "Constructor de documento" ya existe como nodo y módulo funcional, pero `ADMINISTRADOR_PLATAFORMA` no tiene grant — no aparece en el menú pese a ser una capacidad operativa del sistema.

## What Changes

- **BREAKING**: Eliminación de 19 nodos de navegación (16 ítems visibles + 3 nodos de acción de usuarios internos empresa) y sus grants asociados en BD existente.
- Migración `202605290012_cleanup_navigation_nodes.js`: DELETE grants + nodes por lista explícita de códigos (`whereIn`, no ILIKE); INSERT idempotente del grant `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` para `ADMINISTRADOR_PLATAFORMA`.
- Seed `002_navigation_authorization_seed.js`: quitar definiciones y grants de los 19 códigos; agregar `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` al set de grants del admin.
- Frontend: eliminar `ContratosPage.jsx`, rutas `/app/contratos` y `/app/gestion-contratos/contratos-por-empresa` en `AppRouter.jsx`, y limpiar iconografía en `sidebarIconography.jsx` (incl. imports MUI huérfanos y ruta legacy en `ICON_KEY_BY_ROUTE`).
- Actualizar `frontend/eslint.config.js` si referencia `ContratosPage.jsx`.

**Menús padre que permanecen** (solo pierden hijos):
- `NAV_MENU_INICIO` → queda Dashboard
- `NAV_MENU_GESTION_CONTRATOS` → queda Templates estándar + Constructor de documento
- `NAV_MENU_SISTEMA` → queda Roles y permisos

**No se modifica**: módulo Constructor de documento (`DocumentBuilderPage`, services, slice, API), Templates estándar, Empresas, Usuarios plataforma, Proveedores, Roles y permisos.

## Capabilities

### New Capabilities

- `cleanup-navigation-nodes`: El sistema elimina nodos/grants obsoletos de navegación, habilita Constructor de documento para admin de plataforma, y retira código frontend asociado a "Contratos por empresa".

### Modified Capabilities

_(ninguna — cambio acotado a navegación y limpieza de página placeholder; no altera specs de auth, document-builder, empresas ni proveedores)_

## Impact

- **Base de datos**: eliminación de 19 nodos y grants; inserción de 1 grant nuevo para admin.
- **Seeds**: entornos frescos reflejan menú reducido y grant de constructor.
- **Frontend**: sidebar más limpio; desaparece página/ruta de contratos por empresa; posible reducción de imports MUI.
- **API**: sin cambio en endpoints — solo visibilidad de navegación y limpieza de rutas no funcionales.

## Consideraciones de seguridad

- Migración destructiva e irreversible (`down` vacío): ejecutar primero en `local`/`dev`; respaldar BD antes de `migrate:latest` en GCP.
- Uso de `whereIn('code', codesToDelete)` evita borrado accidental de nodos no listados.
- Habilitar Constructor de documento amplía lo visible para admin, pero el módulo ya existía y sus endpoints ya están protegidos por grants de acción existentes — no se amplían permisos de API más allá de la visibilidad en menú.
