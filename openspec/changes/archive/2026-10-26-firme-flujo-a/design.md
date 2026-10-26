## Context

Hoy `POST /api/contracts/:id/sign` (`contractSigningService.signContract`) re-renderiza el PDF con la rúbrica de la empresa, agrega la constancia, guarda el archivo bajo `contratos-firmados/`, marca el borrador `signed` y envía el correo. La influencer no firma en el sistema. El cliente HTTP de Firme ya existe (`backend/lib/firmeClient.js`) y el proveedor ya guarda nombres y apellidos por separado. Este recorte une esas piezas en el flujo A, aprobado por David el 26-oct-2026. Base: `preprod` con `firme-cliente` y `proveedor-nombre-apellidos` fusionados.

El backend escala a 0 réplicas. El contenedor `firmados` en producción tendrá WORM de 5 años: un blob escrito no se puede modificar ni borrar. `draft_document.status` es `string(32)` sin check constraint (`202605300016_create_draft_document.js`), así que `in_signature` no exige alterar esa columna. `listPendingSignature` ya hace `join`, `leftJoin`, `whereNotIn`, `select` y `orderBy`; la prueba existente solo expone esos métodos. `createApp` hoy no conoce Firme. Las pruebas existentes de firma, listado, cliente, almacenamiento y MCP no se modifican.

Fuente de comportamiento: el recorte `firme-flujo-a` y `docs/disenos/firma-firme.md`. Donde discrepan, manda el recorte (ver D11 y D12).

## Goals / Non-Goals

**Goals:**

- Aprobar y enviar a Firme un contrato de proveedor con RUT chileno: rúbrica estampada, huella del PDF exacto, un firmante, borrador en `in_signature`.
- Cerrar el ciclo cuando la influencer firma, rechaza o el enlace vence, por webhook, por la pantalla o por `node scripts/firme-barrido.js`, con la misma función idempotente.
- Verificar que la primera revisión del PDF firmado es el PDF aprobado y guardar PDF y evidencia una sola vez en `firmados`.
- Conservar el camino interno para quien no entra a Firme, y bloquear toda firma en producción mientras falten las `FIRME_*`.
- Pantalla con pestañas «Por aprobar» y «En firma», mensajes en español y el chip «En proceso de firma» en el listado de contratos.

**Non-Goals:**

- Ejecutar la migración, agregar variables o dependencias, o tocar `config.js`, `knexfile.js`, `db/knex.js`, `infra/**`, `docs/**` y `openspec/config.yaml`.
- Crear el Container Apps Job, registrar el webhook en Firme o cargar secretos (lo hacen David y la sesión de la nube).
- Flujo B, extranjeros sin RUT dentro de Firme, timbre medido sobre el cuerpo del contrato, recordatorios automáticos, envío del enlace por nuestro canal, cancelación manual y apellido materno opcional.
- Cambiar el comportamiento de `signContract` en el camino interno, ni el de `sendForSignature`, `getDocument`, `downloadSignedPdf` y `collectEvidence` cuando se los llama como hoy.
- Modificar pruebas existentes. Un temporizador dentro del proceso del backend.

## Decisions

### D1 — Modo de firma, en este orden

`getSigningMode(draftDocumentId)` devuelve:

1. `blocked` si `config.ENVIRONMENT === 'prod'` y `isFirmeConfigured()` es falso. Vale para todo proveedor, también sin RUT chileno.
2. `firme` si Firme está configurado y el subtipo del proveedor (persona natural o empresa) tiene `document_type_code = 'RUT'`.
3. `internal` en cualquier otro caso.

