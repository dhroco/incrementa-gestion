## 1. Migración y almacenamiento

No ejecutar `knex`, migraciones ni seeds. No tocar `backend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `openspec/config.yaml`, `docs/**`, `.github/**` ni `infra/**`. No agregar dependencias ni variables. No modificar pruebas existentes.

- [x] 1.1 Crear `backend/migrations/202610220001_firme_signing.js` con `up` y `down`: tablas `firme_signing` y `firme_webhook_event`, el check de estados, el índice único parcial de intentos activos, el único `(draft_document_id, attempt)`, los índices de `firme_document_code` y `status`, y `link_renewed_at`. `down` borra primero el webhook. No agregar un check a `draft_document.status`.
- [x] 1.2 Agregar `uploadBufferOnce({ buffer, gcsPath, contentType })` a `backend/services/storageService.js` (`ifNoneMatch: '*'`, misma huella → `{ created: false }`, otra huella → `STORAGE_CONFLICT`). No cambiar `uploadBuffer`, `downloadBuffer`, `deleteFile`, `getSignedUrl` ni `containerFor`.
- [x] 1.3 Pruebas nuevas `backend/test/firmeSigningMigration.test.js` (doble de `knex.schema`, sin base) y `backend/test/storageService.once.test.js`.

## 2. Cliente de Firme

Sin alterar el orden, los cuerpos ni las respuestas actuales de `sendForSignature`, `getDocument`, `downloadSignedPdf` y `collectEvidence`.

- [x] 2.1 En `backend/lib/firmeClient.js`, agregar `getQuota`, `deleteDocument`, `resendInvitation`, `createWebhook`, `listWebhooks`, `deleteWebhook` y `getWebhook`, con la misma `request` y `FirmeClientError`. El token no entra en los mensajes.
- [x] 2.2 Segundo argumento opcional `{ onProgress }` de `sendForSignature`: copia de `progress` tras cada alta y antes de `complete`. Un error del callback no corta el envío. Sin el argumento, el comportamiento queda igual.
- [x] 2.3 Encabezado `User-Agent: Incrementa-Contratos/1.0` en toda llamada a `apiUrl`. No en la subida a S3 ni en las descargas por URL firmada.
- [x] 2.4 Prueba nueva `backend/test/firmeClient.extension.test.js` con `fetchImpl`. No modificar `firmeClient.test.js`.

## 3. Estampado

- [x] 3.1 Crear `backend/lib/firmeStamp.js` con `STAMP_X` 0.335, `STAMP_Y` 0.80, `STAMP_WIDTH` 0.33, `STAMP_HEIGHT` 0.12, `FIRME_PAGE_BASE` 1, `stampPositionFor` y `drawStampBox` (rótulo «Firma electrónica del proveedor» en la última página). Firme mide `y` desde el borde superior y pdf-lib desde el inferior: el origen del recuadro es `y = height - STAMP_Y * height - STAMP_HEIGHT * height`, con el borde superior en la mitad inferior.
- [x] 3.2 Exportar desde `contractSigningService.js`, sin cambiar su comportamiento, lo que el estampado reutilice y aún no esté exportado (`sha256Hex` y `sanitizeFilePart`). Reutilizar `appendSignaturePage`, `buildSignedGcsPath`, `yearMonthInSantiago` y el resto que ya se exporta.
- [x] 3.3 Implementar `buildStampedPdf` en `backend/services/firmeStampService.js`: mismo armado que `signContract`, más la caja del timbre, sin el respaldo sin rúbrica. Falta de `content_snapshot`, de una rúbrica de empresa o un re-render fallido → `RUBRICA_NO_DISPONIBLE` y ningún PDF.
- [x] 3.4 Prueba nueva `backend/test/firmeStamp.test.js` con pdf-lib real.

## 4. Envío a Firme

- [x] 4.1 Crear `backend/services/firmeSigningService.js` con `createFirmeSigningService`. `getSigningMode` en el orden `blocked` (solo `ENVIRONMENT=prod` sin `FIRME_*`), `firme` (RUT chileno del proveedor), `internal`.
- [x] 4.2 `sendToFirme`: validar sin escribir (404, 409, RUT con `parseRut`, `FIRMANTE_INCOMPLETO` nombrando el campo, materno vacío → `'.'`). Recuperar un `sending` de más de 10 minutos (adoptar `PENDING_SIGNATURE`, borrar `DRAFT`, o `send_failed` sin código). Reservar el intento con `document_id` nuevo. Cortar el doble envío con el índice único (`ENVIO_EN_CURSO`).
- [x] 4.3 Seguir con cuota, estampado, `uploadBuffer` bajo `contratos-en-firma/…/{intentoId}_estampado.pdf`, y `sendForSignature` guardando los ids en `onProgress` y en `error.progress` antes de `complete`. Nombre `Contrato Incrementa — {plantilla} — {proveedor}` (≤ 120). Éxito: `pending_signature` e `in_signature` en una transacción, respuesta 202. Fallo de Firme: `send_failed`, `deleteDocument` si hay código, borrador intacto. 422 de RUT en `signees` → `RUT_INVALIDO` y borrado del documento en `DRAFT`.
- [x] 4.4 Prueba nueva `backend/test/firmeSigningService.send.test.js` con dobles. Cubre el orden del camino feliz (el PDF enviado es el guardado), RUT inválido, firmante incompleto, sin créditos, `FIRME_NO_CREDITS` en `complete`, fallo a medias, ids antes de `complete`, doble envío, `sending` colgado (adoptar, borrar `DRAFT`, sin código), sin rúbrica, reenvío como intento 2 y modo interno (`RFC` → `NO_APLICA_FIRME`).

## 5. Recepción, enlace y barrido

- [x] 5.1 `refresh` con `forUpdate().skipLocked()`. Solo `pending_signature` llama a Firme. Mapear espera, vencimiento (`approvedUntil` o 10 días desde `link_renewed_at` si es posterior, si no desde `approved_at`), `SIGNED`/`COMPLETED`, `REJECTED` (`rejectionDetail`) y `CANCELLED`/`REFUNDED`. Un error de red no cambia el estado. El borrador sigue en `in_signature` tras rechazo, vencimiento o cancelación.
- [x] 5.2 `finalize` idempotente: descargar sin guardar la URL, verificar prefijo SHA-256, largo y `/ByteRange`, guardar el recibido en `contratos-en-firma/` si no calza (`hash_mismatch`, sin `document`). Si calza, evidencia, `uploadBufferOnce` en `firmados` con el `document_id` reservado, `document`, intento `signed` y borrador `signed` en una transacción. El correo va después; un fallo o `skipped` no revierte. El siguiente `refresh` retoma un corte entre guardar y registrar.
- [x] 5.3 `resendLink` para `pending_signature` y `expired` vía `resendInvitation`. `expired` exitoso vuelve a `pending_signature` y escribe `link_renewed_at`. 422 → 409 `ENLACE_NO_RENOVABLE` sin cambiar el estado. Otro estado → 409 `INVALID_STATUS`.
- [x] 5.4 `sweepPending`: a lo más 20 pendientes con `last_checked_at` nulo o de hace más de 10 minutos, de a uno, saltando bloqueados, más los `sending` colgados. Resumen `{ revisados, finalizados, rechazados, vencidos, saltados, errores }`. Sin temporizador.
- [x] 5.5 Pruebas nuevas `backend/test/firmeSigningService.finalize.test.js` y `backend/test/firmeSigningService.refresh.test.js`.

## 6. Webhook SNS y rutas

- [x] 6.1 Crear `backend/lib/snsVerify.js`: host SNS, `https`, ruta `.pem`, caché del certificado, RSA-SHA1 o RSA-SHA256, cadena oficial por tipo.
- [x] 6.2 `handleWebhook`: firma primero; confirmación solo a un `SubscribeURL` SNS `https`; notificación con código en `data.document_code`, luego `resource_id`, luego un uuid que coincida con un pendiente; motivo de rechazo y nada más del evento; `firme_webhook_event` con `ON CONFLICT (event_id) DO NOTHING`; siempre `{ ok: true }`.
- [x] 6.3 `backend/controllers/firmeSigningController.js` y rutas en `createApp`. Nuevo parámetro `firmeSigningService` con default `null`. Webhook público antes de `requireAuth`, con `express.text({ type: '*/*', limit: '256kb' })`, siempre 200. Rutas `send-to-firme`, `in-signature` (antes de `/:id`), `refresh-signature` y `resend-link` con `authorize('sign', 'Contract')`. Con servicio `null`: modo `internal`, guardia de `sign` inactiva, rutas nuevas 503 `FIRME_NO_DISPONIBLE`. `index.js` inyecta el servicio real y no arranca un temporizador.
- [x] 6.4 `listPendingSignature`: sumar `in_signature` al `whereNotIn` y las columnas de la sugerencia de firmante al `select`. No usar otros métodos de la cadena. El controlador suma `signing_mode` y `meta.email_enabled`. Guardia de `POST .../sign`: `USE_FIRME_FLOW` o `FIRMA_BLOQUEADA` antes de `signContract`.
- [x] 6.5 `normalizeStatus` admite `in_signature`. El filtro `draft` no cambia su predicado. El filtro `in_signature` devuelve solo esos borradores.
- [x] 6.6 MCP: el mismo guardia en `firmar_contrato_electronico` solo si viene `deps.firmeSigningService`. `createMcpServer` crea el servicio real, lo pasa a `registerMcpTools` y no arranca un temporizador.
- [x] 6.7 Pruebas nuevas `backend/test/snsVerify.test.js`, `backend/test/firmeWebhook.test.js` y `backend/test/firmeSigningApi.test.js` (rutas, permiso `sign`, modos `firme` y `blocked` en `sign` y en el MCP, y el comportamiento de hoy sin servicio inyectado).
- [x] 6.8 Pruebas nuevas, en archivos nuevos (no agregar a `contractSigningApi.test.js`, `contractsQueryService.test.js` ni `mcpServer.test.js`):
  - `backend/test/contractSigningPending.firme.test.js`: escenarios «Natural person suggestion uses the supplier parts», «Company suggestion uses the legal representative» (no usa el `document_number` de la empresa), y «Missing Firme service reports internal mode» (`signing_mode` `internal` y `meta.email_enabled` presentes), con el doble de base de datos de `listPendingSignature` (solo `join`, `leftJoin`, `whereNotIn`, `select`, `orderBy`); además que el `whereNotIn` incluye `in_signature`.
  - `backend/test/contractsQueryService.inSignature.test.js`: `normalizeStatus('in_signature')`, escenario «Filter by in-signature status» (solo borradores `in_signature`, sin filas `document`) y que el filtro `draft` conserva su predicado.
  - `backend/test/mcpServer.firme.test.js`: escenario «Factory passes the Firme signing service» (`createMcpServer()` entrega un `firmeSigningService` a `registerMcpTools` y no arranca temporizadores), con dobles de módulos/BD sin conexión real.
