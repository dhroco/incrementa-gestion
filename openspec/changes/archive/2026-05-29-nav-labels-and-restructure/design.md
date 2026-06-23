## Context

El árbol de navegación en PostgreSQL (`navigation_node`, `profile_navigation_grant`) alimenta el sidebar vía `/me`. El seed `002_navigation_authorization_seed.js` es la fuente de verdad para entornos frescos; las migraciones actualizan BD existente. Tras `cleanup-navigation-nodes`, el menú "Sistema" solo contiene "Roles y permisos" (sort 630), mientras Administración global agrupa Empresas (210), Usuarios plataforma (220) y Proveedores (245).

Los breadcrumbs del frontend duplican labels hardcodeados que deben alinearse con `label`/`module_title` de BD, no con los códigos `NAV_*` (que no cambian).

## Goals / Non-Goals

**Goals:**

- Renombrar en BD y seed: "Usuarios plataforma" → "Usuarios"; "Templates estándar" → "Plantillas" (incl. action labels hijos).
- Mover `NAV_ITEM_SISTEMA_ROLES_PERMISOS` a `NAV_MENU_ADMIN_GLOBAL`, `sort_order` 215 (entre Empresas y Usuarios).
- Eliminar `NAV_MENU_SISTEMA` y grants asociados al menú.
- Actualizar textos visibles en páginas de usuarios/plantillas y limpiar tests con códigos eliminados.
- Sidebar admin: Inicio (Dashboard); Admin global (Empresas, Roles y permisos, Usuarios, Proveedores); Gestión contratos (Plantillas, Constructor).

**Non-Goals:**

- Renombrar códigos `NAV_ITEM_*` o rutas (`/app/admin-global/usuarios-plataforma`, etc.).
- Modificar `DocumentBuilderPage`, APIs, grants de acción distintos de visibilidad del menú padre.
- Cambiar mensajes de empty state que ya usan "plantilla/s" en minúscula.
- Implementar `down()` reversible en la migración.

## Decisions

### 1. Migración dedicada `202605290013`

**Decisión:** Una migración con UPDATEs de label, UPDATE de parent/sort, DELETE de menú Sistema (grants primero).

**Alternativa:** Extender `202605290012` — rechazada porque ya puede estar aplicada en entornos.

**Orden en `up`:** (a) labels usuarios, (b) labels plantillas, (c) mover roles, (d) borrar Sistema.

### 2. Conservar código `NAV_ITEM_SISTEMA_ROLES_PERMISOS`

**Decisión:** Solo `parent_id` y `sort_order`; ruta `/app/sistema/roles-y-permisos` sin cambio.

**Rationale:** Evita refactor de grants, rutas React y checks backend que referencian el código.

### 3. sort_order 215 para Roles y permisos

**Decisión:** 215 entre Empresas (210) y Usuarios (220).

**Alternativa:** Reordenar Usuarios/Proveedores — fuera de alcance.

### 4. Seed: definición física del nodo en bloque Admin Global

**Decisión:** Tras Empresas y acciones, insertar nodo Roles; luego Usuarios y Proveedores. Quitar `menuSistemaId`, `NAV_MENU_SISTEMA` de `CODES_IN_SCOPE` y del `Set` de grants.

### 5. Tests: códigos válidos vs ficticios

**Decisión:** `meNavigationApi` → `NAV_ITEM_INICIO_DASHBOARD` (existe en seed). `authorizationSelectors` → `NAV_ITEM_TEST_NO_ROUTE` (aislado del catálogo real).

## Risks / Trade-offs

- **[Riesgo] BD y seed desincronizados** → Mitigación: misma migración + actualización explícita del seed en el mismo cambio.
- **[Riesgo] Breadcrumbs desalineados del sidebar** → Mitigación: lista cerrada de archivos frontend del PASO 4.
- **[Riesgo] Spec `cleanup-navigation-nodes` obsoleto** → Mitigación: delta spec MODIFIED/REMOVED en este change.
- **[Trade-off] `down` vacío** → Rollback manual si hiciera falta en prod.

## Migration Plan

1. Desplegar backend con migración `202605290013`.
2. `knex migrate:latest` en local → dev → prod (backup previo en GCP).
3. `knex seed:run` opcional en dev para validar idempotencia del seed (upsert por code).
4. Desplegar frontend con breadcrumbs actualizados.
5. Ejecutar `npm test` en backend (`meNavigationApi`) y frontend (`authorizationSelectors`).

## Open Questions

_(ninguna — alcance definido por el usuario)_
