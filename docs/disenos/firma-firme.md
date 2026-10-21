# Dominio · firma electrónica con Firme.cl

> Diseño de Ignacio (arquitecto). Versión inicial 28-sep-2026; **reescrito el 21-oct-2026 para el flujo A**
> (decisión del gerente de Incrementa, 19-oct, vía David). Las decisiones de producto que David confirmó
> el 21-oct están marcadas como tales.

## Qué es

Cómo un contrato generado en incrementa se aprueba dentro del sistema, se envía a firma electrónica
simple (FES) en Firme.cl para que firme **solo la influencer**, y cómo el sistema recoge, verifica y
guarda el PDF firmado con su evidencia. Antecedentes: `docs/propuesta-firma-electronica.html` y
`docs/pauta-reunion-firme.html`.

Hoy la firma es interna: `POST /api/contracts/:id/sign` (`services/contractSigningService.js`) vuelve
a renderizar el PDF con la rúbrica guardada del representante (`legal_rep_signature`), le agrega una
«constancia» con los hashes, lo guarda en `contratos-firmados/`, marca el borrador `signed` y envía un
correo. La influencer firma fuera del sistema. Ese camino **se conserva** para lo que Firme no cubre
(ver «Quién firma por Firme»).

## Decisión vigente: flujo A (19-oct)

- **Yerko no firma en Firme.** Aprueba el contrato dentro del sistema y el sistema estampa su rúbrica en
  el PDF. Motivo del gerente: que los documentos no lleguen a su correo.
- **En Firme firma solo la influencer**: 1 firmante por documento, FES, ≈ 50 firmas al mes.
- Precio: $800 por firma con IVA, créditos prepagados, sin costo de integración (aprobado el 10-oct).
- Reemplaza al flujo B (dos firmantes, Yerko primero, dos cajas de timbre). Ya no hay firma secuencial ni
  segunda caja de timbre.

## Lo que se sabe de la API de Firme

Probado el 28-sep en staging (`https://staging.api.documentos.firme.cl`) y leído el 21-oct del
`openapi.json` actual (versión `v0.0.143-pre`).

**Flujo de envío** (ya implementado en `backend/lib/firmeClient.js`, `sendForSignature`):
`POST /transactions` → `POST /documents` → `PUT` del PDF a S3 → `PUT /documents/{code}/upload` →
`PUT /documents/{code}` (`CONTRATOS`, `Contrato de Prestación de Servicios`, `SIMPLE`) →
`POST /documents/{code}/signees` + `POST /documents/{code}/signatures` →
`POST /transactions/{id}/complete` (`CREDITS`).

**Lectura**: `GET /documents/{code}` (`status`, `signedOn`, firmantes), `GET /documents/{code}/logs`,
`.../signees/{privateCode}/emails/events`, `.../emails/{hub_email_id}/certificate`,
`GET /documents/{code}/files/SIGNED_DOCUMENT` (URL firmada de ≈ 1 h).

**Webhooks: existen.** `POST /webhooks/subscriptions` con `{ legalEntityId, url, eventTypes }`. Firme
usa AWS SNS: tras crear la suscripción, SNS llama al endpoint con una solicitud de confirmación y el
servidor debe hacer `GET` a la `SubscribeURL`. La URL tiene que ser HTTPS y pública. Eventos útiles:
`document.signed`, `document.completed`, `document.status_changed`, `signature.signed`,
`signature.rejected`, `signature.expired`. **No se documenta la forma del cuerpo de cada evento**:
hay que capturarla en staging (ver «Recepción»).

**Estados del documento** (`DocumentStatus`): `PENDING`, `UPLOADED`, `DRAFT`, `PENDING_SIGNATURE`,
`SIGNED`, `PENDING_NOTARY_SIGNATURE`, `NOTARIZED`, `MISSING_ATTACHMENT`, `REPAIR`, `REJECTED`,
`CANCELLED`, `COMPLETED`, `REFUNDED`. Los que usa el flujo: `PENDING_SIGNATURE`, `SIGNED`/`COMPLETED`
(firmado), `REJECTED`, `CANCELLED`, `REFUNDED`.