`POST .../sign` y la herramienta MCP `firmar_contrato_electronico` consultan el modo **antes** de `signContract`. `firme` → 409 `USE_FIRME_FLOW` («Este contrato se firma con Firme: use «Aprobar y enviar a firma».»). `blocked` → 409 `FIRMA_BLOQUEADA` («La firma está deshabilitada en producción hasta que se configure Firme.»). `send-to-firme` también responde `FIRMA_BLOQUEADA` en ese modo, y `NO_APLICA_FIRME` (409) si el modo es `internal`. Si `createApp` no recibe `firmeSigningService` (default `null`), el guardia no actúa, `signing_mode` de cada ítem es `internal` y las rutas nuevas responden 503 `FIRME_NO_DISPONIBLE`, salvo el webhook, que responde 200 sin hacer nada. Las pruebas actuales no inyectan el servicio. `index.js` y `createMcpServer` crean el servicio real y lo pasan; no arrancan ningún temporizador.

### D2 — Un intento activo y los identificadores antes de completar

La migración `202610220001_firme_signing.js` crea `firme_signing` y `firme_webhook_event` con `up` y `down`. Además de las columnas del recorte, `firme_signing` incluye `link_renewed_at timestamptz`: el vencimiento la usa en lugar de `approved_at` cuando es posterior. El recorte la nombra en la renovación y no en la tabla resumen; sin ella el plazo de 10 días no se puede reiniciar.

El índice único parcial sobre `draft_document_id` donde `status IN ('sending','pending_signature')` es el corte del doble clic (409 `ENVIO_EN_CURSO`). `document_id` se reserva con `crypto.randomUUID()` al insertar el intento, para que la ruta en `firmados` sea estable.

`sendForSignature` acepta un segundo argumento opcional `{ onProgress }`. El callback recibe una copia de `{ transactionId?, documentCode?, signees }` después de crear la transacción, el documento y el firmante, y **antes** de `complete`. Un error del callback no corta el envío. El servicio persiste esos tres identificadores en el callback y, si el cliente lanza, también los de `error.progress`. Los créditos se descuentan al completar: no se crea una segunda transacción ni se completa dos veces la misma.

Un intento `sending` con más de 10 minutos se recupera antes de reservar otro, y también en el barrido: con `firme_document_code` se consulta el documento; `PENDING_SIGNATURE` o un estado más avanzado **adopta** el intento (`pending_signature`) y no se reenvía; `DRAFT` se borra con `deleteDocument` y el intento pasa a `send_failed` (`ENVIO_INTERRUMPIDO`); sin código, pasa a `send_failed` sin llamar a Firme. El párrafo del diseño de dominio que mandaba todo `sending` colgado a `send_failed` queda reemplazado por esta adopción: un `complete` ya cobrado no se vuelve a pagar.

### D3 — Estampado sin respaldo y huella de esos bytes

`backend/lib/firmeStamp.js` exporta `STAMP_WIDTH = 0.33`, `STAMP_HEIGHT = 0.12`, `FIRME_PAGE_BASE = 1`, `STAMP_X = 0.335` y `STAMP_Y = 0.80`. La caja queda centrada en horizontal (margen mayor al 5 % a cada borde) y en la mitad inferior (`0.80`–`0.92`, sin pisar la constancia de la parte alta, con más del 5 % al borde inferior). `stampPositionFor(pageCount)` devuelve `{ page: pageCount - 1 + FIRME_PAGE_BASE, x: STAMP_X, y: STAMP_Y }`. `drawStampBox` dibuja en la última página, con esas constantes, un recuadro gris fino y el rótulo «Firma electrónica del proveedor».

`buildStampedPdf` sigue el armado de `signContract` (PDF original, `draft_sha256`, re-render de `content_snapshot` con las rúbricas `legal_rep_signature` de los `signatureBlock` `party: 'company'`, `appendSignaturePage`, caja del timbre) y **no** tiene el respaldo sin rúbrica. Sin `content_snapshot`, sin la rúbrica de un representante que figura en un bloque de la empresa, o si el re-render falla: no hay PDF y el envío termina en 422 `RUBRICA_NO_DISPONIBLE` («La empresa no tiene registrada la rúbrica del representante; no se puede enviar a firma.»). `sha256` y `byteLength` son los del buffer que se sube a `contratos-en-firma/.../{intentoId}_estampado.pdf` y que se pasa a Firme, byte a byte. Ningún paso posterior reescribe ese PDF. Se reutilizan `appendSignaturePage`, `buildSignedGcsPath`, `sha256Hex`, `formatCompanyRut`, `formatTimestampSantiago`, `yearMonthInSantiago` y `sanitizeFilePart`; se exporta lo que aún no esté exportado, sin cambiar el comportamiento. El prefijo `contratos-en-firma/` no empieza con `contratos-firmados/`, así que `containerFor` lo deja en `documentos`.

