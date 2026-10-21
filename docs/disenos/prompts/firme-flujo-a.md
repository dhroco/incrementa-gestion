# Recorte · firme-flujo-a

> Encargo de Ignacio (arquitecto), 21-oct-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/firma-firme.md` (léelo completo: las decisiones están ahí; este texto las aterriza).
> **Base: `preprod` con `firme-cliente` y `proveedor-nombre-apellidos` ya fusionados** (existen
> `backend/lib/firmeClient.js` y las columnas de nombres y apellidos del proveedor).

## 1. Objetivo

El gerente de Incrementa decidió el **flujo A**: Yerko aprueba el contrato dentro del sistema, el
sistema estampa su rúbrica, y en Firme.cl firma **solo la influencer** (1 firmante por documento,
firma electrónica simple). Este recorte construye ese flujo de punta a punta, del backend a la
pantalla. Al terminar:

- Un contrato de un proveedor con RUT chileno se **aprueba y envía a firma** desde «Firma de
  documento»: se estampa la rúbrica de la empresa, se calcula y guarda el SHA-256 del PDF estampado,
  se envía a Firme con un firmante y el contrato queda **«En proceso de firma»**.
- Cuando la influencer firma, el sistema lo detecta (**webhook** de Firme, **consulta al abrir** la
  pantalla o **barrido** periódico), descarga el PDF firmado y la evidencia, **verifica que la primera
  revisión del firmado coincide con la huella guardada**, lo guarda en el contenedor `firmados` y el
  contrato pasa a **«Firmado»**.
- Rechazo, vencimiento, falta de créditos y RUT inválido tienen estado, mensaje en español y salida
  (**«Reenviar a firma»**).
- Un contrato de un proveedor sin RUT chileno, o con Firme sin configurar, sigue **exactamente** por el
  camino interno de hoy (`signContract`).

## 2. Lo que ya existe y NO cambia de comportamiento

- `backend/lib/firmeClient.js` (cliente HTTP, recorte `firme-cliente`, con `fetch` inyectado). Solo se
  **agregan** dos funciones (sección 8); lo existente no se toca.
- `contractSigningService.signContract` y `listPendingSignature` siguen haciendo lo mismo para el camino
  interno. `listPendingSignature` solo puede **sumar** columnas al `select` y excluir el estado nuevo
  (`in_signature`) del `whereNotIn`; la prueba existente usa un doble de base de datos con
  **exactamente** los métodos `join`, `leftJoin`, `whereNotIn`, `select` y `orderBy`: no uses otros.
- `appendSignaturePage`, `buildSignedGcsPath`, `sha256Hex`, `formatCompanyRut` y
  `formatTimestampSantiago` se **reutilizan**: expórtalos si hace falta, sin cambiar su comportamiento.
- `storageService` (`uploadBuffer`, `downloadBuffer`, `deleteFile`, `getSignedUrl`, `containerFor`):
  el prefijo `contratos-firmados/` va al contenedor `firmados` (en producción tiene **WORM de 5 años**:
  un blob escrito no se puede modificar ni borrar). Solo se **agrega** una función (sección 6).
- `emailService.sendSignedContractEmail` ya omite el envío sin `RESEND_API_KEY` y devuelve
  `{ ok: true, skipped: true }`.

## 3. Modelo de datos (migración)

**Un archivo nuevo**, `backend/migrations/202610220001_firme_signing.js` (`up` y `down`). **No la ejecutes**
(la aplica el arquitecto). Tablas en inglés y singular, columnas `snake_case`.

`firme_signing` (un registro por intento de envío):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk, `gen_random_uuid()` | |
| `draft_document_id` | uuid, fk a `draft_document(id)`, not null | |
| `attempt` | integer, not null | 1, 2, 3… por borrador |
| `status` | text, not null | `sending`, `pending_signature`, `signed`, `rejected`, `expired`, `cancelled`, `send_failed`, `hash_mismatch` (check constraint) |
| `document_id` | uuid, not null | id **reservado** del futuro registro `document` |
| `approved_by` | uuid, fk a `user_profile(id)` | |
| `approved_at` | timestamptz, not null | |
| `signee_first_name`, `signee_last_name`, `signee_maternal_last_name`, `signee_rut`, `signee_email` | text, not null | |
| `stamp_page` | integer | |
| `stamp_x`, `stamp_y` | numeric(6,5) | |
| `stamped_gcs_path` | text | |
| `stamped_sha256` | text | 64 hex |
| `stamped_byte_length` | integer | |
| `firme_transaction_id`, `firme_document_code`, `firme_signee_private_code` | text | se llenan apenas existan |
| `firme_status` | text | último estado crudo de Firme |
| `signee_signed_on` | timestamptz | |
| `signed_gcs_path`, `evidence_gcs_path` | text | |
| `signed_sha256` | text | |
| `verified_at` | timestamptz | |
| `last_error_code`, `last_error_message` | text | |
| `last_checked_at` | timestamptz | |
| `created_at`, `updated_at` | timestamptz, default now() | |

- Índice **único parcial** sobre `(draft_document_id)` donde `status IN ('sending','pending_signature')`.
- Índice sobre `firme_document_code` y sobre `status`.
- Único `(draft_document_id, attempt)`.

`firme_webhook_event`: `id` uuid pk, `received_at` timestamptz default now(), `message_type` text,
`body` jsonb, `firme_signing_id` uuid nullable (fk a `firme_signing`, `on delete set null`).

`draft_document.status` pasa a admitir el valor `in_signature`. Si la columna tiene un check
constraint, ajústalo en la misma migración; si no, no hay nada que hacer.

## 4. Estampado y huella

Archivo nuevo `backend/lib/firmeStamp.js`:

- **Constantes exportadas** de la caja del timbre sobre la **página de firma** (la que agrega
  `appendSignaturePage`, siempre la última): `STAMP_X`, `STAMP_Y` (fracciones de la página medidas desde
  la **esquina superior izquierda**), `STAMP_WIDTH` = 0.33, `STAMP_HEIGHT` = 0.12, y
  `FIRME_PAGE_BASE` = **1** (confirmado en staging el 21-oct: Firme rechaza `page` = 0 con 422 y acepta
  desde 1; la primera página es la 1).
  Elige `STAMP_X` y `STAMP_Y` para que la caja quede en la mitad inferior de la página, sin pisar el texto
  de la constancia (que ocupa la parte alta) y con margen de 5 % a cada borde.
- `stampPositionFor(pageCount)` devuelve `{ page, x, y }` con la base que corresponde
  (`page = pageCount - 1 + FIRME_PAGE_BASE`).
- `drawStampBox(pdfDoc)` (pdf-lib) dibuja en la última página un recuadro gris fino con el rótulo
  «Firma electrónica del proveedor», **usando las mismas constantes**.

Servicio nuevo `backend/services/firmeStampService.js` (o dentro del servicio de la sección 5, si
queda más claro): `buildStampedPdf({ draft, company, signer, template })` →
`{ buffer, sha256, byteLength, stamp }`:

1. Mismo procedimiento que `signContract`: lee el PDF original del borrador, calcula `draft_sha256`;
   re-renderiza `content_snapshot` con las rúbricas de `legal_rep_signature` (los `signatureBlock` con
   `party: 'company'`) usando `buildPdfBytesFromTipTapWithReactPdf`; agrega la constancia con
   `appendSignaturePage` y dibuja la caja del timbre.
2. **Si no hay `content_snapshot`, o falta la rúbrica de algún representante que figura en un
   `signatureBlock` de la empresa, o el re-render falla: no hay PDF y el envío termina con el error
   `RUBRICA_NO_DISPONIBLE`** (HTTP 422, «La empresa no tiene registrada la rúbrica del representante;
   no se puede enviar a firma.»). **No hay el «respaldo sin rúbrica» de `signContract`.**
3. `sha256` y `byteLength` son los de `buffer` tal como se enviará a Firme: **ningún paso posterior puede
   volver a guardar el PDF** (no se reescribe, no se re-comprime).

## 5. Servicio de envío y recepción

Archivo nuevo `backend/services/firmeSigningService.js` con fábrica de dependencias inyectadas:

```js
createFirmeSigningService({ db, storageService, emailService, firmeClient, now, logger } = {})
```

Sin argumentos usa los reales (`firmeClient` = `createFirmeClient()`). Devuelve `getSigningMode`,
`sendToFirme`, `refresh`, `listInSignature`, `handleWebhook`, `sweepPending` y `startSweeper`.

### `getSigningMode(draftDocumentId)`
Devuelve `'firme'` solo si **todo** esto se cumple; si no, `'internal'`: `isFirmeConfigured()`; el
proveedor tiene RUT chileno (`document_type_code = 'RUT'` en su subtipo persona natural o empresa).

### `sendToFirme({ draftDocumentId, signee, approvedByUserProfileId })`

`signee = { firstName, lastName, maternalLastName, documentNumber, email }`. Pasos **en este orden**:

1. **Validar** (sin tocar nada): borrador existe (404 `NOT_FOUND`); modo `firme` (409 `NO_APLICA_FIRME`);
   estado `draft`, o `in_signature` sin intento activo (409 `INVALID_STATUS`); RUT del firmante válido con
   `parseRut` de `backend/utils/rut.js` (422 `RUT_INVALIDO`, «El RUT del firmante no es válido.»);
   `firstName`, `lastName` y `email` no vacíos y `email` con forma de correo (422 `FIRMANTE_INCOMPLETO`,
   que nombra el campo); `maternalLastName` vacío → `'.'`.
2. **Reservar**: inserta `firme_signing` en `sending` con `attempt` = último + 1, `document_id` =
   `crypto.randomUUID()` y los datos del firmante. Si el índice único parcial lo rechaza → 409
   `ENVIO_EN_CURSO` («Este contrato ya tiene un envío a firma en curso.»). Antes de reservar, un intento
   `sending` con más de 10 minutos se pasa a `send_failed` (código `ENVIO_INTERRUMPIDO`) y, si ya tenía
   `firme_document_code`, se intenta `firmeClient.deleteDocument`.
3. **Créditos**: `firmeClient.getQuota()`; si `simple` < 1 → intento `send_failed` con
   `FIRME_NO_CREDITS` y el mensaje del cliente; no se crea nada en Firme.
4. **Estampar** (sección 4) y guardar el PDF estampado en `storageService.uploadBuffer` bajo
   `contratos-en-firma/{companyId}/{supplierId}/{templateCode}/{yyyy}/{mm}/{intentoId}_estampado.pdf`
   (usa `yearMonthInSantiago` y `sanitizeFilePart` como `buildSignedGcsPath`). **Ese prefijo no puede
   empezar con `contratos-firmados/`**: no es WORM. Guarda ruta, `sha256`, `byteLength` y la posición.
5. **Enviar**: `firmeClient.sendForSignature({ pdf, name, signees: [{ ...firmante, signature: stampPosition }] })`.
   `name` = nombre del archivo del borrador sin extensión. Guarda `firme_transaction_id`,
   `firme_document_code` y `firme_signee_private_code` **en cuanto el cliente los devuelva**; si el
   cliente lanza, toma lo que haya en `error.progress` y guárdalo también.
6. **Éxito**: intento a `pending_signature`, `draft_document.status = 'in_signature'` (en una transacción)
   y devuelve `{ ok: true, status: 202, data: { signingId, status: 'pending_signature' } }`.
7. **Fallo de Firme** (`FirmeClientError`): intento a `send_failed` con `last_error_code` y
   `last_error_message` = los del error; si hay `firme_document_code`, intenta
   `firmeClient.deleteDocument` (un fallo de la limpieza se registra y no cambia el resultado). Responde
   `{ ok: false, status, code, message }` con el código del cliente y su mensaje en español
   (`FIRME_NO_CREDITS` → 402; `FIRME_AUTH_FAILED`/`FIRME_NOT_CONFIGURED` → 502; el resto → 502).
   **El borrador queda como estaba** (`draft` o `in_signature`) y se puede reintentar.

### `refresh(signingId)`

Solo actúa sobre intentos `pending_signature` (en cualquier otro estado devuelve el estado actual sin
llamar a Firme). `firmeClient.getDocument(firme_document_code)`:

| Firme `status` | Acción |
|---|---|
| `PENDING_SIGNATURE` (u otro de espera) | actualiza `firme_status` y `last_checked_at`; si pasaron más de **10 días** desde `approved_at` → `expired` |
| `SIGNED` o `COMPLETED` | `finalize` |
| `REJECTED` | intento `rejected` |
| `CANCELLED` o `REFUNDED` | intento `cancelled` |

Un error de red o de Firme al consultar **no cambia el estado**: guarda `last_error_*` y devuelve el
error. Después de `rejected`, `expired` o `cancelled`, el borrador **sigue en `in_signature`**.

### `finalize(intento)` — idempotente

1. `firmeClient.downloadSignedPdf` → `Buffer`. **No guardes ninguna URL.**
2. **Huella**: `sha256(firmado.subarray(0, stamped_byte_length))` debe ser igual a `stamped_sha256`, y
   `firmado.length > stamped_byte_length`, y el firmado debe contener `/ByteRange` (al menos una firma
   digital). Si no: guarda el PDF recibido en `contratos-en-firma/.../{intentoId}_recibido.pdf`, intento
   `hash_mismatch` con `last_error_code = 'HASH_NO_COINCIDE'`, **sin** crear `document` ni cambiar el
   borrador. Se registra con `logger` (nunca el contenido del PDF).
3. `firmeClient.collectEvidence(code, [privateCode])` → `{ logs, signees }`.
4. **Guardar en `firmados`**: PDF en
   `buildSignedGcsPath({ companyId, supplierId, templateCode, docId: document_id })` (**el `document_id`
   reservado, no uno nuevo**, para que la ruta sea estable) y evidencia en el mismo prefijo:
   `{document_id}_evidencia.json` (`{ logs, events, firmeDocumentCode, signedOn, verifiedAt }`) y
   `{document_id}_correo_{n}.pdf` por cada certificado. Usa `uploadBufferOnce` (sección 6).
5. **Registrar** en una transacción: `document` con `id = document_id`, `draft_document_id`,
   `supplier_id`, `company_id`, `template_id`, `client_id`, `contract_overrides`, `gcs_path`, `file_name` =
   `{document_id}_firmado.pdf`, `source: 'generated'`, `signed_at` = fecha de firma de Firme,
   `signed_by` = nombre completo del firmante, `uploaded_by` = `approved_by`,
   `draft_sha256` = huella del PDF original del borrador, `signed_sha256` = huella del firmado;
   intento a `signed` (`verified_at`, `signed_gcs_path`, `evidence_gcs_path`, `signed_sha256`);
   `draft_document.status = 'signed'`. Si ya existe un `document` con ese `id`, no lo vuelvas a insertar.
6. **Correo** a `company.email` con `emailService.sendSignedContractEmail` y el PDF firmado, **después**
   de la transacción; un fallo se registra y no cambia nada.

Si algo falla entre los pasos 4 y 5, el siguiente `refresh` lo retoma sin duplicar.

### `handleWebhook({ rawBody, headers })`

SNS manda el JSON con `Content-Type: text/plain`: la ruta lo lee como texto (sección 7).
Interpreta `Type`:
- **`SubscriptionConfirmation`**: hace `GET` a `SubscribeURL` **solo si** su host cumple
  `^sns\.[a-z0-9-]+\.amazonaws\.com$` y el protocolo es `https:`; si no, lo ignora y lo registra.
- **`Notification`**: `Message` es un JSON en texto. Extrae el código de documento buscando, en este
  orden, `documentCode`, `document_code`, `code`, `document.code`, `data.documentCode`,
  `data.document.code`; y como último recurso cualquier uuid presente que coincida con un
  `firme_document_code` de un intento `pending_signature`. Si lo encuentra, `refresh` de ese intento.
  **No uses ningún otro dato del evento.**
- `UnsubscribeConfirmation` y cualquier otro: solo se registran.
- Guarda **cada** mensaje en `firme_webhook_event` (`body` = el JSON recibido, o `{ raw: <texto> }` si no
  era JSON válido) con el `firme_signing_id` si lo reconoció.
- **Nunca lanza**: devuelve `{ ok: true }` siempre, para que la ruta responda 200.

### `sweepPending()` y `startSweeper()`
`sweepPending` hace `refresh` de los intentos `pending_signature` con `last_checked_at` nulo o de hace
más de 10 minutos (máximo 20 por pasada, uno a la vez), y revisa los `sending` colgados (paso 2 de
`sendToFirme`). `startSweeper({ intervalMs = 600000 })` programa `sweepPending` con `setInterval`
(`unref()` para no retener el proceso) y devuelve una función para detenerlo. **No se inicia al
importar el módulo ni en las pruebas**: solo lo arranca `index.js` si `isFirmeConfigured()`.

### `listInSignature()`
Los intentos más recientes por borrador cuyo borrador está en `in_signature`: proveedor, firmante,
`status`, `last_error_*`, `approved_at`, `attempt`, `id`. Sin `firme_*` internos.

## 6. Almacenamiento: `uploadBufferOnce`

En `backend/services/storageService.js` **agrega** (sin tocar las existentes) `uploadBufferOnce({ buffer,
gcsPath, contentType })`: escribe el blob **sin sobrescribir** (`ifNoneMatch: '*'`). Si ya existe,
descarga el existente y: con la misma huella devuelve `{ created: false }`; con otra lanza un error con
`code = 'STORAGE_CONFLICT'`. Los blobs de `firmados` se escriben **solo** con esta función.

## 7. Rutas

En `backend/app.js`, nuevo parámetro de `createApp`: `firmeSigningService`, **por defecto `null`**
(las pruebas existentes llaman a `createApp` sin él y no deben tocar la base de datos). El servicio real
lo inyecta `backend/index.js`. Con `null`: `signing_mode` de cada item es `'internal'`, el guardia de
`sign` no actúa, y las rutas nuevas responden `503 FIRME_NO_DISPONIBLE`, salvo el webhook, que
responde 200 sin hacer nada.

- `POST /api/webhooks/firme` — **pública**: se declara **antes** de `app.use(requireAuth)`, junto a
  `/health`. Usa `express.text({ type: '*/*', limit: '256kb' })` solo en esa ruta. Responde `200 { ok: true }`
  siempre, también ante error interno (se registra).
- `POST /api/contracts/:id/send-to-firme` — `authorize('sign', 'Contract')`; cuerpo `{ signee }`;
  controlador nuevo `backend/controllers/firmeSigningController.js` que resuelve el perfil como
  `postSign` y llama a `sendToFirme`. Éxito: `202`.
- `GET /api/contracts/in-signature` — `authorize('sign', 'Contract')`; llama a `listInSignature` y
  **antes** hace un `refresh` por cada intento `pending_signature` con `last_checked_at` de hace más de
  1 minuto (en paralelo, máximo 5, ignorando errores: la lista siempre responde).
- `POST /api/contracts/:id/refresh-signature` — `authorize('sign', 'Contract')`; `refresh` del intento
  activo del borrador; devuelve el estado.
- `GET /api/contracts/pending-signature` (existente): cada item suma `signing_mode` (`'firme'` o
  `'internal'`), y la respuesta suma `meta: { email_enabled }` (`true` si hay `RESEND_API_KEY`).
- **`POST /api/contracts/:id/sign` (existente)**: antes de llamar al servicio, si `firmeSigningService`
  está inyectado y `getSigningMode(id)` es `'firme'`, responde `409` con código `USE_FIRME_FLOW` y el
  mensaje «Este contrato se firma con Firme: use «Aprobar y enviar a firma».». Si no hay servicio de
  Firme inyectado, el comportamiento es el de hoy (las pruebas existentes no lo inyectan).
- **MCP** (`mcpTools.mjs`, `firmar_contrato_electronico`): mismo guardia con el mismo código de error,
  solo si el servicio de Firme está disponible; sin él, igual que hoy.
- `backend/index.js`: crea el servicio real, lo pasa a `createApp` y arranca `startSweeper()` si
  `isFirmeConfigured()`.
- Para el rol de la base: `authorize('sign','Contract')` ya existe; no se crean permisos nuevos.

## 8. Cliente de Firme: dos funciones nuevas

En `backend/lib/firmeClient.js`, **sin alterar lo existente** (misma `request`, mismos errores):

- `getQuota()` → `GET /legal-entities/{legalEntityId}/quota` → `{ simple }` (entero; si falta, 0).
- `deleteDocument(documentCode)` → `DELETE /documents/{code}` → `{ deleted: true }`; el cuerpo vacío es
  éxito.

Mismos errores (`FirmeClientError`, `step`, sin el token en mensajes).

## 9. Interfaz

`frontend/src/pages/ContractSigningPage.jsx` y su módulo `frontend/src/api/contractSigningApi.js`
(agrega `sendToFirme`, `fetchInSignature`, `refreshSignature`). Mensajes en español, estilos del
sistema de diseño (`openspec/config.yaml`), íconos de MUI Outlined, sin librerías nuevas.

- **Dos pestañas** arriba de la tabla: **«Por aprobar»** (la actual) y **«En firma»**.
- **Por aprobar.** Si `row.signing_mode === 'firme'`, el modal es: datos del firmante (nombres, apellido
  paterno, apellido materno, RUT, correo) **prellenados con lo que guarda el proveedor** y editables (lo
  que se corrija vale solo para este envío y queda en el intento; no cambia el proveedor), el texto «Al confirmar, usted aprueba
  este contrato en representación de **{empresa}**; su rúbrica quedará estampada y se enviará a
  **{correo}** para su firma electrónica.», la casilla «He revisado el contrato y autorizo su envío a
  firma» y el botón **«Aprobar y enviar a firma»** (**«Enviando…»** mientras espera). Éxito: el contrato
  sale de la lista y se muestra «Contrato aprobado y enviado a firma.» durante 8 segundos. Con error,
  el mensaje del backend dentro del modal. Si `signing_mode === 'internal'`, el modal es el de hoy.
  Para eso, `pending-signature` devuelve también, por item,
  `signee_suggestion: { first_names, last_name, maternal_last_name, document_number, email }`: para un
  proveedor **persona natural** salen de `supplier_persona_natural` (`first_names`, `last_name`,
  `maternal_last_name`, `document_number`) y de `supplier.email`; para una **empresa**, **del representante
  legal**: `rep_first_names`, `rep_last_name`, `rep_maternal_last_name`, `rep_document_number` y
  `supplier.email`. Se arman sumando columnas al `select` de `listPendingSignature` (solo con los métodos
  del doble de la prueba existente). Si falta alguna parte, la caja queda vacía y hay que llenarla para poder
  enviar.
- **En firma.** Tabla: Proveedor, Firmante, Enviado el, Estado (chip), Acciones. Estados y chips:
  `pending_signature` «En proceso de firma», `sending` «Enviando a firma…», `rejected` «Firma
  rechazada», `expired` «Firma vencida», `cancelled` «Firma cancelada», `send_failed` «Envío fallido»,
  `hash_mismatch` «Requiere revisión». Acciones: **«Actualizar estado»** (siempre, salvo `sending`),
  **«Reenviar a firma»** (solo `rejected`, `expired`, `cancelled`, `send_failed`: abre el mismo modal
  con los datos del firmante anterior), **«Ver PDF»**. Si hay `last_error_message`, se muestra debajo del
  chip. Al entrar a la pestaña se carga `in-signature`.
- **Listado de contratos** (`ContractsListPage.jsx`): el chip distingue «Firmado» (`signed`),
  «En proceso de firma» (`in_signature`) y «En proceso» (el resto). Si la página ya recibe más detalle
  del estado de la firma, no lo uses: basta con `status`.
- `contractsQueryService`: `normalizeStatus` admite también `in_signature`; el filtro de estado de la
  pantalla de contratos suma la opción «En proceso de firma».

## 10. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`,
  `frontend/public/staticwebapp.config.json`. **No agregues variables de entorno ni de `config.js`**:
  el camino de Firme se activa con las tres `FIRME_*` que ya existen.
