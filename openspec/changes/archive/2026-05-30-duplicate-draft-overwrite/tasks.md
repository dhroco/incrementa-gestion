## 1. Backend — detección de duplicados

- [x] 1.1 Añadir helper `findActiveDuplicateDraft(trx, { companyId, supplierId, templateId, year, month })` en `documentBuilderService.js` que consulte `draft_document` con filtros de proveedor, empresa, plantilla, status activo y año/mes en `America/Santiago`, ordenado por `created_at DESC`, retornando la fila más reciente (`id`, `file_name`, `gcs_path`, `created_at`, `status`).
- [x] 1.2 En `generateAndPersist`, después de validar placeholders y antes de generar PDF, invocar el helper con `yearMonthInSantiago()`. Si hay duplicado y `body.overwrite !== true`, retornar `{ ok: false, status: 409, code: 'DUPLICATE_DRAFT', message, data: { existing } }`.

## 2. Backend — flujo overwrite

- [x] 2.1 Implementar rama `body.overwrite === true`: re-consultar duplicado; si existe, llamar `gcsService.deleteFile({ gcsPath: existing.gcs_path })`, luego `DELETE` del registro en `draft_document` (usar transacción Knex para la parte BD).
- [x] 2.2 Si delete GCS falla, abortar con error 500 en español sin borrar la fila BD. Si re-query no encuentra duplicado, continuar generación normal sin delete.
- [x] 2.3 Verificar que el controller propaga `data.existing` en `meta` del 409 (ajustar solo si hiciera falta).

## 3. Backend — tests

- [x] 3.1 Test: duplicado activo sin `overwrite` → 409 `DUPLICATE_DRAFT` con `existing`.
- [x] 3.2 Test: duplicado con `overwrite: true` → `deleteFile` invocado, fila eliminada, nuevo insert exitoso.
- [x] 3.3 Test: fila `signed` en el mismo mes → generación normal (sin 409).
- [x] 3.4 Test (opcional): `documentBuilderApi.test.js` — POST generate retorna 409 con meta `existing`.

## 4. Frontend — propagación API

- [x] 4.1 Extender `apiSendJson` en `apiClient.js` para incluir `meta` del body de error en la respuesta `{ ok: false, ... }` (patrón análogo a `missingFieldKeys`).
- [x] 4.2 Documentar en JSDoc de `postDocumentBuilderGenerate` el campo opcional `overwrite: boolean`.

## 5. Frontend — modal de confirmación

- [x] 5.1 En `DocumentBuilderPage.jsx`, interceptar `res.code === 'DUPLICATE_DRAFT'` en `runGenerate`; guardar `existing` desde `res.meta` y el `renderEngine` pendiente en estado local.
- [x] 5.2 Renderizar `ConfirmDialog` con mensaje en español (archivo, fecha `es-CL` / `America/Santiago`, estado traducido: `draft` → «Borrador», `pending_signature` → «Pendiente de firma»).
- [x] 5.3 «Reemplazar»: repetir `postDocumentBuilderGenerate` con `overwrite: true` y mismos parámetros; «Cancelar»: cerrar modal sin acción.
- [x] 5.4 Test (opcional): mock 409 y verificar que confirmación envía `overwrite: true`.

## 6. Verificación manual

- [ ] 6.1 Generar contrato para proveedor+plantilla; repetir en el mismo mes → debe aparecer modal.
- [ ] 6.2 Confirmar reemplazo → nuevo PDF en GCS, un solo `draft_document` activo para esa combinación.
- [ ] 6.3 Cancelar → sin segundo documento creado.
