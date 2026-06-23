## 1. Base de datos — migración

- [x] 1.1 Crear `backend/migrations/202605280001_drop_contador_navigation_nodes.js`: en `up`, obtener IDs de `navigation_node` con `code ILIKE '%CONTADOR%'`, eliminar `profile_navigation_grant` asociados, luego eliminar esos nodos; `down` lanza `Error` (irreversible)
- [x] 1.2 Ejecutar `knex migrate:latest` en entorno local
- [x] 1.3 Verificar con query diagnóstico que no quedan filas en `profile_navigation_grant` / `navigation_node` con código `ILIKE '%CONTADOR%'`

## 2. Seed de navegación

- [x] 2.1 En `backend/seeds/002_navigation_authorization_seed.js`, eliminar de `CODES_IN_SCOPE`: `NAV_ITEM_ADMIN_GLOBAL_CONTADORES`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT`, `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS`
- [x] 2.2 Eliminar mapeo `NAV_ITEM_ADMIN_GLOBAL_CONTADORES` en `ROUTE_PATH_BY_NAV_ITEM_CODE`
- [x] 2.3 Eliminar bloques `upsertNode` de Contadores (ítem + 3 acciones) y de `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS`
- [x] 2.4 Confirmar que no quedan referencias a esos códigos en el seed (sin tocar otras entradas)

## 3. Frontend — sidebar

- [x] 3.1 En `frontend/src/navigation/sidebarIconography.jsx`, eliminar `NAV_ITEM_ADMIN_GLOBAL_CONTADORES: 'badge'` de `ICON_KEY_BY_NAV_CODE`
- [x] 3.2 Eliminar `'/app/admin-global/contadores': 'badge'` de `ICON_KEY_BY_ROUTE`

## 4. Backend — script npm huérfano

- [x] 4.1 Eliminar script `"delete-accountant"` de `backend/package.json`

## 5. Verificación

- [x] 5.1 Login como `admin@incrementa.la` — confirmar que el menú lateral no muestra "Contadores"
- [x] 5.2 Grep en `backend/seeds/002_navigation_authorization_seed.js` y `frontend/src/navigation/sidebarIconography.jsx` — cero referencias a `CONTADORES` / `/app/admin-global/contadores`
