## 1. Lectura previa (no modificar aún)

- [x] 1.1 Leer `backend/seeds/002_navigation_authorization_seed.js` completo: nodos, `ROUTE_PATH_BY_NAV_ITEM_CODE`, `adminAllowed`, upserts
- [x] 1.2 Leer `frontend/src/routes/AppRouter.jsx`: rutas de ContratosPage y exclude set
- [x] 1.3 Leer `frontend/src/navigation/sidebarIconography.jsx`: mapeos por código y ruta

## 2. Base de datos

- [x] 2.1 Crear `backend/migrations/202605290012_cleanup_navigation_nodes.js`:
  - `up` en transacción: `whereIn('code', codesToDelete)` → DELETE grants → DELETE nodes (19 códigos exactos del diseño)
  - Luego: INSERT idempotente grant `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO` para `ADMINISTRADOR_PLATAFORMA`
  - `down` vacío (patrón `202605290011`)

- [x] 2.2 Ejecutar `knex migrate:latest` en local y verificar ausencia de los 19 códigos en `navigation_node`

- [x] 2.3 Verificar grant constructor existe para admin en `profile_navigation_grant`

## 3. Seeds

- [x] 3.1 Editar `backend/seeds/002_navigation_authorization_seed.js`: eliminar los 19 códigos de `CODES_IN_SCOPE`

- [x] 3.2 Quitar entradas de `ROUTE_PATH_BY_NAV_ITEM_CODE` para nodos eliminados

- [x] 3.3 Eliminar bloques `upsertNode` de los 19 nodos (inicio ×3, usuarios internos item + 3 acciones, contratos ×8, sistema ×4)

- [x] 3.4 Actualizar `adminAllowed`: quitar códigos eliminados; agregar `NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO`

- [x] 3.5 Grep en seed: confirmar que ninguno de los 19 códigos aparece en definiciones ni grants

## 4. Frontend — Contratos por empresa

- [x] 4.1 Eliminar `frontend/src/pages/ContratosPage.jsx`

- [x] 4.2 Editar `frontend/src/routes/AppRouter.jsx`: quitar import `ContratosPage`, rutas `contratos` y `gestion-contratos/contratos-por-empresa`, y entrada en Set `exclude`

- [x] 4.3 Editar `frontend/eslint.config.js`: quitar referencia a `ContratosPage.jsx` en override de hooks

## 5. Frontend — Iconografía sidebar

- [x] 5.1 Editar `frontend/src/navigation/sidebarIconography.jsx`: eliminar entradas `ICON_KEY_BY_NAV_CODE` para los `NAV_ITEM_*` eliminados

- [x] 5.2 Quitar `/app/admin-global/usuarios-internos-empresa` de `ICON_KEY_BY_ROUTE`

- [x] 5.3 Eliminar de `ICONS_BY_NAME` e imports MUI huérfanos (verificar que ningún nodo restante los use): candidatos `inbox`, `menu_book`, `groups`, `balance`, `folder`, `upload_file`, `download`, `upload`, `fact_check`, `delete_forever`, `tune`

## 6. Verificación

- [x] 6.1 Grep en `frontend/src` y `backend` (excl. migraciones históricas) por códigos eliminados y `ContratosPage` — limpiar residuos

- [x] 6.2 `npm test` en backend y frontend

- [x] 6.3 Smoke manual: login como admin — Inicio solo Dashboard; Contratos con Templates + Constructor; Sistema solo Roles; sin ítems eliminados
