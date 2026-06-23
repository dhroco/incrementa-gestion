## 1. Base de datos

- [x] 1.1 Crear `backend/migrations/202606010005_add_contract_overrides.js`: `contract_overrides` JSONB nullable en `draft_document` y `document`; `client_id` nullable FK → `client` en `document`; índices GIN; `down` revierte columnas
- [x] 1.2 Ejecutar `npm run migrate:latest` en backend y verificar columnas e índices

## 2. Backend — permisos y persistencia en generación

- [x] 2.1 Editar `backend/config/permissionsCatalog.js`: subject `Contract` con label `Consulta de contratos` y action `read` (después de `DocumentBuilder`)
- [x] 2.2 Editar `backend/services/documentBuilderService.js`: en INSERT de `draft_document`, agregar `contract_overrides` con overrides pre-procesados (`preprocessMissingFieldOverrides`)

## 3. Backend — servicio de consulta

- [x] 3.1 Crear `backend/services/contractsQueryService.js`: `listContracts({ page, pageSize, filters })` con UNION ALL draft+signed, filtros (supplierSearch, clientId, templateId, redSocialSearch, status), exclusión de `rejected`, paginación offset/limit, mapeo de items con `contract_overrides ?? {}`
- [x] 3.2 Crear `backend/services/contractsPdfService.js` (o métodos en query service): `getContractPdf({ id, source })` — carga fila, `gcsService.downloadBuffer`, retorna `{ file_name, buffer }`
- [x] 3.3 Crear `backend/controllers/contractsController.js`: `getList`, `getPdf` (patrón `supplierController.getDocumentView`)

## 4. Backend — rutas y wiring

- [x] 4.1 Editar `backend/app.js`: instanciar servicios/controller; rutas `GET /api/contracts` y `GET /api/contracts/:id/pdf` con `authorize('read', 'Contract')`

## 5. Backend — tests

- [x] 5.1 Crear `backend/test/contractsQueryService.test.js`: filtros, paginación, exclusión rejected, mapeo overrides null
- [x] 5.2 Crear `backend/test/contractsApi.test.js`: list 200/403, PDF draft/signed 200/404/400, validación `source`
- [x] 5.3 Actualizar tests de `documentBuilderService` si el INSERT incluye `contract_overrides`

## 6. Frontend — API

- [x] 6.1 Crear `frontend/src/api/contractsApi.js`: `fetchContracts({ page, filters, accessToken })`, `fetchContractPdfBlob({ id, source, accessToken })`

## 7. Frontend — página y navegación

- [x] 7.1 Crear `frontend/src/pages/ContractsListPage.jsx`: barra de filtros (debounce 300ms en texto), selects cliente/plantilla/estado, tabla según columnas del brief, badges estado, paginación 18/página, PDF vía blob URL (patrón `SupplierDocumentHistoryPanel`)
- [x] 7.2 Editar `frontend/src/navigation/menuConfig.js`: ítem `consulta_contratos` bajo `gestion_contratos` (`NAV_ITEM_CONTRATOS_CONSULTA`, check `Contract`)
- [x] 7.3 Editar `frontend/src/routes/AppRouter.jsx`: ruta `gestion-contratos/consulta-contratos` con `RequireCan I="read" a="Contract"`
- [x] 7.4 Editar `frontend/src/navigation/sidebarIconography.jsx`: ícono para `NAV_ITEM_CONTRATOS_CONSULTA`

## 8. Verificación

- [x] 8.1 Smoke manual: generar contrato → aparece en consulta con overrides → filtros y paginación → abrir PDF
- [x] 8.2 Verificar contratos pre-migración listan con "—" en campos override sin error
- [x] 8.3 `npm test` en backend; `npm run build` en frontend sin errores