- [x] 6.9 Prueba nueva `frontend/src/api/contractSigningApi.firme.test.js`: escenario «Send calls the Firme endpoint» (`sendToFirme` hace POST de `{ signee }` a `/api/contracts/:id/send-to-firme`) y las llamadas `fetchInSignature`, `refreshSignature` y `resend-link`, con el cliente de API doblado.

## 7. Scripts de operación

No se ejecutan al arrancar la app. Las pruebas los invocan con dobles.

- [x] 7.1 `backend/scripts/firme-barrido.js`: sin Firme, sale 0 con el JSON `omitido`; si no, imprime una línea con el resumen de `sweepPending` y sale 0; un error sale 1. Cierra knex. Sin datos del firmante ni tokens.
- [x] 7.2 `backend/scripts/firme-webhook.js`: `registrar` (borra la misma URL con otra configuración, crea los cuatro eventos, consulta hasta `isConfirmed`, no imprime el token, explica el 403), `listar`, `borrar` y `estado`.
- [x] 7.3 Pruebas nuevas `backend/test/firmeBarridoScript.test.js` y `backend/test/firmeWebhookScript.test.js`.

## 8. Pantallas

Estilos de `openspec/config.yaml`: botones `.btn`, tabla existente, Nunito Sans, íconos MUI Outlined, RUT con `RutInput` y `formatRutDisplay`. Sin librerías nuevas ni hex nuevos.

