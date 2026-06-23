## Why

Al generar contratos en el Constructor de Documentos, el sistema permite crear múltiples borradores (`draft_document`) para la misma combinación de proveedor, empresa, plantilla y mes calendario sin advertir al usuario. Esto genera duplicados silenciosos en GCS y en la base de datos, dificultando saber cuál es el contrato vigente del mes y aumentando el riesgo de sobrescritura accidental o pérdida de contexto.

## What Changes

- **Backend:** En `documentBuilderService.generateAndPersist`, antes de generar el PDF, detectar si ya existe un `draft_document` activo (status distinto de `signed` y `rejected`) para la misma combinación `supplier_id + company_id + template_id + año/mes` (zona horaria `America/Santiago`).
- **Backend:** Si existe duplicado y `body.overwrite !== true`, responder HTTP 409 con código `DUPLICATE_DRAFT` e incluir metadatos del documento existente (`id`, `file_name`, `created_at`, `status`).
- **Backend:** Si existe duplicado y `body.overwrite === true`, eliminar el archivo GCS del borrador existente, borrar el registro de `draft_document` (re-validando su existencia) y continuar con la generación normal.
- **Frontend:** En `DocumentBuilderPage`, interceptar respuestas `DUPLICATE_DRAFT`, mostrar modal de confirmación con detalle del borrador existente (nombre, fecha, estado traducido) y opciones «Reemplazar» / «Cancelar».
- **Frontend:** Si el usuario confirma reemplazo, repetir la llamada de generación con `overwrite: true` en el body.
- Sin cambios de migración ni constraints de BD — la regla es lógica de negocio.

## Capabilities

### New Capabilities

- _(Ninguna — el comportamiento extiende capacidades existentes.)_

### Modified Capabilities

- `draft-document-gcs`: Añadir detección de duplicados mensuales, respuesta 409 `DUPLICATE_DRAFT`, flujo de overwrite con limpieza GCS+BD, y confirmación en frontend antes de reemplazar.

## Impact

- **Backend:** `backend/services/documentBuilderService.js` (nueva consulta, rama overwrite, uso de `gcsService.deleteFile`).
- **Backend tests:** `backend/test/documentBuilderService.test.js`, posiblemente `documentBuilderApi.test.js`.
- **Frontend:** `frontend/src/pages/DocumentBuilderPage.jsx` (manejo 409, modal), reutilizando `ConfirmDialog` existente.
- **API:** El endpoint `POST /api/document-builder/generate` acepta campo opcional `overwrite: boolean` en el body; nuevo código de error `DUPLICATE_DRAFT`.
- **Dependencias:** Reutiliza `yearMonthInSantiago`, `gcsService.deleteFile` y tabla `draft_document` existente.

## Consideraciones de seguridad

- El overwrite solo procede si el duplicado existe y pertenece al mismo alcance de empresa ya validado por `resolveReadableCompanyId`; no confiar ciegamente en el flag `overwrite`.
- La eliminación GCS y el DELETE en BD deben ocurrir solo tras re-validar el registro dentro del flujo de overwrite (idealmente en transacción para la parte de BD).
- El modal informa estado del borrador existente para decisión consciente; no exponer rutas GCS ni datos sensibles adicionales.
- Mensajes de error y confirmación en español (es-CL); fechas formateadas con locale chileno.
