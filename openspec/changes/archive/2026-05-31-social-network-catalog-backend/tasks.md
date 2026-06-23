## 1. Migración de base de datos

- [x] 1.1 Crear `backend/migrations/202605300021_social_network_catalog.js`: tabla `social_network_catalog`, seed de 8 registros, truncate `supplier_social_network`, columna `catalog_id` FK, eliminar `network_name`
- [x] 1.2 Implementar `down` que revierta FK, restaure `network_name`, elimine `catalog_id` y tabla catálogo
- [x] 1.3 Ejecutar migración en entorno local y verificar esquema y seed del catálogo

## 2. Servicio supplierService

- [x] 2.1 Actualizar `validateSocialNetworks` para aceptar `catalog_id` + `account_name` (async: validar IDs contra catálogo)
- [x] 2.2 Refactorizar queries (`loadSocialNetworksBySupplierIds`, `getSupplierById`) con JOIN a `social_network_catalog`
- [x] 2.3 Actualizar `mapSocialNetworkRow` para retornar `catalog_id`, `code`, `name`, `account_name`, `sort_order`
- [x] 2.4 Actualizar `insertSocialNetworks` para persistir `catalog_id` en lugar de `network_name`
- [x] 2.5 Implementar y exportar `listSocialNetworkCatalog()` ordenado por `sort_order`
- [x] 2.6 Ajustar create/update para usar validación async de redes sociales

## 3. Controlador y rutas

- [x] 3.1 Añadir handler `getSocialNetworkCatalog` en `supplierController.js`
- [x] 3.2 Registrar `GET /api/social-networks/catalog` con `authorize('read', 'Supplier')` en `app.js`

## 4. Tests

- [x] 4.1 Actualizar tests en `backend/test/supplierApi.test.js`: payload con `catalog_id`, respuestas con `code`/`name`, rechazo de `catalog_id` inválido
- [x] 4.2 Añadir tests para `GET /api/social-networks/catalog` (200 autorizado, 403 sin permiso, items ordenados)
- [x] 4.3 Ejecutar suite de tests backend afectada y corregir regresiones