**Otros datos útiles**
- `GET /legal-entities/{id}/quota` devuelve los créditos por tipo (`simple`): sirve para avisar
  «no quedan créditos» **antes** de gastar el envío.
- `DELETE /documents/{code}` borra un documento en `DRAFT` y devuelve los créditos consumidos: sirve
  para limpiar un envío que falló a medias.
- Solo RUT chileno (para pruebas, `11.111.111-1`). Apellido materno obligatorio (si no hay, `.`).
- La evidencia no trae la IP del firmante. El enlace de firma expira a los 10 días.
- La firma es PAdES incremental (`adbe.pkcs7.detached`, SHA-256): el PDF original queda intacto como
  primera revisión (verificado sobre `FRM-15108.pdf`, 28-sep).

**Base de `page`: 1.** El `openapi.json` actual dice que `page` de `POST .../signatures` parte en **1**,
y la prueba del 28-sep usó base 0. **Confirmado en staging el 21-oct** (sin gastar créditos): `page` = 0
da 422 («debe ser mayor o igual a 1») y 1 y 2 se aceptan. `firmeClient.js` entrega `page` tal como lo
recibe (valida solo entero ≥ 0), así que no necesita cambios: la base la fija una constante,
`FIRME_PAGE_BASE = 1`, en `backend/lib/firmeStamp.js`. El texto del recorte `firme-cliente` que habla de
base 0 quedó desactualizado; corregirlo (y endurecer la validación a ≥ 1) requeriría modificar
`firmeClient.test.js` y se hace aparte, con autorización de David.

## Quién firma por Firme

Hay firma por Firme cuando el proveedor tiene **RUT chileno** y Firme está configurado
(`isFirmeConfigured()`: las tres variables `FIRME_*`). Entonces el firmante es:

- **Persona natural:** el propio proveedor (nombres y apellidos, RUT, `supplier.email`).
- **Empresa:** su **representante legal** (nombres y apellidos del representante, `rep_document_number`)
  con el `supplier.email` de contacto. *(Decidido por David, 21-oct.)*

Si el proveedor no tiene RUT chileno (los mexicanos, que por ahora no se consideran) o Firme no está
configurado, **sigue el camino interno actual sin cambios** (`signContract`: rúbrica + constancia +
correo). *(Decidido por David, 21-oct: no deberían existir proveedores sin RUT chileno salvo los mexicanos,
y esos quedan fuera.)*

**Datos del firmante.** Firme pide nombres, apellido paterno y apellido materno por separado, y el
proveedor guardaba un solo `full_name`. *(Decidido por David, 21-oct: opción B.)* Un recorte previo,
`proveedor-nombre-apellidos`, agrega al proveedor persona natural `first_names`, `last_name` y
`maternal_last_name`, y a la empresa `rep_first_names`, `rep_last_name` y `rep_maternal_last_name` (del
representante legal). El formulario del proveedor los pide por separado; `full_name` y `nombre_rep_legal`
**siguen existiendo** (las plantillas y pantallas los usan) y se **componen** a partir de las partes. Los
proveedores existentes se rellenan con una división automática, con respaldo previo. La API y el MCP
siguen aceptando solo el nombre completo y derivan las partes. Al enviar a firma, el modal muestra esos
datos prellenados y editables (lo que se corrija vale para ese envío; no cambia al proveedor).

## Ciclo de vida

Estado del borrador (`draft_document.status`, texto):

```
draft ──aprobar y enviar──▶ in_signature ──firma verificada──▶ signed
                               │
                               ├─ rechazo / vencimiento / error ──▶ sigue in_signature, con detalle
                               │      (la persona usa «Reenviar a firma»: intento nuevo)
                               └─ huella no coincide ──▶ sigue in_signature, «Requiere revisión»
```

