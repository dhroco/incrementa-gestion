## Why

Los contratos generados quedan como borradores en GCS hasta que un representante legal los firma electrónicamente. Hoy no existe pantalla ni API dedicada para listar pendientes de firma, aplicar firma simple conforme a la Ley N° 19.799, persistir el PDF firmado y notificar a la empresa. Este flujo cierra el ciclo entre generación y archivo de contratos firmados.

## What Changes

- Nueva pantalla **Firma de documento** bajo Gestión de Contratos: tabla de borradores pendientes, vista previa PDF y modal de confirmación con checkbox de autorización.
- Nuevo permiso CASL `sign` sobre subject `Contract` (backend y frontend).
- Nuevos endpoints REST:
  - `GET /api/contracts/pending-signature` — lista borradores no firmados ni rechazados
  - `POST /api/contracts/:id/sign` — firma electrónica simple, persiste documento y envía email
- Nuevo `emailService.js` con Resend (fallback a log en consola si falta `RESEND_API_KEY`).
- Nuevo `contractSigningService.js`: lista pendientes, agrega página de firma con pdf-lib, sube a GCS, inserta en `document`, actualiza `draft_document.status = 'signed'`.
- Variables de entorno `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en config local y `backend/config.js`.
- Dependencias npm: `pdf-lib`, `resend`.
- Dos herramientas MCP: `listar_documentos_pendientes_firma` y `firmar_contrato_electronico`.
- El borrador original y su PDF en GCS permanecen intactos; el firmado va a ruta `contratos-firmados/...`.
- Si el envío de email falla, la firma **no** se revierte (solo se loguea el error).

## Capabilities

### New Capabilities

- `contract-signing`: Flujo completo de firma electrónica simple — listado de pendientes, firma con pdf-lib, persistencia en GCS/`document`, notificación por email y UI dedicada.
- `email-resend-service`: Servicio de envío de emails con Resend y fallback de desarrollo.

### Modified Capabilities

- `casl-authorization`: Subject `Contract` amplía acciones de `read` a `read` y `sign`; menú y rutas protegidas con `sign`.
- `backend-mcp-server`: Registro de herramientas MCP para listar pendientes y firmar contratos.
- `draft-document-gcs`: Comportamiento al firmar — `status` pasa a `signed` sin eliminar el borrador.
- `document-registry-table`: Inserción de registro firmado con metadatos (`signed_at`, `signed_by`, `contract_overrides`, `client_id`).

## Impact

**Backend:** `app.js`, `config.js`, `permissionsCatalog.js`, `SET_VARS_AMBIENTE_LOCAL.cmd`, nuevos `emailService.js`, `contractSigningService.js`, `contractSigningController.js`, `mcpTools.mjs`, `mcp.mjs`; dependencias `pdf-lib`, `resend`.

**Frontend:** `menuConfig.js`, `AppRouter.jsx`, `permissionsCatalog.js`, nuevos `contractSigningApi.js`, `ContractSigningPage.jsx`.

**Infraestructura:** Resend (dominio `incrementa.la` en producción; `onboarding@resend.dev` en dev si el dominio no está verificado).

**Seguridad:** Solo usuarios con `can('sign', 'Contract')` acceden a listado y firma. La firma registra identidad del firmante (`user_profile.full_name`) y hash SHA-256 del PDF original. El email se envía al correo registrado de la empresa, no al proveedor.

**Locale:** Timestamps de firma en timezone `America/Santiago`; mensajes de error y UI en español (es-CL).
