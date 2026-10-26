# Dominio · firma electrónica con Firme.cl

> Diseño de Ignacio (arquitecto). Versión inicial 28-sep-2026; **reescrito el 21-oct-2026 para el flujo A**
> (decisión del gerente de Incrementa, 19-oct, vía David). Las decisiones de producto que David confirmó
> el 21-oct están marcadas como tales. **Diseño del flujo A aprobado por David el 26-oct** (decisiones al final).

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

**Webhooks: existen** (Firme, 21-oct; precisado el 26-oct con la guía v2.1). `POST /webhooks/subscriptions`
con `{ legalEntityId, url, eventTypes }`: **exige rol ADMIN en la empresa** (el token de producción lo genera
el administrador de la cuenta de Firme). Si ya existe una suscripción con la misma URL y otra configuración
responde **412**: hay que borrarla antes (`DELETE /webhooks/subscriptions/{id}`). Firme entrega por AWS SNS
(`us-east-1`): tras crear la suscripción SNS llama al endpoint con una `SubscriptionConfirmation` y el
servidor hace `GET` a la `SubscribeURL`; además hay que **validar la firma SNS de cada mensaje** y comprobar
que `SigningCertURL` sea de `*.amazonaws.com`. La URL tiene que ser HTTPS y pública.
**Payload:** `event_id` (UUID único: la clave de idempotencia), `event_type`, `resource_id` y
`data.document_code` / `data.status`. **Eventos que sí se emiten:** `document.signed`,
`document.status_changed`, `signature.signed` y `signature.rejected`. `signature.expired` existe pero
**todavía no se emite**, así que se mantiene la consulta de respaldo cada 15 a 30 minutos. En SIMPLE
`signature.signed` llega con `signature_method: "fea"` (firma por FirmeHub): **no se filtra por «simple»**.

**Estados del documento** (`DocumentStatus`): `PENDING`, `UPLOADED`, `DRAFT`, `PENDING_SIGNATURE`,
`SIGNED`, `PENDING_NOTARY_SIGNATURE`, `NOTARIZED`, `MISSING_ATTACHMENT`, `REPAIR`, `REJECTED`,
`CANCELLED`, `COMPLETED`, `REFUNDED`. Los que usa el flujo: `PENDING_SIGNATURE`, `SIGNED`/`COMPLETED`
(firmado), `REJECTED`, `CANCELLED`, `REFUNDED`.

**Otros datos útiles**
- `GET /legal-entities/{id}/quota` devuelve los créditos por tipo (`simple`): sirve para avisar
  «no quedan créditos» **antes** de gastar el envío.
- `DELETE /documents/{code}` borra un documento en `DRAFT` y devuelve los créditos consumidos: sirve
  para limpiar un envío que falló a medias.
- Solo RUT chileno (para pruebas, `11.111.111-1`); los extranjeros siguen fuera de la API. Apellido
  materno obligatorio (si no hay, `.`); **pasa a opcional en la segunda quincena de noviembre**, y hasta
  entonces se manda `.` (una constante, `MATERNAL_PLACEHOLDER`, para cambiarlo después).
- **Cobro de créditos: se descuenta AL COMPLETAR la transacción** (paso 10, pago con `CREDITS`), no al cargar
  el documento. **Confirmado en staging el 27-oct** con `firme-resend-check.mjs`: saldo 18 antes de cargar, 18 después
  de cargar y 17 después de completar; el reenvío del enlace (`resend`) no cambió el saldo. Lo que importa para
  la idempotencia es **no completar dos veces la misma transacción** ni crear dos transacciones para el mismo
  contrato. Un envío que falla **antes** de `complete` no cuesta nada (el documento en `DRAFT` se borra); el
  riesgo real es que `complete` tenga éxito y nuestro proceso se caiga antes de registrarlo (ver «Aprobar y
  enviar», paso 6: los ids se guardan **antes** de completar y un intento colgado se **adopta** en vez de
  reenviarlo).