Detalle del envío en una tabla nueva, `firme_signing` (un registro por intento):

| Estado del intento (`status`) | Qué significa | Qué ve la persona |
|---|---|---|
| `sending` | Se está armando y enviando a Firme | «Enviando a firma…» |
| `pending_signature` | En Firme esperando a la influencer | «En proceso de firma» |
| `signed` | Firmado, huella verificada y guardado | «Firmado» |
| `rejected` | La influencer rechazó | «Firma rechazada» + «Reenviar a firma» |
| `expired` | El enlace venció sin firmar | «Firma vencida» + «Reenviar a firma» |
| `cancelled` | Cancelado en Firme | «Firma cancelada» + «Reenviar a firma» |
| `send_failed` | Falló el envío (créditos, RUT, red…) | mensaje del error + «Reenviar a firma» |
| `hash_mismatch` | El firmado no parte del PDF aprobado | «Requiere revisión» (sin botón; avisar a Ignacio) |

Un contrato tiene **a lo más un intento activo** (`sending` o `pending_signature`): índice único parcial
sobre `draft_document_id`. Cada reenvío crea un intento nuevo (`attempt + 1`) y conserva el historial.

## Aprobar y enviar (paso a paso)

`POST /api/contracts/:id/send-to-firme` (permiso `sign` sobre `Contract`), cuerpo
`{ signee: { firstName, lastName, maternalLastName, documentNumber, email } }`. Es **síncrono** (≈ 10
llamadas a Firme: unos segundos); no usa trabajos en segundo plano porque el backend escala a 0 réplicas
y un proceso posterior a la respuesta podría cortarse.

1. **Validar:** el borrador existe, está en `draft` o en `in_signature` sin intento activo, el proveedor
   califica (RUT chileno), Firme está configurado, el RUT del firmante pasa módulo 11 (`backend/utils/rut.js`, `parseRut`), el correo es válido, nombres no vacíos (materno vacío → `.`).
   Errores: `RUT_INVALIDO`, `FIRMANTE_INCOMPLETO`, `FIRME_NO_CONFIGURADO`, `INVALID_STATUS`.
2. **Reservar el intento:** inserta `firme_signing` en `sending` con un `document_id` **reservado**
   (uuid del futuro registro `document`). El índice único corta el doble clic (409 `ENVIO_EN_CURSO`).
3. **Revisar créditos:** `getQuota()` (`simple` > 0). Sin créditos → `send_failed` con
   `FIRME_NO_CREDITS` sin crear nada en Firme.
4. **Estampar:** renderiza el PDF desde `content_snapshot` con la rúbrica de la empresa
   (`legal_rep_signature`), igual que hoy `signContract`, y le agrega la **página de firma** (la actual
   «constancia» + la caja reservada del timbre). Si el borrador no tiene `content_snapshot` o falta la
   rúbrica de un representante que figura en un `signatureBlock`, **no se envía**: error
   `RUBRICA_NO_DISPONIBLE` («La empresa no tiene registrada la rúbrica del representante»).
   Es decisión de diseño: enviar sin rúbrica dejaría a Firme firmando un contrato incompleto.
5. **Huella:** calcula `sha256` y `byte_length` de **esos bytes exactos** y los guarda en el intento.
   Guarda el PDF estampado en `documentos` bajo `contratos-en-firma/{companyId}/{supplierId}/{templateCode}/{yyyy}/{mm}/{intentoId}_estampado.pdf`
   (prefijo distinto de `contratos-firmados/`: no es WORM ni definitivo).
6. **Enviar a Firme:** `sendForSignature` con 1 firmante y la posición del timbre (abajo).
   Guarda `firme_transaction_id`, `firme_document_code` y el `privateCode` del firmante en cuanto
   existan (también cuando el envío falla a medias: vienen en `error.progress`).
7. **Resultado:** el intento pasa a `pending_signature` y el borrador a `in_signature`; responde
   `202 { signingId, status }`. Si falla un paso de Firme: intenta `deleteDocument` (best effort, solo
   si ya existe el documento) y deja `send_failed` con código y mensaje en español.
