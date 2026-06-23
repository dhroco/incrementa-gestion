## 1. Base de datos

- [x] 1.1 Crear `backend/migrations/202606010002_create_client_tables.js`: tablas `client` y `client_product_campaign` (UUID PK, FKs, índice en `client_product_campaign.client_id`); `down` elimina tablas en orden correcto
- [x] 1.2 Crear `backend/migrations/202606010003_add_client_to_draft_document.js`: columna `client_id` nullable FK → `client.id` ON DELETE SET NULL + índice; `down` elimina columna e índice
- [x] 1.3 Ejecutar `npm run migrate:latest` en backend y verificar tablas + columna `draft_document.client_id`

## 2. Backend — permisos y servicio

- [x] 2.1 Editar `backend/config/permissionsCatalog.js`: agregar subject `Client` con label `Clientes` y actions `read`, `create`, `update` después de `Supplier`
- [x] 2.2 Crear `backend/services/clientService.js`: `listClients({ search })`, `getClientById(id)`, `createClient`, `updateClient` con transacciones, ILIKE en name/brand, replace-all de `product_campaigns`, auditoría `created_by`/`updated_by`
- [x] 2.3 Crear `backend/controllers/clientsController.js` (patrón `supplierController.js`): `getList`, `getDetail`, `postCreate`, `putUpdate`

## 3. Backend — rutas y document builder

- [x] 3.1 Editar `backend/app.js`: instanciar `clientService` y `clientsController`; rutas `GET/POST /api/clients`, `GET/PUT /api/clients/:id` con `authorize('read'|'create'|'update', 'Client')`
- [x] 3.2 Editar `backend/services/documentBuilderVariableContext.js`: firma `buildSubstitutionMap(supplier, company, client, overrides)` y claves `client_name`, `client_brand`, `client_brand_account`
- [x] 3.3 Editar `backend/services/documentBuilderService.js`: `generateAndPersist` acepta `clientId` opcional, carga cliente, pasa a `buildSubstitutionMap`, persiste `client_id` en INSERT; actualizar todas las llamadas a `buildSubstitutionMap` con `null` donde no aplique; NO incluir `client_id` en `findActiveDuplicateDraft`
- [x] 3.4 Actualizar `backend/test/documentBuilderVariableContext.test.js` y tests de document builder/MCP según nuevos parámetros

## 4. Backend — tests API clientes

- [x] 4.1 Crear `backend/test/clientApi.test.js`: list con búsqueda, create/update con campañas, replace-all en update, 403 sin permiso, 404 inexistente

## 5. MCP

- [x] 5.1 Editar `backend/mcp.mjs`: instanciar e inyectar `clientService` en `registerMcpTools`
- [x] 5.2 Editar `backend/mcpTools.mjs`: agregar `clientService` a `deps`; herramienta `listar_clientes`; extender `contractParams` con `clientId` opcional en `validar_contrato` y `generar_contrato`
- [x] 5.3 Actualizar `backend/test/mcpServer.test.js` para `listar_clientes` y `clientId` en contrato
- [x] 5.4 Documentar reinicio de Claude Desktop tras cambios MCP

## 6. Frontend — API y catálogo

- [x] 6.1 Crear `frontend/src/api/clientsApi.js` (patrón `suppliersApi.js`)
- [x] 6.2 Editar `frontend/src/data/variableCatalog.js`: grupo `client` con `client_name`, `client_brand`, `client_brand_account`

## 7. Frontend — páginas y navegación

- [x] 7.1 Crear `ClientListPage.jsx`, `ClientViewPage.jsx`, `ClientUpsertPage.jsx` (patrón Proveedores: tabs, tabla editable de campañas, mismas clases CSS)
- [x] 7.2 Editar `frontend/src/navigation/menuConfig.js`: ítem Clientes después de Proveedores (`/app/admin-global/clientes`, `NAV_ITEM_ADMIN_GLOBAL_CLIENTES`, check `Client`)
- [x] 7.3 Editar `frontend/src/routes/AppRouter.jsx`: rutas listado/nuevo/:id/edit con `RequireCan` (patrón Proveedores)
- [x] 7.4 Editar `frontend/src/navigation/sidebarIconography.jsx`: ícono para `NAV_ITEM_ADMIN_GLOBAL_CLIENTES` si aplica

## 8. Frontend — Constructor de documento

- [x] 8.1 Editar `DocumentBuilderPage.jsx`: paso opcional de cliente tras proveedor (`stage1Ok`), selector vía `fetchClientsList`, enviar `clientId` en `postDocumentBuilderGenerate`
- [x] 8.2 Agregar `selectedClientId` al slice Redux de documentBuilder (o state local consistente con proveedor); limpiar selección al cambiar proveedor si aplica

## 9. Verificación

- [x] 9.1 Smoke manual: CRUD cliente con campañas → Constructor de documento con y sin cliente → variables en PDF
- [x] 9.2 `npm test` en backend; `npm run build` en frontend sin errores
- [x] 9.3 MCP: `listar_clientes` y `generar_contrato` con `clientId` opcional