- **Endpoints que el correo menciona y la guía no documenta** (`/sign-url`, `/documents/{code}/logs`,
  `/legal-entities/{id}/quota`, `POST /tokens/{id}/refresh`): **comprobados el 26-oct** en los `openapi.json`
  de producción (v0.0.147) y staging (v0.0.147-pre): existen los cuatro y los dos ambientes tienen las
  mismas rutas. Falta probarlos con datos (el script de staging prueba `logs` y `quota`). Alternativa si
  alguno fallara: `quota` solo sirve para avisar de saldo (el 422 de `complete` sigue siendo la red de
  seguridad), `logs` solo es evidencia (el PDF firmado y los eventos de correo bastan), y para el enlace el
  `resend` está documentado.
- **Metadata obligatoria por documento:** `category` `CONTRATOS` y `subcategory` `Contrato de Prestación de
  Servicios` (lista en `GET /categories`). Firme valida y normaliza el RUT (`documentNumber`): uno inválido
  responde 422 «RUT ingresado no es válido» (nuestro `RUT_INVALIDO`).
- El enlace de firma dura **10 días**. `POST /documents/{code}/signees/{privateCode}/resend` **renueva el
  enlace** (no consume otro crédito) y **exige que el documento esté en `PENDING_SIGNATURE` y que el firmante
  no haya firmado; si no, responde 422**. (En el `openapi.json` el parámetro se llama `{id}`; la guía
  documenta `privateCode`: se confirma en staging.) `POST .../sign-url` entrega el enlace para mandarlo por
  nuestro canal.
- La evidencia no trae la IP del firmante. Firme no borra la evidencia ni el PDF firmado
  (`GET /documents/{code}/files/SIGNED_DOCUMENT`, `GET /documents/{code}/logs`); igual guardamos copia.
- Todas las llamadas llevan `User-Agent: Incrementa-Contratos/1.0`. Firme no exige IPs registradas.
- Los correos al firmante salen con la marca de Firme e **incluyen el nombre del documento**: el nombre que
  enviamos tiene que identificar el contrato de Incrementa.