8. Un intento `sending` con más de 10 minutos se considera caído: la próxima consulta lo pasa a
   `send_failed` (y limpia en Firme si hay `firme_document_code`).

**Posición del timbre.** El timbre mide ≈ 33 % del ancho × 12 % del alto y no trae el RUT. Se ubica en
la **página de firma que agrega el sistema como última página** (coordenadas conocidas, sin tocar las
plantillas): constantes en `backend/lib/firmeStamp.js` (`page` = última página del PDF estampado, `x`, `y`
como fracciones de la esquina superior izquierda), y la misma constante dibuja el recuadro rotulado
«Firma electrónica del proveedor» y se envía a Firme. *(Decidido por David, 21-oct: el timbre de la
influencer va en la última página; junto a su bloque de firma dentro del cuerpo exigiría medir la posición
del `signatureBlock` al renderizar y sería otro recorte.)*

## Recepción: webhook, consulta y respaldo

La verdad siempre se pregunta a Firme con la API autenticada; **el webhook solo avisa**.

1. **Webhook** `POST /api/webhooks/firme`, **público** (se declara antes de `requireAuth`, como `/health`)
   porque lo llama AWS SNS.
   - Tipo `SubscriptionConfirmation`: hace `GET` a `SubscribeURL` **solo si** el host es
     `sns.<región>.amazonaws.com` (evita que alguien nos haga llamar URLs arbitrarias).
   - Tipo `Notification`: extrae el código del documento del `Message` (JSON en texto; busca
     `documentCode`, `document_code`, `code` o `document.code`, y como último recurso un uuid que
     coincida con un `firme_document_code` nuestro). Si lo reconoce, **refresca ese intento** (punto 2).
     No confía en el contenido del evento para nada más.
   - Guarda cada mensaje recibido en `firme_webhook_event` (cuerpo crudo, tipo, fecha, `firme_signing_id`
     si lo reconoció). Sirve de auditoría y para aprender la forma real de los eventos.
   - Responde siempre `200` rápido (SNS reintenta en fallos; con escala a 0 y ≈ 40 s de arranque en
     frío el primer intento puede perderse, por eso existen los puntos 2 y 3).
2. **Consulta al abrir** (`firmeSigningService.refresh(signingId)`): al listar «En firma» y con el botón
   «Actualizar estado» consulta `GET /documents/{code}`. Es lo que cubre un webhook perdido.
3. **Barrido en el proceso** (`setInterval`, cada 10 minutos mientras la réplica esté viva) que refresca
   los intentos `pending_signature` con más de 10 minutos sin revisar. **Riesgo residual:** si el
   webhook se pierde y nadie abre la pantalla, la firma se recoge tarde, **no se pierde** (Firme conserva
   el documento y las URL se piden frescas). Si David quiere un respaldo sin depender del tráfico, es
   un Container Apps Job con un `POST` interno: infraestructura de ustedes, fuera de este recorte.

**Qué hace `refresh`** según el estado que informa Firme:

| Firme | Acción |
|---|---|
| `PENDING_SIGNATURE` | solo actualiza `last_checked_at` |
| `SIGNED` o `COMPLETED` | **finaliza** (abajo) |
| `REJECTED` | intento `rejected` |
| `CANCELLED` / `REFUNDED` | intento `cancelled` |
| sigue pendiente y pasaron > 10 días del envío | intento `expired` |

El vencimiento por tiempo es un respaldo: si Firme informa el vencimiento (`signature.expired` o un
estado), se usa eso. Hay que confirmar en staging cómo se ve un vencimiento real.

## Finalizar (firmado)

