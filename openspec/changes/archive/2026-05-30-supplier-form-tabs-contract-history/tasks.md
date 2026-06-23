## 1. CSS compartido

- [x] 1.1 Agregar clases de tabs (`.company-form-tabs-layout`, `.company-shell-tabs`, `.company-shell-tabs-bar`, `.company-shell-tab`, `.company-shell-tabs-panel`) al final de `frontend/src/styles/shared-form.css`
- [x] 1.2 Agregar clases de bloques de formulario (`.company-form-page-stack`, `.company-form-block-title`, `.company-form-block-card`) si no existen en `shared-form.css`

## 2. Refactor de secciones del formulario

- [x] 2.1 Extraer `SupplierBasicDataSection` de `SupplierFormSections.jsx` (tipo de proveedor + campos condicionales por tipo)
- [x] 2.2 Extraer `SupplierSocialNetworksSection` (tabla de redes sociales exclusivamente)
- [x] 2.3 Mantener exports existentes (`emptySupplierForm`, `supplierToForm`, validaciones) y composición opcional en `SupplierFormSections`
- [x] 2.4 Agregar `getFirstSupplierFormTabWithErrors(fieldErrors)` mapeando campos básicos → `datos_basicos` y `social_networks` → `redes_sociales`

## 3. Backend — listado de documentos del proveedor

- [x] 3.1 Implementar `listSupplierDocuments(supplierId)` en `supplierService.js` con JOIN a `template` para `signed_documents` y `draft_documents` (status ≠ `signed`), orden DESC por fecha
- [x] 3.2 Agregar handler `getDocuments` en `supplierController.js` (404 si proveedor no existe)
- [x] 3.3 Registrar ruta `GET /api/suppliers/:id/documents` en `app.js` con `authorize('read', 'Supplier')`
- [x] 3.4 Agregar tests en `backend/test/supplierApi.test.js` para listado de documentos (200, 404, 403)

## 4. Backend — visualización PDF inline

- [x] 4.1 Cambiar `Content-Disposition` de `attachment` a `inline` en `documentBuilderController.getDownload`
- [x] 4.2 Implementar servicio + handler `GET /api/documents/:id/view` que lee `document.gcs_path`, descarga vía `gcsService.downloadBuffer` y sirve PDF inline
- [x] 4.3 Registrar ruta en `app.js` con `authorize('read', 'Supplier')`
- [x] 4.4 Agregar tests para view de documento firmado y verificar header inline en download de borrador

## 5. Frontend — API client

- [x] 5.1 Agregar `fetchSupplierDocuments({ id, accessToken, signal })` en `frontend/src/api/suppliersApi.js`

## 6. Frontend — panel de antecedentes contractuales

- [x] 6.1 Crear `SupplierDocumentHistoryPanel.jsx` con fetch condicional por `supplierId`
- [x] 6.2 Implementar tabla "Contratos firmados" con columnas, estados vacío/carga/error y botón "Ver" (fetch blob → object URL → `window.open`)
- [x] 6.3 Implementar tabla "Contratos en progreso" con labels de estado legibles y botón "Ver" apuntando al endpoint de borradores
- [x] 6.4 Formatear fechas con `formatEsDateFromIso` (es-CL)

## 7. Frontend — páginas de proveedor

- [x] 7.1 Modificar `SupplierUpsertPage.jsx` modo create: dos cajitas con `SupplierBasicDataSection` y `SupplierSocialNetworksSection`
- [x] 7.2 Modificar `SupplierUpsertPage.jsx` modo edit: tres tabs inline con `SUPPLIER_TABS`, incluyendo `SupplierDocumentHistoryPanel` en tab antecedentes
- [x] 7.3 Modificar `SupplierViewPage.jsx`: tres tabs en solo lectura con mismo layout
- [x] 7.4 Integrar navegación automática a tab con error en submit (create y edit) usando `getFirstSupplierFormTabWithErrors`
- [x] 7.5 Verificar que `typeLocked={true}` se mantiene en modo edición

## 8. Verificación

- [x] 8.1 Probar flujo crear proveedor: validación, cajitas, guardado exitoso
- [x] 8.2 Probar flujo editar: tabs, error en tab oculta navega correctamente, tipo bloqueado
- [x] 8.3 Probar vista detalle: tabs read-only y carga de antecedentes contractuales
- [x] 8.4 Probar botón "Ver" abre PDF inline en nueva pestaña (firmado y borrador)
- [x] 8.5 Ejecutar tests backend relevantes (`supplierApi.test.js`, `documentBuilderApi.test.js`)
