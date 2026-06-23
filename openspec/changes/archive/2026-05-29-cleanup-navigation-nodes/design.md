## Context

La navegación se define en `navigation_node` y `profile_navigation_grant`, sembrados por `backend/seeds/002_navigation_authorization_seed.js`. El perfil `ADMINISTRADOR_PLATAFORMA` tiene grants para muchos ítems cuyas rutas son placeholders (`ModulePlaceholderPage`) o no tienen implementación. El nodo `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` existe y el módulo Document Builder está implementado, pero el admin no tiene grant sobre ese nodo.

"Contratos por empresa" (`NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA`) es el único ítem eliminado con código frontend real: `ContratosPage.jsx` y rutas en `AppRouter.jsx`.

Cambios previos similares (`remove-subscriptions-navigation`, `drop-company-templates-module`) usaron migraciones Knex con DELETE grants + DELETE nodes. Este cambio usa lista explícita de códigos (`whereIn`) en lugar de ILIKE, por precisión.

Restricciones:
- No modificar migraciones históricas; solo agregar `202605290012`.
- No tocar el módulo Constructor de documento (páginas, services, API).
- Mantener menús padre `NAV_MENU_INICIO`, `NAV_MENU_GESTION_CONTRATOS`, `NAV_MENU_SISTEMA`.
- `NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES` permanece en seed (sin grant admin hoy) — fuera de alcance.

## Goals / Non-Goals

**Goals:**
- Eliminar 19 nodos de navegación obsoletos y sus grants en BD existente.
- Conceder `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` a `ADMINISTRADOR_PLATAFORMA`.
- Sincronizar seed `002_navigation_authorization_seed.js` con la migración.
- Eliminar `ContratosPage.jsx`, rutas asociadas y referencias en eslint.
- Limpiar `sidebarIconography.jsx` (mapeos, ruta legacy, imports MUI huérfanos).

**Non-Goals:**
- Implementar funcionalidad de los ítems eliminados.
- Modificar Document Builder, Templates estándar, Empresas, Proveedores ni Roles.
- Eliminar `NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES` (no está en la lista de borrado).
- Cambiar grants de otros perfiles (solo admin platform en seed scope).

## Decisions

### 1. Migración con lista explícita de códigos + grant idempotente

**Migración** `202605290012_cleanup_navigation_nodes.js` en una transacción:

**Bloque A — eliminar nodos:**
```javascript
const codesToDelete = [
  'NAV_ITEM_INICIO_BANDEJA_TAREAS',
  'NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS',
  'NAV_ITEM_INICIO_INSTRUCTIVO',
  'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT',
  'NAV_ITEM_CONTRATOS_CAUSALES_LEGALES',
  'NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR',
  'NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA',
  'NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS',
  'NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS',
  'NAV_ITEM_CONTRATOS_REPORTES',
  'NAV_ITEM_CONTRATOS_EXPORTACION',
  'NAV_ITEM_CONTRATOS_IMPORTACION',
  'NAV_ITEM_SISTEMA_PARAMETROS',
  'NAV_ITEM_SISTEMA_AUDITORIA',
  'NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA',
  'NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS',
];
```
DELETE grants → DELETE nodes. `down`: vacío.

**Bloque B — grant constructor:**
Lookup `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` + `ADMINISTRADOR_PLATAFORMA`; INSERT grant si no existe.

**Alternativa descartada**: ILIKE — riesgo de borrar nodos no deseados; el usuario exige `whereIn`.

### 2. Limpieza del seed en bloques

En `002_navigation_authorization_seed.js`:

1. Quitar los 19 códigos de `CODES_IN_SCOPE`.
2. Quitar entradas correspondientes de `ROUTE_PATH_BY_NAV_ITEM_CODE`.
3. Eliminar bloques `upsertNode` de cada nodo (inicio ×3, usuarios internos ×4, contratos ×8, sistema ×4).
4. En `adminAllowed` Set: quitar códigos eliminados; agregar `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO`.

**Grants finales esperados para admin** (ítems de negocio visibles):
- Inicio: `NAV_MENU_INICIO`, `NAV_ITEM_INICIO_DASHBOARD`
- Admin global: empresas, usuarios plataforma, proveedores (+ acciones)
- Contratos: `NAV_MENU_GESTION_CONTRATOS`, plantillas (+ acciones), constructor documento
- Sistema: `NAV_MENU_SISTEMA`, `NAV_ITEM_SISTEMA_ROLES_PERMISOS`
- Legacy compat codes (sin cambio)

### 3. Frontend: ContratosPage y AppRouter

- Eliminar `frontend/src/pages/ContratosPage.jsx`.
- En `AppRouter.jsx`: quitar import, rutas `contratos` y `gestion-contratos/contratos-por-empresa`, y `'gestion-contratos/contratos-por-empresa'` del Set `exclude`.
- En `eslint.config.js`: quitar `ContratosPage.jsx` del override de hooks (dejar solo `DashboardPage.jsx` o eliminar el bloque si queda vacío).

**Alternativa descartada**: mantener ruta legacy `/app/contratos` — el nodo ya no existirá en navegación.

### 4. Frontend: sidebarIconography

Quitar de `ICON_KEY_BY_NAV_CODE` las entradas cuyos códigos están en `codesToDelete` (solo NAV_ITEM_*, no NAV_ACTION_*).

Quitar de `ICON_KEY_BY_ROUTE`: `/app/admin-global/usuarios-internos-empresa`.

Eliminar de `ICONS_BY_NAME` e imports MUI solo si ningún nodo restante los referencia. Candidatos a remover tras limpieza:
- `inbox`, `menu_book`, `groups`, `balance`, `folder`, `upload_file`, `download`, `upload`, `fact_check`, `delete_forever`, `tune`

Conservar iconos aún usados por nodos legacy o sobrevivientes (`notifications`, `article`, `analytics`, `settings`, `build`, etc.).

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Grants residuales en prod | Migración 012 + seed sincronizado |
| Borrado accidental por patrón amplio | `whereIn('code', codesToDelete)` exacto |
| Imports MUI rotos | Verificar uso en nodos restantes antes de borrar |
| Usuario con bookmark a `/app/gestion-contratos/contratos-por-empresa` | Ruta eliminada; 404 o redirect — aceptable (placeholder) |
| `NAV_ITEM_CONTRATOS_TIPOS_DOCUMENTALES` sin grant | Fuera de alcance; nodo permanece oculto para admin |

## Migration Plan

1. Desplegar backend (migración + seed) y frontend (router + iconografía).
2. Ejecutar `knex migrate:latest` (012).
3. Verificar login admin: menú Inicio solo Dashboard; Contratos con Templates + Constructor; Sistema solo Roles; sin ítems eliminados.
4. Rollback: `down` vacío — re-seed manual en dev si necesario.

## Open Questions

_(ninguna — alcance definido por el usuario)_