- **No ejecutes** `knex`, migraciones ni seeds. **Ninguna prueba ni comando llama a Firme, a Azure ni a la
  base de datos real**: todo con dobles (`fetchImpl`, `firmeClient`, `db`, `storageService`).
- Sin dependencias nuevas (usa `fetch` nativo, `pdf-lib` y lo que ya está instalado).
- Mensajes de error al usuario en español. Nada de `console.log` con datos del firmante, tokens ni
  contenido de PDFs: usa el patrón de log de los servicios existentes y solo códigos.
- Documentación y commits en español.

## 11. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente.** Si cualquier
prueba existente falla, **no la ajustes: consulta a la mesa.** Las de `signContract`, `listPendingSignature`,
`contractSigningApi`, `contractsQueryService`, `storageService`, `firmeClient`, `mcpServer` y `rut` deben
seguir en verde sin tocarlas.

## 12. Pruebas nuevas

**Todas en archivos nuevos** (backend con `node --test` y dobles; frontend con Vitest y Testing Library,
como las pruebas existentes del frontend):

- `backend/test/firmeStamp.test.js`: `stampPositionFor` respeta `FIRME_PAGE_BASE`; la caja queda dentro de
  la página con margen; `drawStampBox` dibuja en la **última** página del PDF (`pdf-lib` real) y el
  recuadro coincide con `STAMP_X/Y/WIDTH/HEIGHT`.
