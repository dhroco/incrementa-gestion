## Why

El gerente de Incrementa eligió el flujo A: Yerko aprueba el contrato dentro del sistema y en Firme.cl firma solo la influencer (un firmante, firma electrónica simple). Hoy la firma es interna (`signContract`): estampa la rúbrica, marca el borrador «Firmado» y la influencer firma fuera. Ese cierre deja contratos «Firmados» sin la firma de la influencer. Este recorte conecta el cliente de Firme ya existente con el envío, la recepción verificada y la pantalla, sobre `preprod` con `firme-cliente` y `proveedor-nombre-apellidos` fusionados.

## What Changes

- Un contrato de proveedor con RUT chileno, con Firme configurado, se **aprueba y envía a firma** desde «Firma de documento»: se estampa la rúbrica de la empresa, se guarda el SHA-256 del PDF estampado, se envía a Firme con un firmante y el borrador queda `in_signature` («En proceso de firma»).
- Cuando la influencer firma, el sistema lo detecta por webhook de Firme (firma SNS validada), por consulta al abrir la pantalla o por el barrido `node scripts/firme-barrido.js`. Descarga el PDF y la evidencia, comprueba que la primera revisión coincide con la huella guardada, los guarda en el contenedor `firmados` y el contrato pasa a «Firmado».
- Rechazo, vencimiento, falta de créditos, RUT inválido y huella distinta tienen estado, mensaje en español y una salida («Reenviar a firma», «Reenviar enlace» o «Renovar enlace», según el caso).
- Un proveedor sin RUT chileno, o un ambiente que no es producción y no tiene Firme configurado, sigue por el camino interno de hoy. En producción, sin las tres `FIRME_*`, **ningún** contrato se puede firmar (`blocked`).
- Migración nueva `backend/migrations/202610220001_firme_signing.js` (no se ejecuta en esta corrida). Sin variables de entorno, dependencias ni permisos nuevos.

## Capabilities

### New Capabilities

- `firme-signing`: Flujo A de punta a punta: modo de firma, estampado y huella, envío y recepción idempotentes, webhook SNS, barrido, almacenamiento sin sobrescritura en `firmados`, y las pestañas «Por aprobar» y «En firma».

### Modified Capabilities

- `firme-client`: Cuota, borrado de documento en borrador, reenvío de invitación, suscripciones de webhook, aviso `onProgress` antes de completar y encabezado `User-Agent` en las llamadas a la API. Lo ya especificado de `sendForSignature`, consulta, descarga y evidencia no cambia de forma.
- `contract-signing`: El listado pendiente excluye `in_signature`, suma el modo de firma y la sugerencia de firmante, y `POST /api/contracts/:id/sign` rechaza los modos `firme` y `blocked`. La pantalla de firma interna se conserva para el modo `internal`.
- `contracts-query`: `normalizeStatus` admite `in_signature`. El listado de contratos distingue el chip «En proceso de firma» y suma esa opción al filtro.
- `backend-mcp-server`: `firmar_contrato_electronico` aplica el mismo guardia de modo cuando el servicio de Firme viene en las dependencias. `createMcpServer` crea ese servicio y lo pasa a las herramientas.

## Impact

**Backend:** migración `firme_signing` y `firme_webhook_event`; `lib/firmeStamp.js`, `lib/snsVerify.js`, `services/firmeSigningService.js`, `services/firmeStampService.js` (o el estampado dentro del servicio de firma), `controllers/firmeSigningController.js`, `scripts/firme-barrido.js`, `scripts/firme-webhook.js`. Se agregan funciones a `firmeClient.js` y `uploadBufferOnce` a `storageService.js`. `app.js` e `index.js` registran rutas y el servicio. `listPendingSignature` solo puede sumar columnas al `select` y excluir `in_signature`. `signContract` no cambia de comportamiento para el camino interno.

**API:** públicas `POST /api/webhooks/firme` (siempre 200). Protegidas con `sign` sobre `Contract`: `POST /api/contracts/:id/send-to-firme` (202), `GET /api/contracts/in-signature`, `POST /api/contracts/:id/refresh-signature`, `POST /api/contracts/:id/resend-link`. `GET /api/contracts/pending-signature` suma `signing_mode`, `signee_suggestion` y `meta.email_enabled`. `POST /api/contracts/:id/sign` responde `USE_FIRME_FLOW` o `FIRMA_BLOQUEADA` cuando corresponde.

**Frontend:** `ContractSigningPage.jsx` y `contractSigningApi.js` (dos pestañas y el modal de Firme). `ContractsListPage.jsx` (chip y filtro). Mensajes en español (`es-CL`); RUT con la validación de módulo 11 ya existente.

**Datos:** un intento por envío; a lo más un intento activo (`sending` o `pending_signature`) por borrador. El PDF estampado y el recibido con huella distinta van a `contratos-en-firma/` (contenedor `documentos`). En `firmados` solo entra el PDF verificado y su evidencia, una sola vez (`uploadBufferOnce`). La migración la aplica el arquitecto, primero en pre-prod y después en prod, antes de promover el código: el proceso nuevo la necesita para arrancar (`GET /api/contracts/in-signature` lee `firme_signing`). Es reversible (`down` borra las dos tablas).

**Fuera de alcance:** Container Apps Job del barrido, variables e infraestructura Azure, extranjeros sin RUT en Firme, flujo B, timbre en el cuerpo del contrato, recordatorios automáticos, cancelación manual y apellido materno opcional (hasta noviembre se envía `MATERNAL_PLACEHOLDER`, hoy `.`). No se tocan `config.js`, `knexfile.js`, `db/knex.js`, `openspec/config.yaml`, `docs/**` ni `infra/**`. No se ejecutan migraciones ni llamadas reales a Firme, Azure o la base. Ninguna prueba existente se modifica.

**Validación:** en el servidor, antes de reservar el intento (borrador, modo, estado, RUT, nombres, correo). En el cliente, la casilla de autorización y los campos del firmante antes de llamar a `send-to-firme`; el mensaje de error del backend se muestra dentro del modal.

## Consideraciones de seguridad

- El webhook es público y lo llama AWS SNS. Cada mensaje se procesa solo si la firma SNS es válida y `SigningCertURL` es `https` de `sns.<región>.amazonaws.com` terminada en `.pem`. Una firma inválida se registra y se responde 200, sin `refresh` ni `GET` a `SubscribeURL`. `SubscribeURL` solo se consulta si su host cumple la misma regla y el protocolo es `https`.
- El token de Firme, el enlace de firma, las URLs firmadas de descarga y el contenido de los PDF no se escriben en logs, respuestas ni columnas. El `privateCode` se guarda para renovar el enlace y no se muestra en «En firma» ni en el resumen del barrido.
- Nombres, apellidos, RUT y correo del firmante son datos personales. Quedan en `firme_signing` y salen a Firme solo en el envío. El listado «En firma» no devuelve identificadores internos de Firme. El permiso sigue siendo el existente `sign` sobre `Contract`; no hay grants nuevos.
- En producción, sin `FIRME_*`, la firma interna y el envío a Firme quedan bloqueados (`FIRMA_BLOQUEADA`), también por el MCP, para que un contrato no quede «Firmado» sin la firma de la influencer.
- Los blobs de `firmados` se escriben una sola vez. Una huella distinta no crea `document` ni pisa un blob ya guardado (`STORAGE_CONFLICT`).
