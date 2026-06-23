## Context

Tras `drop-contador-empresa-profiles` (migración `202605260002_drop_contador_empresa_profiles.js`), los perfiles `CONTADOR` y `USUARIO_EMPRESA_ADMINISTRADOR` fueron eliminados. La FK `profile_navigation_grant.profile_id → profile.id` con `ON DELETE CASCADE` eliminó grants **solo** de esos perfiles borrados.

Los grants otorgados a `ADMINISTRADOR_PLATAFORMA` sobre nodos de Contadores **permanecieron**, porque el perfil admin no fue eliminado. El diseño original del cambio 7 dejó explícitamente la limpieza de nodos como "opcional futura"; este change la ejecuta.

Diagnóstico confirmado en BD:

```sql
SELECT nn.code, nn.label, p.code as profile
FROM profile_navigation_grant png
JOIN navigation_node nn ON nn.id = png.navigation_node_id
JOIN profile p ON p.id = png.profile_id
WHERE nn.code ILIKE '%CONTADOR%'
```

Retorna 4 filas activas para `ADMINISTRADOR_PLATAFORMA`:
- `NAV_ITEM_ADMIN_GLOBAL_CONTADORES`
- `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ`
- `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE`
- `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT`

Artefactos de código residuales:
- `backend/seeds/002_navigation_authorization_seed.js` — aún define e inserta nodos/grants de Contadores y `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS`
- `frontend/src/navigation/sidebarIconography.jsx` — mapeos para `NAV_ITEM_ADMIN_GLOBAL_CONTADORES` y ruta `/app/admin-global/contadores`
- `backend/package.json` — script `delete-accountant` apunta a `scripts/delete-accountant-user.js` (eliminado en cambio 7)

**Restricción explícita:** no editar migraciones históricas; solo agregar nueva migración timestamped.

## Goals / Non-Goals

**Goals:**

- Eliminar de BD todos los grants y nodos de navegación cuyo código contenga `CONTADOR`.
- Limpiar seed, sidebar iconography y script npm huérfano para que entornos frescos y código fuente no recreen la entrada de menú.
- Verificar que `admin@incrementa.la` no ve "Contadores" en el sidebar tras login.

**Non-Goals:**

- Eliminar nodos de `USUARIOS_INTERNOS_EMPRESA` (fuera de alcance de este fix; otro residual posible).
- Modificar migraciones existentes (p. ej. `202604250004_admin_global_submenu_order.js`).
- Cambiar grants, rutas o menú de otras funcionalidades (Empresas, Usuarios plataforma, etc.) excepto `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS`.
- Revertir la migración (`down` lanza error — irreversible).

## Decisions

### 1. Nueva migración con filtro `ILIKE '%CONTADOR%'`

**Decisión:** Crear `backend/migrations/202605280001_drop_contador_navigation_nodes.js` cuyo `up`:

1. Obtiene IDs de `navigation_node` donde `code ILIKE '%CONTADOR%'`.
2. `DELETE FROM profile_navigation_grant WHERE navigation_node_id IN (...)`.
3. `DELETE FROM navigation_node WHERE code ILIKE '%CONTADOR%'`.

**Rationale:** El filtro por código captura el ítem y sus acciones hijas (`NAV_*CONTADORES_*`) y también `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS` si aplica. Eliminar grants antes que nodos respeta FK `profile_navigation_grant.navigation_node_id → navigation_node.id` (`ON DELETE CASCADE` haría lo mismo, pero el orden explícito es más claro).

**Alternativa descartada:** Borrar solo por lista hardcodeada de 4 códigos — menos robusto si existen nodos adicionales con `CONTADOR` en el código.

### 2. `down` irreversible

**Decisión:** `exports.down` lanza `Error('Irreversible migration: drop_contador_navigation_nodes')`.

**Rationale:** Alineado con migración destructiva del cambio 7; recrear nodos/grants no es objetivo.

### 3. Limpieza quirúrgica del seed

**Decisión:** En `002_navigation_authorization_seed.js`, eliminar únicamente:

- Entradas en `CODES_IN_SCOPE` para Contadores y `ASSIGN_ACCOUNTANTS`
- Mapeo en `ROUTE_PATH_BY_NAV_ITEM_CODE`
- Bloques `upsertNode` de Contadores y `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS`
- Grants asociados en la sección de inserción de grants (si existen referencias explícitas)

No tocar nodos de `USUARIOS_INTERNOS_EMPRESA` ni otros módulos.

### 4. Sidebar: dos líneas en iconography

**Decisión:** Eliminar `NAV_ITEM_ADMIN_GLOBAL_CONTADORES: 'badge'` en `ICON_KEY_BY_NAV_CODE` y `'/app/admin-global/contadores': 'badge'` en el mapa de rutas (si existe mapa separado por path).

### 5. Script npm huérfano

**Decisión:** Eliminar la entrada `"delete-accountant"` de `scripts` en `backend/package.json`. Mantener `delete-app-user` u otros scripts operativos.

## Risks / Trade-offs

- **[Riesgo] Filtro `ILIKE '%CONTADOR%'` demasiado amplio** → Mitigación: en el esquema actual solo existen nodos de Contadores con ese patrón; verificar con query de diagnóstico antes/después de migrar.
- **[Riesgo] Seed idempotente recrea nodos en entornos que no migraron** → Mitigación: limpiar seed + ejecutar migración en todos los entornos.
- **[Riesgo] Entornos con datos custom en nodos CONTADOR** → Mitigación: funcionalidad de Contadores ya eliminada; datos huérfanos no tienen uso.

## Migration Plan

1. Crear migración `202605280001_drop_contador_navigation_nodes.js`.
2. Ejecutar `knex migrate:latest` en local.
3. Verificar query de diagnóstico retorna 0 filas.
4. Limpiar seed, sidebar y package.json.
5. Login como `admin@incrementa.la` — confirmar ausencia de "Contadores" en sidebar.
6. Desplegar a dev/prod con backup previo de BD.

**Rollback:** no hay rollback de datos; restaurar desde backup si fuera necesario.

## Open Questions

Ninguna — alcance y criterio de éxito están definidos por el usuario.