El nombre del documento en Firme es `Contrato Incrementa — {plantilla} — {proveedor}`, recortado a 120 caracteres. «Incrementa» es fijo.

### D4 — Recepción única y verificación de la primera revisión

`refresh` solo llama a Firme si el intento está en `pending_signature`. Toma la fila con `forUpdate().skipLocked()` dentro de una transacción. Si no consigue el bloqueo, devuelve el estado actual. Un error de red o de Firme guarda `last_error_*` y no cambia el estado.

| Estado en Firme | Efecto |
|---|---|
| `PENDING_SIGNATURE` u otra espera | actualiza `firme_status` y `last_checked_at`; si `approvedUntil` del firmante ya pasó, o si no viene y pasaron más de 10 días desde `approved_at` (o desde `link_renewed_at` si es posterior) → `expired` |
| `SIGNED` o `COMPLETED` | `finalize` |
| `REJECTED` | `rejected`, con `rejection_reason` = `rejectionDetail` del firmante, o el motivo del evento si falta |
| `CANCELLED` o `REFUNDED` | `cancelled` |

Después de `rejected`, `expired` o `cancelled` el borrador sigue en `in_signature`.

`finalize` es idempotente. Descarga el PDF y no guarda la URL. La huella de `firmado.subarray(0, stamped_byte_length)` debe ser `stamped_sha256`, el firmado debe ser más largo y debe contener `/ByteRange`. Si no: el recibido va a `contratos-en-firma/.../{intentoId}_recibido.pdf`, el intento queda `hash_mismatch` (`HASH_NO_COINCIDE`), no se crea `document` y el borrador no cambia. El log lleva el código, nunca el PDF.

Si la huella calza: evidencia con `collectEvidence`, y en `firmados` el PDF con `buildSignedGcsPath({ docId: document_id })` (el id reservado), `{document_id}_evidencia.json` y `{document_id}_correo_{n}.pdf`. Esas escrituras usan solo `uploadBufferOnce` (`ifNoneMatch: '*'`). Misma huella → `{ created: false }` y se sigue. Otra huella → `STORAGE_CONFLICT`. En la misma transacción se inserta `document` con `id = document_id` (si ya existe, no se reinserta), el intento pasa a `signed` y el borrador a `signed`. El correo a `company.email` va **después** de la transacción; un fallo o `skipped` no revierte nada. Si algo falla entre guardar y registrar, el siguiente `refresh` retoma.

### D5 — Webhook público con firma SNS

`POST /api/webhooks/firme` se declara antes de `requireAuth`, con `express.text({ type: '*/*', limit: '256kb' })`. Responde siempre `200 { ok: true }`. `verifySnsMessage` (crypto, sin dependencias nuevas) exige `SigningCertURL` `https` con host `^sns\.[a-z0-9-]+\.amazonaws\.com$` y ruta que termine en `.pem`, descarga el certificado con caché por URL y verifica `RSA-SHA1` (versión 1) o `RSA-SHA256` (versión 2) sobre la cadena oficial del tipo. Firma inválida o no verificable: se registra el motivo y no se procesa.