- `backend/test/firmeSigningService.send.test.js`: **camino feliz** (el orden de llamadas: validar →
  reservar → créditos → estampar y guardar → enviar → pasar a `pending_signature`; el PDF enviado a
  Firme es **byte a byte** el guardado en `contratos-en-firma/`, su SHA-256 y largo son los guardados;
  el firmante enviado lleva el materno `.` si venía vacío); **RUT inválido** (`RUT_INVALIDO`, sin
  llamadas a Firme ni escritura); **firmante incompleto**; **sin créditos** (`getQuota` 0 →
  `send_failed`, nada creado en Firme); **`FIRME_NO_CREDITS` en `complete`** (422 del cliente: intento
  `send_failed`, se llama `deleteDocument` con el código guardado, el borrador queda como estaba);
  **fallo a medias** (el cliente lanza con `progress`: se guarda lo creado); **doble envío**
  (`ENVIO_EN_CURSO`); **intento `sending` colgado** (> 10 min pasa a `send_failed`); **sin rúbrica**
  (`RUBRICA_NO_DISPONIBLE`, no se envía nada); **reenvío** (intento 2 tras `rejected`); **modo interno**
  (proveedor con RFC → `NO_APLICA_FIRME`).
- `backend/test/firmeSigningService.finalize.test.js`: **firmado válido** (PDF firmado = bytes estampados
  + una actualización incremental con `/ByteRange`: se escribe en `contratos-firmados/…` con el
  `document_id` reservado, se guarda la evidencia al lado, se crea `document`, el intento pasa a
  `signed`, el borrador a `signed`, `signed_sha256` es la huella del firmado, `draft_sha256` la del
  original); **huella distinta** (el firmado no parte del estampado → `hash_mismatch`, el recibido se guarda
  en `contratos-en-firma/`, **no** se crea `document`); **sin `/ByteRange`**; **idempotencia** (si la ruta
  ya existe con la misma huella, no falla y no duplica `document`; con otra huella →
  `STORAGE_CONFLICT`); **reanudación** (falló entre guardar y registrar: el segundo `refresh` completa);
  **correo** (se envía con el firmado; `skipped` o un error no cambian el estado); la URL de descarga **no**
  aparece guardada en ninguna columna.
