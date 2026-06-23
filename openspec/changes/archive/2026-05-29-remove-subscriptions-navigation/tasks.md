## 1. Base de datos

- [x] 1.1 Crear `backend/migrations/202605290011_drop_suscripciones_navigation_nodes.js`: `up` — SELECT ids WHERE `code ILIKE '%SUSCRIPCIONES%'`, DELETE grants, DELETE nodes; `down` vacío (patrón de `202605290007`)

- [x] 1.2 Ejecutar `knex migrate:latest` en local y verificar ausencia de nodos `ILIKE '%SUSCRIPCIONES%'`

## 2. Seeds

- [x] 2.1 Editar `backend/seeds/002_navigation_authorization_seed.js` (leer completo): eliminar de `CODES_IN_SCOPE` el menú `NAV_MENU_GESTION_SUSCRIPCIONES` y los 3 `NAV_ITEM_SUSCRIPCIONES_*`

- [x] 2.2 Quitar entradas de `ROUTE_PATH_BY_NAV_ITEM_CODE` para los 3 ítems de suscripciones

- [x] 2.3 Eliminar bloques `upsertNode` del menú padre (`menuSuscripcionesId`) y de los 3 hijos (`navTarifasId`, `navSusRenId`, `navFacturacionId`)

- [x] 2.4 Quitar los 4 códigos de suscripciones del array de grants de `ADMINISTRADOR_PLATAFORMA`

## 3. Frontend

- [x] 3.1 Editar `frontend/src/navigation/sidebarIconography.jsx`: eliminar las 3 entradas `NAV_ITEM_SUSCRIPCIONES_*` de `ICON_KEY_BY_NAV_CODE`

- [x] 3.2 Eliminar de `ICONS_BY_NAME` y los imports MUI (`PaymentsOutlinedIcon`, `AutorenewOutlinedIcon`, `ReceiptLongOutlinedIcon`) si quedan sin uso tras el cambio

## 4. Verificación

- [x] 4.1 Grep en `frontend/src` y `backend` (excl. `migrations/` históricas, `node_modules/`) por `SUSCRIPCIONES`, `suscripciones`, `NAV_MENU_GESTION_SUSCRIPCIONES` — limpiar residuos

- [x] 4.2 `npm test` en backend y frontend

- [x] 4.3 Smoke manual: login como admin — sidebar sin "Gestión de suscripciones" ni sub-ítems; resto del menú intacto