- [x] 8.1 En `frontend/src/api/contractSigningApi.js` agregar `sendToFirme`, `fetchInSignature`, `refreshSignature` y la llamada de `resend-link`.
- [x] 8.2 En `ContractSigningPage.jsx`, pestañas «Por aprobar» y «En firma». Modal interno igual que hoy. Modal Firme con datos prellenados, casilla, «Aprobar y enviar a firma» / «Enviando…», éxito «Contrato en proceso de firma.» por 8 segundos y error del backend dentro del modal. Modo `blocked`: botón deshabilitado y «Ver PDF» disponible.
- [x] 8.3 Pestaña «En firma»: chips, acciones de la matriz de la spec (`hash_mismatch` sin «Reenviar a firma»; `expired` solo «Renovar enlace»), créditos y aviso con `LOW_CREDITS_WARNING = 10`. «Contrato firmado.» por 8 segundos solo cuando el intento pasa a `signed`.
- [x] 8.4 En `ContractsListPage.jsx`, chip «En proceso de firma» cuando `status` es `in_signature`, «Firmado» cuando está firmado y «En proceso» en el resto. Sumar la opción de filtro con valor `in_signature` y etiqueta «En proceso de firma». No renombrar la opción `draft`. No usar detalle de `firme_signing`.
- [x] 8.5 Pruebas nuevas `frontend/src/pages/ContractSigningPage.firme.test.jsx` y `frontend/src/pages/ContractsListPage.firma.test.jsx`. La de firma afirma la matriz de botones de la spec, no la viñeta del recorte que metía `expired` en «Reenviar a firma».