1. `downloadSignedPdf` → bytes. **Nunca se guarda la URL**, solo los bytes.
2. **Verificar la huella:** `sha256(firmado[0 .. byte_length])` debe ser igual al `sha256` guardado al
   enviar (la primera revisión del PDF firmado es exactamente lo que aprobó Yerko). Además el PDF
   recibido debe contener al menos una firma digital (`/ByteRange`). Si no coincide: el PDF recibido se
   guarda en `documentos` (`contratos-en-firma/.../recibido_*.pdf`, para investigar), el intento queda
   `hash_mismatch` y **no** se crea el contrato firmado.
3. **Evidencia:** `collectEvidence` (logs, eventos de correo, certificados de correo).
4. **Guardar en `firmados`** (en prod ese contenedor tiene WORM de 5 años: se escribe una sola vez):
   `contratos-firmados/{companyId}/{supplierId}/{templateCode}/{yyyy}/{mm}/{document_id}_firmado.pdf`
   (`buildSignedGcsPath` con el `document_id` **reservado**, por eso la ruta es estable) y la evidencia
   junto a él: `..._evidencia.json` y `..._correo_{n}.pdf`. Si la escritura falla porque el blob ya
   existe, se compara su huella: igual → se sigue (reintento seguro); distinta → error y no se toca.
5. **Registrar** en una transacción: `document` (con `id = document_id`, `source: 'generated'`,
   `signed_at` = fecha de firma de Firme, `signed_by` = nombre del firmante, `draft_sha256` = huella del
   PDF original del borrador, `signed_sha256` = huella del PDF firmado), el intento a `signed` con
   `verified_at`, y `draft_document.status = 'signed'`.
6. **Correo** de contrato firmado a la empresa **solo si hay Resend** (`emailService`, que ya omite el
   envío sin `RESEND_API_KEY`); un fallo de correo no deshace nada.

Si algo falla entre los pasos 4 y 5, el siguiente `refresh` reanuda: todo es idempotente porque la ruta
y el `document_id` ya están reservados.

## Modelo de datos

Migración nueva (`202610220001_firme_signing.js`; la aplica el arquitecto, no la corrida):

- `firme_signing`: `id uuid pk`, `draft_document_id uuid fk`, `attempt int`, `status text`,
  `document_id uuid` (reservado), `approved_by uuid` (→ `user_profile`), `approved_at timestamptz`,
  `signee_first_name`, `signee_last_name`, `signee_maternal_last_name`, `signee_rut`, `signee_email`,
  `stamp_page int`, `stamp_x numeric`, `stamp_y numeric`,
  `stamped_gcs_path text`, `stamped_sha256 text`, `stamped_byte_length int`,
  `firme_transaction_id text`, `firme_document_code text`, `firme_signee_private_code text`,
  `firme_status text`, `signee_signed_on timestamptz`,
  `signed_gcs_path text`, `signed_sha256 text`, `verified_at timestamptz`, `evidence_gcs_path text`,
  `last_error_code text`, `last_error_message text`, `last_checked_at timestamptz`,
  `created_at`, `updated_at`. Índice único parcial `(draft_document_id) where status in ('sending','pending_signature')`.
- `firme_webhook_event`: `id uuid pk`, `received_at timestamptz`, `message_type text`,
  `body jsonb`, `firme_signing_id uuid null`.
- Tablas en inglés y singular; columnas `snake_case`. Las columnas `gcs_path` heredan el nombre del
  resto del sistema.

## Interfaz

**«Firma de documento»** (`ContractSigningPage.jsx`) con dos pestañas:

- **Por aprobar** (lo de hoy). Para un contrato con firma por Firme, el modal pasa a: datos del
  firmante prellenados y editables; texto «Al confirmar, usted aprueba este contrato en representación
  de {empresa}; su rúbrica quedará estampada y se enviará a {correo del firmante} para su firma
  electrónica»; casilla de revisión; botón **«Aprobar y enviar a firma»**. Éxito: «Contrato aprobado y
  enviado a firma.» Para un contrato por el camino interno, el modal es el de hoy (con las correcciones
  del recorte `firma-mensajes`).