`SubscriptionConfirmation` válida hace `GET` a `SubscribeURL` solo si el host cumple la misma regla y el protocolo es `https`. `Notification` válida lee `Message` como JSON. El código de documento sale de `data.document_code`, si falta de `resource_id`, y como último recurso de un uuid del mensaje que coincida con un `firme_document_code` en `pending_signature`. No se filtra por `signature_method`. Del evento solo se toma además el motivo (`reason`, `motivo`, `rejectionReason`, también bajo `data`). Cada mensaje se inserta en `firme_webhook_event` con `ON CONFLICT (event_id) DO NOTHING`; `event_id` nulo se inserta siempre. Si el evento ya estaba, igual se hace `refresh`. `handleWebhook` nunca lanza.

El diseño de dominio también nombra las claves `documentCode`, `code` y `document.code`. El recorte no las usa; este diseño tampoco.

La suscripción no se crea al arrancar. `backend/scripts/firme-webhook.js` ofrece `registrar`, `listar`, `borrar` y `estado`. `registrar` borra la suscripción de la misma URL si existe con otra configuración (evita el 412) y crea `document.signed`, `document.status_changed`, `signature.signed` y `signature.rejected`. Consulta el estado hasta `isConfirmed` (máximo 10 intentos, 3 s). Imprime solo id y estado. Un 403 dice que hace falta un token de administrador de la empresa.

### D6 — Enlace, barrido y créditos

`resendLink` vale para `pending_signature` (recordatorio, botón «Reenviar enlace») y `expired` (botón «Renovar enlace»). Llama a `resendInvitation` con el `privateCode` guardado. No consume otro crédito. Si el intento estaba `expired` y Firme acepta, vuelve a `pending_signature` y se escribe `link_renewed_at`. Un 422 de Firme es 409 `ENLACE_NO_RENOVABLE` («Firme no permite renovar este enlace; use «Reenviar a firma» (usa 1 crédito nuevo).») y no cambia el estado. Otro estado del intento, o un borrador con otro intento activo, es 409.

`sweepPending` refresca como máximo 20 intentos `pending_signature` con `last_checked_at` nulo o de hace más de 10 minutos, de a uno, saltando los bloqueados, y revisa los `sending` colgados. No hay `setInterval`. `firme-barrido.js` sale 0 con `{ "ok": true, "omitido": "Firme no está configurado" }` si Firme no está configurado; si no, imprime una línea JSON con el resumen y sale 0, o 1 si falla la base o el servicio. Cierra knex al terminar. El resumen no lleva datos del firmante ni tokens.

`getQuota` avisa el saldo. `LOW_CREDITS_WARNING = 10`. Sin créditos al enviar (`simple` < 1) el intento queda `send_failed` con `FIRME_NO_CREDITS` y no se crea nada en Firme. Si `complete` responde sin créditos, se borra el documento en `DRAFT` y el borrador queda como estaba.

### D7 — Rutas y listados sin métodos nuevos en la consulta existente

Rutas protegidas con `authorize('sign', 'Contract')`, en un controlador nuevo que resuelve el perfil como `postSign`:

- `POST /api/contracts/:id/send-to-firme` → 202.
- `GET /api/contracts/in-signature` → lista y, antes, `refresh` en paralelo (máximo 5) de los `pending_signature` con `last_checked_at` de hace más de 1 minuto; los errores se ignoran. `meta.credits` es el `simple` de `getQuota`, omitido si Firme no responde.
- `POST /api/contracts/:id/refresh-signature` y `POST /api/contracts/:id/resend-link`.

`GET /api/contracts/in-signature` se registra antes de cualquier ruta ` /api/contracts/:id/...`, igual que `pending-signature`.

`listPendingSignature` solo agrega `in_signature` al `whereNotIn` y columnas al `select` (partes del nombre, RUT y correo del proveedor o del representante, y `document_type_code` del subtipo). El mapeo arma `signee_suggestion`. El controlador suma `signing_mode` (con servicio nulo, `internal`) y `meta.email_enabled` (`true` si hay `RESEND_API_KEY`). No se agregan otros métodos a la cadena de la consulta.

