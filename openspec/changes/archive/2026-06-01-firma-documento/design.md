## Context

Incrementa-gestion genera contratos como borradores (`draft_document`) con PDF en GCS bajo `contratos/...`. La consulta de contratos (`contracts-query`) ya unifica borradores y firmados en lectura, pero no existe flujo de firma. La tabla `document` almacena contratos firmados con campos `signed_at`, `signed_by`, y `contract_overrides`. El stack usa Express + CASL, `gcsService` para upload/download, y Resend como nuevo proveedor de email.

Estados de borrador relevantes: cualquier status excepto `signed` y `rejected` se considera pendiente de firma.

## Goals / Non-Goals

**Goals:**

- Pantalla ERP compacta **Firma de documento** con tabla, vista PDF y modal de confirmación con checkbox obligatorio.
- API `GET /api/contracts/pending-signature` y `POST /api/contracts/:id/sign` protegidas por `authorize('sign', 'Contract')`.
- Firma electrónica simple: página adicional al PDF con pdf-lib, hash SHA-256 del original, timestamp `America/Santiago`.
- Persistir PDF firmado en GCS (`contratos-firmados/...`), insertar `document`, actualizar `draft_document.status = 'signed'`.
- Email al correo de la empresa vía Resend; fallback a log en consola si falta API key.
- Herramientas MCP para listar pendientes y firmar (con confirmación explícita del usuario).
- Permiso CASL `sign` en catálogo backend y frontend.

**Non-Goals:**

- Firma avanzada (certificado digital, HSM, integración con terceros de firma legal).
- Eliminar borrador o PDF original al firmar.
- Rollback de firma si falla el email.
- Migración/seed de permisos `sign` para roles existentes (admin con `manage/all` ya tiene acceso).
- Notificación al proveedor o cliente — solo email a la empresa.

## Decisions

### 1. Servicios separados: `contractSigningService` y `emailService`

**Decisión:** `emailService.js` encapsula Resend; `contractSigningService.js` orquesta listado, firma, GCS, transacción DB y delega email.

**Rationale:** Aísla dependencia externa, permite fallback dev sin afectar lógica de firma, y facilita tests con mock de email.

**Alternativa descartada:** Email inline en signing service — acopla Resend y dificulta reutilización.

### 2. Firma simple con pdf-lib — página append-only

**Decisión:** `PDFDocument.load(originalBuffer)` → `addPage()` → texto con Helvetica/HelveticaBold → `save()`. Hash SHA-256 del buffer **original** (pre-firma) con `crypto.createHash`.

**Rationale:** Cumple requisito legal mínimo (Ley 19.799) sin modificar contenido contractual. pdf-lib es CommonJS-compatible.

**Alternativa descartada:** Firmar con iText/PDFKit sobre el mismo archivo — mayor complejidad; append es explícito en el brief.

### 3. Ruta GCS firmados separada

**Decisión:** `contratos-firmados/{company_id}/{supplier_id}/{template_code}/{year}/{month}/{docId}_firmado.pdf` usando `yearMonthInSantiago()` exportado de `documentBuilderService`.

**Rationale:** Preserva PDF original intacto; patrón consistente con generación.

### 4. Transacción DB + email post-commit

**Decisión:** INSERT `document` + UPDATE `draft_document` en transacción Knex. Email **después** del commit; error de email solo se loguea.

**Rationale:** Evita estado inconsistente (firmado en GCS pero DB sin registrar). El brief exige no revertir firma por fallo de email.

### 5. Orden de rutas en app.js

**Decisión:** Registrar `GET /api/contracts/pending-signature` **antes** de `GET /api/contracts/:id/pdf`.

**Rationale:** Express captura `:id = 'pending-signature'` si el orden es incorrecto.

### 6. Resend en desarrollo

**Decisión:** `RESEND_FROM_EMAIL=onboarding@resend.dev` hasta verificar dominio `incrementa.la`. Si `RESEND_API_KEY` ausente, loguear payload en consola.

**Rationale:** Permite desarrollo local sin cuenta Resend productiva.

### 7. Frontend — reutilizar patrón Consulta contratos

**Decisión:** `ContractSigningPage` sigue layout de `ContractsListPage`: `PageShell`, tabla compacta, `fetchDraftPdfBlob` vía API existente, modal con checkbox.

**Rationale:** Consistencia ERP; menos código nuevo.

### 8. MCP signer = MCP_SERVICE profile

**Decisión:** `firmar_contrato_electronico` usa `getUserProfileIdByUserId(MCP_USER_ID)` como `signerUserProfileId`.

**Rationale:** Auditoría consistente con otras herramientas MCP.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Email no entregado tras firma exitosa | Log de error; contrato queda firmado; operador puede reenviar manualmente (fuera de alcance) |
| Dominio Resend no verificado en prod | Documentar verificación en panel Resend antes de deploy prod |
| Usuario firma sin revisar PDF | Checkbox obligatorio + copy explícito en modal |
| Race: dos firmas simultáneas del mismo borrador | Validar status en transacción; segundo intento recibe error |
| `signed_by` es TEXT no FK | Alineado con schema existente; almacena `full_name` del firmante |

## Migration Plan

1. `npm install pdf-lib resend` en backend.
2. Agregar vars Resend a `SET_VARS_AMBIENTE_LOCAL.cmd` y `config.js`.
3. Desplegar backend con nuevos endpoints.
4. Desplegar frontend con menú y página.
5. Verificar dominio Resend en producción y actualizar `RESEND_FROM_EMAIL`.
6. Asignar permiso `sign`/`Contract` a roles operativos vía admin de roles (manual).

**Rollback:** Desactivar rutas/menú; borradores firmados permanecen válidos; no hay migración DB destructiva.

## Open Questions

- Ninguna bloqueante — especificación del usuario es completa.