## 9. Verificación

- [x] 9.1 Correr `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y `cd frontend && npm run lint`. Las tres en verde. Si una prueba existente falla, no ajustarla: consultar a la mesa.
- [x] 9.2 Confirmar que ningún archivo de prueba previo, ni `config.js`, ni `knexfile.js`, ni `db/knex.js`, quedó modificado, y que la corrida no ejecutó la migración.

## 10. Revisión final

- [x] 10.1 La evidencia en `firmados` es determinista: `verifiedAt` sale de `signedOn` de Firme, las claves van ordenadas, y un `STORAGE_CONFLICT` con el mismo contenido semántico cuenta como ya escrito. Una prueba nueva reintenta `finalize` con otro reloj después de fallar el alta de `document`.
- [x] 10.2 Ante un fallo de `sendForSignature` se consulta `getDocument`: solo se borra un `DRAFT`; `PENDING_SIGNATURE` o posterior se adopta; si no se puede consultar, el intento sigue en `sending`.
- [x] 10.3 El webhook exige `snsTopicArn` (`FIRME_SNS_TOPIC_ARN` en el arranque), pide `redirect: 'error'` al bajar el certificado y al confirmar, y no copia el motivo del evento: el rechazo sale de Firme.
- [x] 10.4 `markFailed` y la adopción de un `sending` condicionan `status = 'sending'`. La adopción corre en una transacción con `forUpdate().skipLocked()`.
- [x] 10.5 `refresh` descarga y sube fuera de la transacción. Un cuerpo de webhook que no es JSON válido no se persiste en `firme_webhook_event`: solo `logError`, sin el cuerpo.
- [x] 10.6 Las ablaciones `indice-intento-activo` y `almacenamiento-idempotente` quedaron marcadas como prueba mal elegida: la compuerta completa ya las caza (`firmeSigningMigration.test.js` exige `UNIQUE INDEX` y `storageService.once.test.js` exige `{ created: false }`). No se manda a reparar.
