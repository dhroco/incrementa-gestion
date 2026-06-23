## 1. Pre-requisito: utilidades de fecha compartidas

- [x] 1.1 Crear `frontend/src/utils/dateUtils.js` con `normalizeIsoDateOrNull` y `formatEsDateFromIso` (copia literal desde `employeeFormUtils.js`)
- [x] 1.2 Actualizar imports en `SupplierUpsertPage.jsx` y `SupplierFormSections.jsx` → `../utils/dateUtils`
- [x] 1.3 Verificar que la app compila sin `employeeFormUtils.js` antes de eliminarlo

## 2. Frontend: eliminar módulo de trabajadores

- [x] 2.1 Eliminar archivos dedicados: `EmployeesListPage.jsx`, `EmployeeViewPage.jsx`, `EmployeeUpsertPage.jsx`, `EmployeeFormSections.jsx`, `useEmployeeCompanyScope.js`, `employeeFormUtils.js`, `employeeFormUtils.test.js`, `employeesApi.js`, `trabajadoresAuth.js`
- [x] 2.2 Editar `AppRouter.jsx`: quitar imports y rutas `/trabajadores/*` y referencias a `trabajadoresAuth`
- [x] 2.3 Editar `sidebarIconography.jsx`: quitar entrada trabajadores y referencias `NAV_ITEM_TRABAJADORES_*`
- [x] 2.4 Editar `002_navigation_authorization_seed.js` (frontend tests/fixtures si aplica): confirmar que no hay referencias residuales en navigation test configs

## 3. Frontend: catálogo de variables

- [x] 3.1 Editar `variableCatalog.js`: reemplazar grupo `trabajador` por grupo `proveedor` con las 7 variables del brief
- [x] 3.2 Editar `VariableCatalog.jsx`: quitar sección trabajador; mantener proveedor y demás grupos
- [x] 3.3 Editar `VariableRenderer.jsx`: quitar resolución `worker_*`; añadir resolución `proveedor_*` desde contexto del slice

## 4. Frontend: Document Builder

- [x] 4.1 Editar `documentBuilderSlice.js`: reemplazar `workersSelected` / acciones worker por `selectedSupplierId` (o equivalente) y actualizar exports
- [x] 4.2 Actualizar `documentBuilderSlice.test.js` y tests relacionados
- [x] 4.3 Editar `DocumentBuilderPage.jsx`: quitar empleados y `useEmployeeCompanyScope` para carga de terceros; añadir selector proveedor vía `fetchSuppliersList` (nombre + RUT + chip tipo); mantener empresa y template
- [x] 4.4 Editar `documentBuilderApi.js` si el body cambia de `employeeIds` a `supplierId`
- [x] 4.5 Actualizar `DocumentBuilderPage.test.jsx` y `DocumentBuilderPreviewPage.test.jsx` según nuevo flujo
- [x] 4.6 Revisar `DocumentBuilderPreviewPage.jsx` por referencias a worker/employee

## 5. Backend: eliminar módulo de empleados

- [x] 5.1 Eliminar `employeeController.js`, `employeeService.js`, `resolveEmployeeCompanyScope.js`, `employeesApi.test.js`, seeds `004_gfa_position_and_schedule_seed.js` y `005_gfa_employee_seed.js`
- [x] 5.2 Editar `app.js`: quitar imports y bloque completo `/api/employees/*`
- [x] 5.3 Editar `002_navigation_authorization_seed.js`: eliminar solo nodos/grants de trabajadores listados en el brief
- [x] 5.4 Eliminar migraciones solo-trabajadores: `202604190001`, `202604221003`, `202604290001` (tras lectura completa)

## 6. Backend: Document Builder y variables

- [x] 6.1 Editar `documentBuilderVariableContext.js`: `buildSubstitutionMap(supplier, company, overrides)` con mapeo `proveedor_*`; mantener `company_*`
- [x] 6.2 Editar `documentBuilderService.js`: aceptar `supplierId`, cargar vía `supplierService.getSupplierById`, persistir `supplier_id` en `generated_document`, quitar queries a `employee`
- [x] 6.3 Editar `documentBuilderController.js` si valida `employeeIds`
- [x] 6.4 Reescribir `documentBuilderVariableContext.test.js` para proveedor
- [x] 6.5 Actualizar `documentBuilderApi.test.js`: quitar casos employee; añadir casos con `supplierId`
- [x] 6.6 Revisar `parseDocumentBuilderRenderEngine.test.js`, `documentBuilderTipTapPdf.test.js` y otros tests por referencias employee

## 7. Base de datos: nuevas migraciones (solo crear archivos)

- [x] 7.1 Crear `202605290006_drop_employee_tables.js`: truncar/limpiar `generated_document`, reemplazar `employee_id` por `supplier_id` FK a `supplier`, DROP `employee`, `position`, `work_schedule`; `down()` recrea estructura desde migraciones enrich
- [x] 7.2 Crear `202605290007_drop_trabajadores_navigation_nodes.js` con patrón exacto del brief (grants + nodos `%TRABAJADOR%` / `%JORNADA%`)
- [x] 7.3 **No ejecutar** `migrate:latest` — dejar para verificación manual

## 8. Verificación final

- [x] 8.1 Grep global en `frontend/src` y `backend` (`.js`/`.jsx`, excl. migraciones históricas): `employee`, `trabajador`, `worker_`, `employeesApi`, `EmployeeViewPage`
- [x] 8.2 Ejecutar `npm test` en backend y frontend
- [ ] 8.3 Smoke manual post-migrate: Document Builder empresa → proveedor → template → generar PDF → descargar