- Prod: `https://api.documentos.firme.cl`, mismos endpoints que staging. Staging sigue activo (18
  créditos de prueba). La guía actualizada (`guide 1.pdf`) está por contrastar.
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
configurado, **sigue el camino interno actual sin cambios (salvo en producción, donde la firma queda bloqueada hasta cargar `FIRME_*`)** (`signContract`: rúbrica + constancia +
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
| `rejected` | La influencer rechazó (con motivo, si Firme lo informa) | «Firma rechazada» + motivo + «Reenviar a firma» (**usa 1 crédito nuevo**) |
| `expired` | El enlace venció sin firmar (≥ 10 días) | «Firma vencida» + **«Renovar enlace»** (mismo documento de Firme, sin crédito nuevo) |
| `cancelled` | Cancelado en Firme | «Firma cancelada» + «Reenviar a firma» (**usa 1 crédito nuevo**) |
| `send_failed` | Falló el envío (créditos, RUT, red…) | mensaje del error + «Reenviar a firma» (si el documento llegó a cargarse en Firme sin completarse, se borra antes; no hay cargo) |
| `hash_mismatch` | El firmado no parte del PDF aprobado | «Requiere revisión» (sin botón; avisar a Ignacio) |

Un contrato tiene **a lo más un intento activo** (`sending` o `pending_signature`): índice único parcial
sobre `draft_document_id`. Cada reenvío crea un intento nuevo (`attempt + 1`) y conserva el historial.

## Aprobar y enviar (paso a paso)

`POST /api/contracts/:id/send-to-firme` (permiso `sign` sobre `Contract`), cuerpo
`{ signee: { firstName, lastName, maternalLastName, documentNumber, email } }`. Es **síncrono** (≈ 10
llamadas a Firme: unos segundos); no usa trabajos en segundo plano porque el backend escala a 0 réplicas
y un proceso posterior a la respuesta podría cortarse.

1. **Validar:** el borrador existe, está en `draft` o en `in_signature` sin intento activo, el proveedor
   califica (RUT chileno), Firme está configurado, el RUT del firmante pasa módulo 11 (`backend/utils/rut.js`, `parseRut`), el correo es válido, nombres no vacíos (materno vacío → `MATERNAL_PLACEHOLDER`, hoy `.`).
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
6. **Enviar a Firme:** `sendForSignature` con 1 firmante y la posición del timbre (abajo). El cliente avisa
   cada paso por un callback opcional (`onProgress`) y el servicio guarda `firme_transaction_id`,
   `firme_document_code` y el `privateCode` **apenas existan y antes de completar**; así, si el proceso cae
   después de `complete`, el intento colgado se puede **adoptar** (consulta del documento: si está en
   `PENDING_SIGNATURE`, pasa a `pending_signature`; si está en `DRAFT`, se borra) sin cobrar dos veces. El nombre del
   documento es lo que ve la influencer en el correo de Firme, así que identifica el contrato de Incrementa:
   `Contrato Incrementa — {plantilla} — {proveedor}` («Incrementa» fijo, el nombre de fantasía; ≤ 120 caracteres). **Nunca se crean dos transacciones ni
   se completa dos veces la misma** (el índice único del paso 2 impide dos intentos activos; un intento que
   falla antes de completar se limpia con `DELETE` del documento en `DRAFT`, y uno que ya se completó se
   adopta, no se reenvía). Si Firme responde
   422 «RUT ingresado no es válido» al crear el firmante, el error es `RUT_INVALIDO` con mensaje en español y
   el intento queda `send_failed` sin cargos.
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

La verdad siempre se pregunta a Firme con la API autenticada; **el webhook solo avisa**. Hay tres vías
que convergen en la misma función idempotente, `refresh(signingId)`: el webhook, la consulta al abrir la
pantalla y un **barrido programado desde fuera del backend** (porque el backend escala a 0).

1. **Webhook** `POST /api/webhooks/firme`, **público** (se declara antes de `requireAuth`, como `/health`)
   porque lo llama AWS SNS. Eventos a los que nos suscribimos: `signature.signed`, `document.signed` y
   `signature.rejected` (esta trae el motivo).
   - **Validación de la firma SNS de cada mensaje** (`backend/lib/snsVerify.js`, sin dependencias nuevas,
     con `crypto`): `SigningCertURL` debe ser `https` de un host `sns.<región>.amazonaws.com` y terminar en
     `.pem`; se descarga el certificado (con caché en memoria), se arma la cadena a firmar según el tipo
     de mensaje (`Notification`, `SubscriptionConfirmation`, `UnsubscribeConfirmation`) y se verifica con
     `SignatureVersion` 1 (RSA-SHA1) o 2 (RSA-SHA256). Un mensaje con firma inválida **no se procesa**
     (se registra y se responde 200 para que SNS no reintente).
   - Tipo `SubscriptionConfirmation`: con la firma válida y un host de SNS, hace `GET` a `SubscribeURL`.
   - Tipo `Notification`: `Message` es un JSON en texto. Extrae el código del documento (busca
     `documentCode`, `document_code`, `code`, `document.code` y, como último recurso, un uuid que coincida
     con un `firme_document_code` nuestro) y **refresca ese intento**. Del evento solo se usa, además, el
     motivo del rechazo (`reason`, `motivo`, `rejectionReason`) para mostrarlo; el estado real sale de Firme.
   - **Idempotente:** un mismo evento puede llegar dos veces. Cada mensaje se guarda una sola vez en
     `firme_webhook_event` (`event_id` único —el `event_id` del payload—, `INSERT … ON CONFLICT DO NOTHING`) y `refresh` ya es
     idempotente (finalizar dos veces no duplica el `document` ni reescribe `firmados`).
   - Responde siempre `200` rápido (SNS reintenta ante fallos; con el arranque en frío de ≈ 40 s el primer
     intento puede perderse, por eso existen las otras dos vías).
2. **Consulta al abrir** (`firmeSigningService.refresh`): al listar «En firma» y con «Actualizar estado»
   consulta `GET /documents/{code}`.
3. **Barrido programado:** Firme **no tiene evento de vencimiento**, así que un trabajo externo revisa los
   pendientes cada 15 a 30 minutos (Firme no impone límites que nos afecten). Se hace con un **comando**,
   no con un endpoint: `node scripts/firme-barrido.js`. El Container Apps Job lo crean David y la sesión de
   la nube, con la misma imagen del backend, ese comando y las mismas variables que el backend para base
   de datos, Firme y almacenamiento (ver «Variables»). Así no hay un endpoint nuevo ni un secreto
   compartido que cuidar. El script llama a `sweepPending`, imprime un resumen en JSON (revisados,
   finalizados, rechazados, vencidos, errores) y sale con código 0, o 1 si falla la base de datos o falta
   la configuración. **No hay barrido dentro del proceso del backend** (un `setInterval` no sirve con
   escala a 0).

**Qué hace `refresh`** según el estado que informa Firme (`GET /documents/{code}` trae, por firmante, `approvedUntil` —hasta cuándo vale el enlace—, `rejectionDetail` —el motivo del rechazo—, `invitationSentAt`, `emailDeliveryStatus` y `hub_signee_id`; la respuesta de crear el firmante solo trae `privateCode`, no un `id`):

| Firme | Acción |
|---|---|
| `PENDING_SIGNATURE` | solo actualiza `last_checked_at`; si pasaron más de 10 días desde el envío (o `approvedUntil` del firmante, si Firme lo informa) → `expired` |
| `SIGNED` o `COMPLETED` | **finaliza** (abajo) |
| `REJECTED` | intento `rejected` (guarda el motivo si se conoce) |
| `CANCELLED` / `REFUNDED` | intento `cancelled` |

El vencimiento por tiempo es un respaldo mientras Firme no informe vencimientos. Dos procesos pueden
coincidir (el barrido y alguien abriendo la pantalla): `refresh` toma el intento con
`SELECT … FOR UPDATE SKIP LOCKED` y el que no lo consigue sigue con el siguiente.

**Renovar enlace** (`POST /api/contracts/:id/resend-link`, desde `expired` (renovar) o `pending_signature`
(recordatorio)): llama a `POST /documents/{code}/signees/{privateCode}/resend` con el `privateCode` que ya
guardamos (el enlace vuelve a durar 10 días), pasa el **mismo** intento a `pending_signature` y no consume otro
crédito. **Firme solo lo permite si el documento sigue en `PENDING_SIGNATURE` y el firmante no firmó; si
responde 422** (por ejemplo, porque el documento ya pasó a otro estado al vencer), la pantalla dice «Firme no
permite renovar este enlace; use "Reenviar a firma" (usa 1 crédito nuevo)». No se manda el enlace por nuestro
canal: en producción no hay correo saliente.

**Registro del webhook (script de operación, no al arrancar la app).** `backend/scripts/firme-webhook.js` con
subcomandos `registrar <url>`, `listar`, `borrar <id>` y `estado <id>`, que usa `FIRME_*` del entorno.
`registrar` lista las suscripciones, **borra la de la misma URL si existe con otra configuración** (evita el
412) y crea la nueva con los eventos `document.signed`, `document.status_changed`, `signature.signed` y
`signature.rejected`; después consulta `estado` hasta ver `isConfirmed: true`. Lo corre David (o yo, con su
aviso) una vez por ambiente; el token debe ser de un ADMIN de la empresa en Firme.

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

Migración nueva (`202610220001_firme_signing.js`; la aplica Ignacio, no la corrida):

- `firme_signing`: `id uuid pk`, `draft_document_id uuid fk`, `attempt int`, `status text`,
  `document_id uuid` (reservado), `approved_by uuid` (→ `user_profile`), `approved_at timestamptz`,
  `signee_first_name`, `signee_last_name`, `signee_maternal_last_name`, `signee_rut`, `signee_email`,
  `stamp_page int`, `stamp_x numeric`, `stamp_y numeric`,
  `stamped_gcs_path text`, `stamped_sha256 text`, `stamped_byte_length int`,
  `firme_transaction_id text`, `firme_document_code text`, `firme_signee_private_code text`,
  `firme_status text`, `signee_signed_on timestamptz`,
  `signed_gcs_path text`, `signed_sha256 text`, `verified_at timestamptz`, `evidence_gcs_path text`,
  `last_error_code text`, `last_error_message text`, `rejection_reason text`, `last_checked_at timestamptz`,
  `created_at`, `updated_at`. Índice único parcial `(draft_document_id) where status in ('sending','pending_signature')`.
- `firme_webhook_event`: `id uuid pk`, `event_id text` (único; el `event_id` del payload de Firme), `sns_message_id text`, `received_at timestamptz`, `message_type text`,
  `body jsonb`, `firme_signing_id uuid null`.
- Tablas en inglés y singular; columnas `snake_case`. Las columnas `gcs_path` heredan el nombre del
  resto del sistema.

## Interfaz

**«Firma de documento»** (`ContractSigningPage.jsx`) con dos pestañas:

- **Por aprobar** (lo de hoy). Para un contrato con firma por Firme, el modal pasa a: datos del
  firmante prellenados y editables; texto «Al confirmar, usted aprueba este contrato en representación
  de {empresa}; su rúbrica quedará estampada y se enviará a {correo del firmante} para su firma
  electrónica»; casilla de revisión; botón **«Aprobar y enviar a firma»**. Éxito: «Contrato en proceso de
  firma.» («Contrato firmado.» solo aparece cuando firmaron Yerko y la influencer) Para un contrato por el camino interno, el modal es el de hoy (con las correcciones
  del recorte `firma-mensajes`).
- **En firma**: tabla con proveedor, firmante, enviado el, estado (chip) y acciones **Actualizar
  estado**, **Reenviar enlace** (solo `pending_signature`), **Renovar enlace** (solo `expired`),
  **Reenviar a firma** (solo `rejected`, `cancelled`, `send_failed`; avisa que **usará 1 crédito nuevo**) y
  **Ver PDF**. Los estados con detalle de error muestran el mensaje en español y, en `rejected`, el motivo.
  Sobre la tabla se muestra el **saldo de créditos** de Firme (`getQuota`), con aviso cuando quedan 10 o
  menos (constante `LOW_CREDITS_WARNING`).

**Contratos** (`ContractsListPage.jsx`): el chip distingue «Firmado», «En proceso de firma», «Firma
rechazada», «Firma vencida», «Requiere revisión» y «En proceso» (borrador sin enviar).

**MCP:** `firmar_contrato_electronico` responde `USE_FIRME_FLOW` si el contrato califica para Firme
(no se puede saltar la firma de la influencer por esa vía).

## Variables de entorno: pre-prod (staging de Firme) y producción

Ninguna variable nueva en `config.js`: el camino por Firme se activa solo si las tres tienen valor; sin
ellas, todo sigue por el camino interno. David y la sesión de la nube las agregan al Bicep y a Key Vault
de **los dos ambientes antes de promover el código que las usa** (yo no toco infra).

| Variable | ¿Secreto? | Pre-prod (staging de Firme) | Producción |
|---|---|---|---|
| `FIRME_API_URL` | no | `https://staging.api.documentos.firme.cl` | `https://api.documentos.firme.cl` |
| `FIRME_API_TOKEN` | **sí** (Key Vault; nombre sugerido `FIRME-API-TOKEN`, inyectado como `FIRME_API_TOKEN`) | token de desarrollador de staging | token de la cuenta de producción de Incrementa (a nombre de Yerko Reckmann) |
| `FIRME_LEGAL_ENTITY_ID` | no | `6aba57b936570f5e596a19af` | id de la entidad legal de producción (lo cargan David y la sesión de la nube) |

**Qué cambia entre staging y producción:** la URL, el token y la entidad legal; en staging el certificado
de la firma es «TESTING» y los créditos son de prueba, y en producción son reales y prepagados
($800 por firma con IVA). Cada ambiente usa **su** token: nunca el de producción en pre-prod. Las pruebas
contra Firme se hacen en pre-prod (producción no tiene datos de prueba).

**Puesta en marcha por ambiente** (David; no las hace la corrida):
1. Cargar las tres variables **en el backend y también en el MCP** (`ca-incrementa-mcp`; si no, el MCP
   firmaría por el camino interno y se saltaría la firma de la influencer) y recién entonces promover el
   código que las usa.
2. Registrar el webhook de ese ambiente: `POST {FIRME_API_URL}/webhooks/subscriptions` con
   `{ legalEntityId, url: "https://<backend>/api/webhooks/firme", eventTypes: ["document.signed", "document.status_changed", "signature.signed", "signature.rejected"] }`
   (con el script `backend/scripts/firme-webhook.js registrar <url>`; requiere un token de ADMIN de la empresa)
   (`<backend>` de producción: `ca-incrementa-backend.proudfield-0bbf6137.brazilsouth.azurecontainerapps.io`)
   y comprobar `GET /webhooks/subscriptions/{id}/status` → `isConfirmed: true`.
3. Crear el **Container Apps Job** del barrido: misma imagen del backend, comando
   `node scripts/firme-barrido.js`, programación cada 15 a 30 minutos (por ejemplo `*/20 * * * *`), con las
   mismas variables y secretos que el backend para la base de datos (`DATABASE_URL`), Firme (`FIRME_*`) y el
   almacenamiento (`AZURE_STORAGE_ACCOUNT`, contenedores) y la misma identidad administrada (acceso al
   Blob). No necesita ingress ni CORS ni el login. En prod, sin este trabajo el vencimiento y un webhook
   perdido solo se detectan cuando alguien abre la pantalla.
4. Pedir a Firme (Juan Puelpan): la forma de los eventos (cuerpo de `signature.signed`, `document.signed` y
   `signature.rejected`, y dónde viene el motivo). No exigen IPs registradas.

**Producción sin Firme (decisión de David, 26-oct): la firma queda bloqueada.** Con `ENVIRONMENT=prod` y sin
las tres variables cargadas, `getSigningMode` devuelve `blocked`: ni «Aprobar y enviar a firma» ni el botón
interno funcionan (409 `FIRMA_BLOQUEADA`, también por el MCP), y la pantalla muestra el botón deshabilitado.
Así ningún contrato puede quedar «Firmado» sin la firma de la influencer. Se desbloquea solo al cargar
`FIRME_*` en el backend (y en el MCP).

## Migraciones de este dominio

El deploy no corre migraciones: **Las aplica Ignacio, primero en pre-prod y después en prod**,
avisando antes a David y normalmente antes de promover el código, y todas son compatibles con el código anterior durante unos
minutos.

| Archivo | Recorte | Reversible | ¿El código nuevo la necesita antes de arrancar? |
|---|---|---|---|
| `202610210001_supplier_name_parts.js` | `proveedor-nombre-apellidos` | sí (`down` quita las columnas; el respaldo queda en `supplier_child_backup`) | **Sí**: el detalle del proveedor selecciona las columnas nuevas |
| `202610220001_firme_signing.js` | `firme-flujo-a` | sí (`down` borra las dos tablas) | **Sí**: `GET /api/contracts/in-signature` consulta `firme_signing` |

## `firmados` y WORM

En producción el contenedor `firmados` tendrá WORM de 5 años (hoy aún no lo tiene; se activa al terminar
las pruebas). El diseño **no depende de reemplazar ni borrar un PDF firmado**: solo se escribe en
`firmados` el PDF firmado y verificado y su evidencia, **una sola vez** y con una ruta estable (el
`document_id` se reserva al aprobar); todo lo intermedio (PDF estampado, PDF recibido con huella distinta)
va a `contratos-en-firma/` en el contenedor `documentos`, que sí se puede borrar. Un reenvío tras rechazo o
vencimiento no toca nada en `firmados`.

## Antes de lanzar (Ignacio y David)

1. ~~**Base de `page`**~~: hecho el 21-oct (base 1; ver arriba).
2. **Aprobación de David** de este diseño (aprobado el 21-oct; los cambios del 22-oct por la respuesta de
   Firme —webhooks con validación SNS, barrido por comando, renovar enlace, créditos al cargar— se le
   presentan aparte).
3. **Chequeo en staging** (gasta 1 crédito de prueba; script `firme-resend-check.mjs`): (a) cuándo se descuenta
   el crédito (saldo antes de cargar, después de cargar y después de completar); (b) que `resend` acepta el
   `privateCode` (y si solo acepta el `id`); (c) que `GET /documents/{code}/logs` y `GET .../quota` responden;
   (d) que `GET /categories` lista `Contrato de Prestación de Servicios` bajo `CONTRATOS`. Lo corre David con
   el token local.
4. Guía v2.1 (12-oct): los cambios respecto de la v2.0 son solo de Finiquito (SEVERANCE); nada de SIMPLE
   cambió. La contrastó David el 26-oct; no hace falta que yo la abra.
5. Migraciones aplicadas por Ignacio en pre-prod antes del deploy del código que las usa.

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

## Decisiones de David (26-oct, diseño aprobado)

a. En producción se **bloquea la firma** mientras no estén cargadas las `FIRME_*`.
b. «Reenviar a firma» después de un rechazo usa 1 crédito nuevo.
c. Aviso de saldo bajo con 10 créditos o menos.
d. Nombre del documento: «Contrato Incrementa — {plantilla} — {proveedor}» (nombre de fantasía).
e. Cuándo se cobra el crédito: **resuelto el 27-oct** con el chequeo en staging: **al completar la transacción**.
f. El webhook de producción lo registra el administrador de la cuenta de Firme que designe Yerko, con David al
   lado, usando el script de operación `backend/scripts/firme-webhook.js` (lo corre David).

Antes: firmante de una empresa = su representante legal; proveedores sin RUT chileno por el camino interno;
nombres y apellidos separados en el proveedor; timbre en la última página; «Contrato firmado» solo con las
dos firmas.

## Calendario comercial

La cotización formal de Firme vale 30 días desde el 20-oct (hasta ≈ 19-nov). Lo lleva David.

## Qué queda fuera

- Extranjeros sin RUT en Firme (decisión del 28-sep, hasta que Firme lo soporte).
- Firma del representante en Firme (flujo B) y firma automática del representante.
- Timbre junto al bloque de firma del cuerpo del contrato (requiere medir posiciones).
- Recordatorios **automáticos** al firmante y enviar el enlace por nuestro canal (`sign-url`): en producción
  no hay correo saliente. Sí está el botón manual «Reenviar enlace» / «Renovar enlace».
- Cancelación manual de un envío.
- Apellido materno opcional (Firme lo habilita en la segunda quincena de noviembre): hasta entonces se manda
  `.`; después se cambia una constante.
- Crear el Container Apps Job del barrido (lo hacen David y la sesión de la nube; el recorte entrega el
  comando).
- Variables o infraestructura en Azure: no se tocan `infra/azure/**`, workflows ni Key Vault.

## Recortes

En `firma-firme.recortes.yaml`, en este orden: `firme-cliente` (hecho), `proveedor-nombre-apellidos`
(nombres y apellidos separados en el proveedor), `firme-flujo-a` (todo el flujo A, backend y pantalla) y
`firma-mensajes` (dos correcciones de mensajes, después del flujo). Las migraciones se aplican en este
orden: `202610210001_supplier_name_parts.js` y luego `202610220001_firme_signing.js`.
