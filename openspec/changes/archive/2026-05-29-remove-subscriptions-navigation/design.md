## Context

La navegación del sistema se define en `navigation_node` y `profile_navigation_grant`, sembrados por `backend/seeds/002_navigation_authorization_seed.js`. El menú "Gestión de suscripciones" (`NAV_MENU_GESTION_SUSCRIPCIONES`) tiene 3 hijos con rutas placeholder bajo `/app/suscripciones/*`, pero no existen páginas, API ni tablas asociadas. El frontend solo mapea iconos en `sidebarIconography.jsx`.

Cambios previos similares (contadores, trabajadores, templates por empresa) usaron migraciones Knex con patrón ILIKE + DELETE grants + DELETE nodes.

Restricciones del cambio:
- No modificar migraciones históricas; solo agregar `202605290011`.
- No tocar `AppRouter.jsx`, controllers ni services.
- Mantener intactos empresas, contratos, proveedores, admin global y sistema.

## Goals / Non-Goals

**Goals:**
- Eliminar menú "Gestión de suscripciones" y sus 3 sub-ítems del sidebar para `ADMINISTRADOR_PLATAFORMA`.
- Limpiar seed y migración para que BD y re-seeds no recreen los nodos.
- Quitar iconografía frontend y imports MUI huérfanos.
- Cero referencias vivas a `SUSCRIPCIONES` en código (salvo migraciones históricas si las hubiera).

**Non-Goals:**
- Implementar funcionalidad de suscripciones.
- Eliminar rutas placeholder de `ModulePlaceholderPage` (no están registradas en AppRouter).
- Modificar otros menús o grants.

## Decisions

### 1. Una migración de navegación (patrón ILIKE)

**Migración** `202605290011_drop_suscripciones_navigation_nodes.js`:
- `up`: SELECT ids FROM `navigation_node` WHERE `code ILIKE '%SUSCRIPCIONES%'` → DELETE grants → DELETE nodes.
- `down`: vacío (irreversible), igual que `202605290007` y `202605290009`.

**Alternativa descartada**: DELETE solo los 3 ítems hijos — el menú padre `NAV_MENU_GESTION_SUSCRIPCIONES` también debe eliminarse.

### 2. Limpieza del seed en bloques

En `002_navigation_authorization_seed.js`, eliminar en orden:
1. `NAV_MENU_GESTION_SUSCRIPCIONES` y 3 `NAV_ITEM_SUSCRIPCIONES_*` de `CODES_IN_SCOPE`.
2. Entradas en `ROUTE_PATH_BY_NAV_ITEM_CODE`.
3. Bloque `upsertNode` del menú padre (`menuSuscripcionesId`).
4. Bloques `upsertNode` de los 3 hijos (`navTarifasId`, `navSusRenId`, `navFacturacionId`).
5. Los 4 códigos del array de grants de `ADMINISTRADOR_PLATAFORMA` (menú + 3 ítems).

**Alternativa descartada**: dejar nodos en seed pero ocultos — recrearían el menú en re-seeds.

### 3. Frontend: solo sidebarIconography

- Quitar 3 entradas de `ICON_KEY_BY_NAV_CODE`.
- Si `payments`, `autorenew`, `receipt_long` quedan solo referenciados por suscripciones, eliminar también de `ICONS_BY_NAME` y los imports MUI correspondientes.

**Alternativa descartada**: tocar `AppRouter` — el usuario lo excluyó explícitamente.

### 4. Archivos colaterales

Grep post-cambio por `SUSCRIPCIONES`, `suscripciones`, `NAV_MENU_GESTION_SUSCRIPCIONES`. No hay tests que referencien suscripciones hoy.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Grants residuales en prod | Migración 011 + limpieza seed |
| Eliminar nodos de otro módulo por ILIKE demasiado amplio | Patrón acotado a `SUSCRIPCIONES` (único uso en el repo) |
| Imports MUI rotos | Verificar que payments/autorenew/receipt_long no se usen en otro nodo antes de borrar |

## Migration Plan

1. Desplegar backend + frontend con seed e iconografía limpios.
2. Ejecutar `knex migrate:latest` (011).
3. Verificar: login como admin — sidebar sin "Gestión de suscripciones".
4. Rollback: `down` vacío — no restauración de datos; re-seed manual si necesario en dev.

## Open Questions

_(ninguna — alcance definido por el usuario)_
