## Why

La pantalla de Proveedores usa hoy un formulario monolítico sin la estructura visual del resto del sistema (cajitas en creación, pestañas en ver/editar) ni visibilidad de los contratos asociados al proveedor. Con las tablas `document` y `draft_document` ya disponibles, es el momento de alinear la UX con el patrón de Trabajador de gestion-control y exponer antecedentes contractuales en la ficha del proveedor.

## What Changes

- Agregar clases CSS de tabs y bloques de formulario a `shared-form.css` (`.company-form-tabs-layout`, `.company-shell-tabs*`, `.company-form-page-stack`, `.company-form-block-card`, `.company-form-block-title`).
- Refactorizar `SupplierFormSections.jsx` en `SupplierBasicDataSection` y `SupplierSocialNetworksSection` reutilizables en ambos layouts.
- Modificar `SupplierUpsertPage.jsx` (modo Crear): dos cajitas verticales — "Datos básicos del proveedor" y "Redes sociales".
- Modificar `SupplierViewPage.jsx` y `SupplierUpsertPage.jsx` (modos Ver y Editar): tres pestañas — Datos básicos, Redes sociales, Antecedentes contractuales.
- Nuevo componente `SupplierDocumentHistoryPanel.jsx` con dos tablas (contratos firmados y contratos en progreso) y botón "Ver" que abre PDF inline en nueva pestaña.
- Nuevo endpoint `GET /api/suppliers/:id/documents` que retorna `signed_documents` y `draft_documents` con JOIN a `template`.
- Ajustar `GET /api/document-builder/downloads/:id` para servir PDF con `Content-Disposition: inline`.
- Nuevo endpoint `GET /api/documents/:id/view` que descarga desde GCS y sirve PDF inline.
- Agregar `fetchSupplierDocuments` en `suppliersApi.js`.
- Navegación automática a la pestaña con error de validación al enviar el formulario (mismo patrón que gestion-control).

## Capabilities

### New Capabilities

- `supplier-form-layout`: Layout de formulario de proveedor con cajitas en creación y pestañas en ver/editar, incluyendo CSS compartido y refactor de secciones del formulario.
- `supplier-contract-history`: Historial contractual del proveedor — API de listado de documentos, endpoints de visualización PDF inline y panel frontend con tablas de contratos firmados y en progreso.

### Modified Capabilities

- `suppliers-admin`: Ampliar requisitos de la ficha de proveedor (UI por secciones/pestañas) y nuevo endpoint de documentos asociados protegido con autorización CASL `read` sobre `Supplier`.

## Impact

- **Frontend**: `shared-form.css`, `SupplierFormSections.jsx`, `SupplierUpsertPage.jsx`, `SupplierViewPage.jsx`, nuevo `SupplierDocumentHistoryPanel.jsx`, `suppliersApi.js`.
- **Backend**: `supplierService.js`, `supplierController.js`, `app.js`; posible nuevo método en `documentBuilderController.js`; nuevo handler para `GET /api/documents/:id/view` (controller + service); uso de `gcsService.downloadBuffer`.
- **Base de datos**: Sin migraciones — consulta sobre tablas `document`, `draft_document` y `template` existentes.
- **Autorización**: Endpoints nuevos y de visualización protegidos con `authorize('read', 'Supplier')`; descarga de borradores mantiene permisos existentes del document builder.
- **Referencia UX**: Patrón alineado a `EmployeeUpsertPage` / `EmployeeContractHistoryPanel` en gestion-control.

## Consideraciones de seguridad

- Los documentos contractuales contienen datos sensibles; solo usuarios con permiso `read` sobre `Supplier` pueden listar y visualizar PDFs asociados a un proveedor.
- La visualización inline debe servir el buffer desde GCS en el servidor (no exponer rutas GCS directas al cliente).
- Validar que el documento pertenece al proveedor solicitado antes de servir el PDF.
- Mensajes de error al usuario en español (es-CL); no filtrar detalles internos de GCS o BD en respuestas 500.