- **En firma**: tabla con proveedor, firmante, enviado el, estado (chip) y acciones **Actualizar
  estado**, **Reenviar a firma** (solo `rejected`, `expired`, `cancelled`, `send_failed`) y **Ver PDF**.
  Los estados con detalle de error muestran el mensaje en español.

**Contratos** (`ContractsListPage.jsx`): el chip distingue «Firmado», «En proceso de firma», «Firma
rechazada», «Firma vencida», «Requiere revisión» y «En proceso» (borrador sin enviar).

**MCP:** `firmar_contrato_electronico` responde `USE_FIRME_FLOW` si el contrato califica para Firme
(no se puede saltar la firma de la influencer por esa vía).

## Variables de entorno

Ninguna nueva. Ya existen en `config.js` (ver `backend/config.js`): `FIRME_API_URL`,
`FIRME_API_TOKEN`, `FIRME_LEGAL_ENTITY_ID`. Las cargan David y la sesión de la nube en Key Vault y en
las Container Apps (`FIRME-API-TOKEN` como secreto). El camino por Firme se activa solo si las tres
tienen valor; sin ellas, todo sigue por el camino interno.

Pasos de operación (David, una vez por ambiente, no los hace la corrida):
1. Cargar las tres variables.
2. Registrar el webhook: `POST {FIRME_API_URL}/webhooks/subscriptions` con
   `{ legalEntityId, url: "https://<backend>/api/webhooks/firme", eventTypes: ["document.signed", "document.completed", "document.status_changed", "signature.signed", "signature.rejected", "signature.expired"] }`
   y comprobar `GET /webhooks/subscriptions/{id}/status` → `isConfirmed: true`.
3. Pedir a Firme (Juan Puelpan): IPs de salida de SNS si hay lista de permitidos, y la forma de los
   eventos.

## Antes de lanzar (Ignacio y David)

1. ~~**Base de `page`**~~: hecho el 21-oct (base 1; ver arriba).
2. **Aprobación de David** de este diseño (y lo que quede por confirmar).
3. Migración aplicada en pre-prod antes del deploy del código que la usa.

## Aceptación en staging (después del merge; David e Ignacio)

Las pruebas de la corrida no llaman a Firme. Esto se comprueba a mano en pre-prod con RUT `11.111.111-1`:
1. Aprobar un contrato → «En proceso de firma»; en Firme aparece 1 firmante y el timbre en la caja.
2. Firmar con el enlace → el webhook (o «Actualizar estado») lo pasa a «Firmado».
3. La **huella coincide**; el PDF en `firmados` abre y trae la firma; hay evidencia junto a él.
4. Rechazar otro envío → «Firma rechazada» → «Reenviar a firma» crea intento 2.
5. Sin créditos (o con una cuenta sin saldo) → «No quedan créditos…» y no queda documento colgado en Firme.
6. Reenviar el mismo webhook dos veces no duplica el `document`.
7. Con la réplica en 0, la confirmación del webhook se completa tras el arranque en frío.
8. Un contrato de proveedor sin RUT chileno sigue por el camino interno.

## Qué queda fuera

- Extranjeros sin RUT en Firme (decisión del 28-sep, hasta que Firme lo soporte).
- Firma del representante en Firme (flujo B) y firma automática del representante.
- Timbre junto al bloque de firma del cuerpo del contrato (requiere medir posiciones).
- Recordatorios al firmante (el endpoint `resend` existe) y cancelación manual de un envío.
- Respaldo por Container Apps Job.
- Variables o infraestructura en Azure: no se tocan `infra/azure/**`, workflows ni Key Vault.

## Recortes

En `firma-firme.recortes.yaml`, en este orden: `firme-cliente` (hecho), `proveedor-nombre-apellidos`
(nombres y apellidos separados en el proveedor), `firme-flujo-a` (todo el flujo A, backend y pantalla) y
`firma-mensajes` (dos correcciones de mensajes, después del flujo). Las migraciones se aplican en este
orden: `202610210001_supplier_name_parts.js` y luego `202610220001_firme_signing.js`.