`normalizeStatus` de la consulta de contratos acepta también `in_signature`. El filtro `draft` sigue siendo el subquery de borradores no rechazados ni firmados (incluye filas `in_signature`, porque el recorte no pide cambiar ese predicado). El filtro nuevo `in_signature` devuelve solo borradores en ese estado. El chip de `ContractsListPage` usa únicamente `status`: `signed` → «Firmado», `in_signature` → «En proceso de firma», el resto → «En proceso».

### D8 — Pantalla

Dos pestañas sobre la tabla actual, con los estilos ya definidos (botón `.btn`, tabla sin rayado, Nunito Sans, íconos MUI Outlined). No se inventan variantes ni hex nuevos.

«Por aprobar»: modo `internal` conserva el modal de hoy. Modo `firme`: campos del firmante prellenados con `signee_suggestion` y editables (la corrección vale solo para ese envío), texto de aprobación con la empresa y el correo, casilla y botón «Aprobar y enviar a firma» (deshabilitado hasta marcar la casilla; «Enviando…» mientras espera). Éxito: la fila sale y durante 8 segundos se muestra «Contrato en proceso de firma.». El RUT se edita con `RutInput` y se muestra con `formatRutDisplay`. Modo `blocked`: el botón de firmar de la fila queda deshabilitado con «Firma deshabilitada: Firme aún no está configurado en producción.»; «Ver PDF» sigue disponible.

«En firma»: Proveedor, Firmante, Enviado el, Estado, Acciones. Chips: `pending_signature` «En proceso de firma», `sending` «Enviando a firma…», `rejected` «Firma rechazada», `expired` «Firma vencida», `cancelled` «Firma cancelada», `send_failed` «Envío fallido», `hash_mismatch` «Requiere revisión». Acciones: «Actualizar estado» (salvo `sending`), «Reenviar enlace» (solo `pending_signature`), «Renovar enlace» (solo `expired`), «Reenviar a firma» (solo `rejected`, `cancelled`, `send_failed`; abre el modal con los datos del intento y avisa que usa 1 crédito nuevo), «Ver PDF». `hash_mismatch` no tiene reenvío. `last_error_message` va debajo del chip; en `rejected`, también `rejection_reason`. Sobre la tabla, «Créditos de firma disponibles: N» y, con 10 o menos, el aviso de saldo bajo. «Contrato firmado.» durante 8 segundos solo cuando «Actualizar estado» deja el intento en `signed` y la fila sale de la pestaña.

La palabra «firmado» en un mensaje de éxito de este flujo se reserva para ese momento. El camino interno conserva su mensaje actual.

### D9 — Cliente: funciones nuevas y User-Agent

Se agregan `getQuota`, `deleteDocument`, `resendInvitation`, `createWebhook`, `listWebhooks`, `deleteWebhook` y `getWebhook`, con la misma `request` y los mismos errores. Todas las llamadas a `apiUrl` llevan `User-Agent: Incrementa-Contratos/1.0`. La subida a S3 y las descargas por URL firmada no. El token no aparece en los mensajes.

`uploadBufferOnce` se agrega a `storageService` sin tocar las funciones existentes. Los blobs de `firmados` de este flujo se escriben solo con ella.

### D10 — Materno vacío y RUT

`maternalLastName` vacío se envía como `MATERNAL_PLACEHOLDER` (hoy `'.'`). `firstName`, `lastName` y `email` vacíos, o un correo sin forma de correo, son 422 `FIRMANTE_INCOMPLETO` y el mensaje nombra el campo (nombres, apellido paterno o correo). La forma de correo es: sin espacios, una sola `@`, local y dominio no vacíos, y un punto en el dominio. El RUT se valida con `parseRut` de `backend/utils/rut.js` antes de llamar a Firme (422 `RUT_INVALIDO`, «El RUT del firmante no es válido.»). Si Firme responde 422 en el paso `signees` con el detalle «RUT ingresado no es válido», el intento queda `send_failed` con `RUT_INVALIDO` y el mensaje «Firme no aceptó el RUT del firmante.», y el documento en `DRAFT` se borra.