- `backend/test/firmeSigningService.refresh.test.js`: la tabla de la sección 5 (`REJECTED` → `rejected`,
  `CANCELLED` → `cancelled`, pendiente de más de 10 días → `expired`, error de red no cambia el
  estado), `sweepPending` (solo los que toca, tope de 20), y que `startSweeper` no arranca solo.
- `backend/test/firmeWebhook.test.js`: `SubscriptionConfirmation` con host de SNS (se hace el `GET`) y
  con host ajeno o `http:` (**no** se hace); `Notification` con el código en cada una de las formas de
  la sección 5 y con un uuid suelto; con un código desconocido no pasa nada y se registra; todos los
  mensajes quedan en `firme_webhook_event`; cuerpo que no es JSON; **la ruta** (con `supertest` o el
  patrón de las pruebas de API existentes) recibe `text/plain`, **no pide autenticación** y responde 200
  también cuando el servicio lanza.
- `backend/test/firmeSigningApi.test.js`: `send-to-firme` (202, errores del servicio con su código y
  estado, exige permiso `sign`), `in-signature`, `refresh-signature`, `pending-signature` con
  `signing_mode` y `meta.email_enabled`, `sign` y la herramienta MCP responden `USE_FIRME_FLOW` cuando
  el modo es `firme` y siguen igual cuando no hay servicio de Firme inyectado.
