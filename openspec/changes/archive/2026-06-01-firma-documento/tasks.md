## 1. Dependencias y configuración



- [x] 1.1 Instalar `pdf-lib` y `resend` en backend (`npm install pdf-lib resend`)

- [x] 1.2 Agregar `RESEND_API_KEY` y `RESEND_FROM_EMAIL` a `backend/SET_VARS_AMBIENTE_LOCAL.cmd` (bloques CMD y PowerShell)

- [x] 1.3 Exponer `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en `backend/config.js`



## 2. Permisos CASL



- [x] 2.1 Backend: agregar acción `sign` a `Contract` y label `sign: 'Firmar'` en `backend/config/permissionsCatalog.js`

- [x] 2.2 Frontend: mismos cambios en `frontend/src/config/permissionsCatalog.js` incluyendo `sign` en `ALL_ACTIONS`



## 3. Backend — emailService



- [x] 3.1 Crear `backend/services/emailService.js` con `sendSignedContractEmail` (Resend + fallback log sin API key)

- [x] 3.2 Agregar test unitario para fallback dev cuando falta `RESEND_API_KEY`



## 4. Backend — contractSigningService



- [x] 4.1 Crear `listPendingSignature({ db })` con JOINs y filtro status NOT IN ('signed', 'rejected')

- [x] 4.2 Implementar `signContract` — validación, carga de entidades, download GCS

- [x] 4.3 Implementar página de firma con pdf-lib (Helvetica, hash SHA-256, timestamp America/Santiago, RUT formateado)

- [x] 4.4 Upload a GCS path `contratos-firmados/...` usando `yearMonthInSantiago()` de documentBuilderService

- [x] 4.5 Transacción: INSERT `document` + UPDATE `draft_document.status = 'signed'`

- [x] 4.6 Envío email post-commit con manejo de error (log, no rollback)

- [x] 4.7 Agregar tests para listPendingSignature y signContract (casos éxito, ya firmado, email fallido)



## 5. Backend — controller y rutas



- [x] 5.1 Crear `backend/controllers/contractSigningController.js` (`getList`, `postSign`)

- [x] 5.2 Registrar en `app.js`: instanciar servicios, `GET /api/contracts/pending-signature` **antes** de `/:id/pdf`, `POST /api/contracts/:id/sign` con `authorize('sign', 'Contract')`

- [x] 5.3 Agregar tests API en `backend/test/contractSigningApi.test.js`



## 6. Frontend — API y navegación



- [x] 6.1 Crear `frontend/src/api/contractSigningApi.js` (`fetchPendingSignature`, `signContract`, reutilizar `fetchDraftPdfBlob`)

- [x] 6.2 Agregar ítem menú `firma_documento` en `menuConfig.js` bajo gestion_contratos

- [x] 6.3 Registrar ruta en `AppRouter.jsx` con `RequireCan I="sign" a="Contract"`



## 7. Frontend — ContractSigningPage



- [x] 7.1 Crear `ContractSigningPage.jsx` con PageShell, tabla de pendientes y estado vacío

- [x] 7.2 Implementar botón "Ver PDF" (fetch blob → object URL → window.open)

- [x] 7.3 Implementar modal de confirmación con checkbox, spinner por fila, toast éxito/error

- [x] 7.4 Aplicar estilos ERP compactos consistentes con ContractsListPage



## 8. MCP



- [x] 8.1 Inyectar `contractSigningService` y `emailService` en `mcp.mjs`

- [x] 8.2 Agregar herramienta `listar_documentos_pendientes_firma` en `mcpTools.mjs`

- [x] 8.3 Agregar herramienta `firmar_contrato_electronico` con `signerUserProfileId` vía MCP_USER_ID

- [x] 8.4 Extender tests MCP para las nuevas herramientas



## 9. Verificación final



- [x] 9.1 Ejecutar suite de tests backend (`npm test`)

- [x] 9.2 Smoke test manual: listar pendientes → ver PDF → firmar → verificar email/log y fila removida

- [x] 9.3 Verificar que consulta de contratos muestra el documento firmado con source `signed`