### D11 — Chips del listado de contratos

`docs/disenos/firma-firme.md` pide en Consulta contratos chips de rechazo, vencimiento y revisión. Esos estados viven en `firme_signing`, y el borrador sigue en `in_signature`. El recorte dice que el chip usa solo `status` y que no se use más detalle de la firma. Se implementa el recorte: tres textos («Firmado», «En proceso de firma», «En proceso»). El detalle se ve en la pestaña «En firma».

### D12 — Qué botón hay en cada estado

La sección 9 del recorte y el diseño de dominio coinciden: «Reenviar a firma» solo en `rejected`, `cancelled` y `send_failed`. `expired` usa «Renovar enlace» (mismo documento, sin crédito nuevo). La viñeta de la prueba de frontend nombra `expired` dentro de «Reenviar a firma»; esa viñeta no se sigue. La prueba nueva afirma la matriz de la sección 9.

La opción de filtro `draft` ya se etiqueta «En proceso de firma». El recorte pide sumar la opción «En proceso de firma» para `in_signature` y no pide renombrar la de `draft`. Se suman las dos, con valores distintos (`draft` e `in_signature`). El copy duplicado queda para el recorte `firma-mensajes`.

## Risks / Trade-offs

- [El `complete` cobra y el proceso cae antes de pasar a `pending_signature`] → los ids ya están guardados; el intento `sending` de más de 10 minutos se adopta si Firme ya está en `PENDING_SIGNATURE` y no se reenvía.
- [Webhook perdido por el arranque en frío, o SNS que reintenta] → respuesta 200 siempre; `refresh` al abrir y el barrido externo cubren el aviso; `event_id` único evita un segundo `document`.
- [WORM rechaza un segundo write] → solo el PDF verificado y la evidencia entran a `firmados`, con `uploadBufferOnce` y ruta reservada. Intermedios van a `contratos-en-firma/`.
- [Dos procesos finalizan el mismo intento] → `FOR UPDATE SKIP LOCKED` y la inserción de `document` condicionada al id reservado.
- [Producción promovida sin `FIRME_*`] → modo `blocked` en API, pantalla y MCP. El deploy no corre la migración: hay que aplicarla antes, porque `in-signature` lee `firme_signing`.
- [La prueba existente de `listPendingSignature` no tolera métodos nuevos] → la consulta solo suma columnas y el valor `in_signature` dentro de `whereNotIn`.
- [Saldo consultado y `complete` sin créditos] → el 422 de `complete` sigue siendo la red; se borra el documento en `DRAFT` y el intento queda `send_failed`.

## Migration Plan

Archivo `backend/migrations/202610220001_firme_signing.js`. Reversible: `down` borra `firme_webhook_event` y `firme_signing`. El código nuevo la necesita antes de arrancar. La aplica el arquitecto, primero en pre-prod y después en prod, antes de promover. Durante los minutos en que la migración ya está y el código viejo sigue vivo, las tablas nuevas no las lee nadie. No hay check que ajustar en `draft_document.status`.

Rollback de código: el camino interno vuelve a firmar todo, porque el guardia vive en el código nuevo. Las filas de `firme_signing` pueden quedar; `down` las elimina solo si se revierte la migración a propósito. Blobs ya escritos en `firmados` no se borran (WORM).

Puesta en marcha (fuera de esta corrida): cargar `FIRME_*` en el backend y en el MCP, registrar el webhook con el script, crear el Job del barrido.

## Open Questions

Ninguna para implementar. D11 y D12 dejan escrito cómo se leen las dos discrepancias del recorte con el diseño de dominio y con la viñeta de la prueba de frontend. Si la mesa prefiere los chips extra o renombrar el filtro `draft`, es un cambio de encargo, no de esta corrida.