- `backend/test/firmeClient.extension.test.js`: `getQuota` y `deleteDocument` (URL, método, `Authorization`,
  errores, el token nunca en mensajes).
- `backend/test/storageService.once.test.js`: `uploadBufferOnce` (crea; existe con la misma huella →
  `created: false`; existe con otra → `STORAGE_CONFLICT`; usa `ifNoneMatch`).
- `backend/test/firmeSigningMigration.test.js`: la migración exporta `up` y `down`, define las columnas,
  el check de estados, el índice único parcial y el único `(draft_document_id, attempt)` (con un doble
  de `knex.schema`, sin base de datos).
- `frontend/src/pages/ContractSigningPage.firme.test.jsx`: las dos pestañas; el modal de Firme con datos
  prellenados y la división sugerida del nombre; «Aprobar y enviar a firma» deshabilitado hasta marcar la
  casilla; éxito (mensaje y la fila sale de la lista); error del backend dentro del modal; la pestaña «En
  firma» con cada chip; «Reenviar a firma» solo en `rejected`/`expired`/`cancelled`/`send_failed`;
  «Actualizar estado» llama al refresh; un item `internal` sigue mostrando el modal de hoy.
- `frontend/src/pages/ContractsListPage.firma.test.jsx`: el chip «En proceso de firma» y el filtro nuevo.

## 13. Puntos de atención

- Las decisiones de producto de David (21-oct) ya están aplicadas en este prompt y en el diseño. Si ves
  una contradicción entre ambos, consulta a la mesa.
- En producción `firmados` tiene WORM: **nunca** escribas allí un PDF que no sea el firmado y verificado, ni
  la evidencia, y solo con `uploadBufferOnce`. El PDF estampado, el recibido con huella distinta y
  cualquier intermedio van a `contratos-en-firma/` (contenedor `documentos`).
- El backend escala a 0 réplicas (≈ 40 s de arranque en frío): por eso `sendToFirme` es síncrono, el
  webhook responde rápido, y `refresh` cubre un aviso perdido. No agregues trabajos en segundo plano
  posteriores a la respuesta.
- `FIRME_PAGE_BASE`: si en tus pruebas ves que `page` se envía con otra base que la de la constante,
  es un error tuyo; la constante manda.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test` y
  `cd frontend && npm run lint`. Todas en verde.
