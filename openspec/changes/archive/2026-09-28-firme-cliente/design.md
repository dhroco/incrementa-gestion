## Context

incrementa firma hoy los contratos por dentro: vuelve a generar el PDF con la rúbrica del representante y lo envía por correo. El envío a firma electrónica simple en Firme.cl todavía no existe en el producto. El flujo `SIMPLE` ya se probó en staging (28-sep-2026): transacción, documento, subida del PDF a S3, confirmación, categoría, firmantes en orden con posición de timbre, y cierre con créditos.

`backend/config.js` ya expone `FIRME_API_URL`, `FIRME_API_TOKEN` y `FIRME_LEGAL_ENTITY_ID`. En `local`, si la variable no viene, la URL queda en `https://staging.api.documentos.firme.cl`; el token y el id de entidad quedan vacíos. Este recorte no modifica ese archivo.

El módulo de referencia de estilo es `backend/lib/graphClient.js` (`GraphClientError`, mensajes en español, `fetch` nativo). El encargo pide otra forma de construcción: una fábrica con dependencias inyectadas, para que las pruebas no llamen a Firme ni muten `global.fetch` como único camino.

## Goals / Non-Goals

**Goals:**

- `backend/lib/firmeClient.js` envía un PDF a firma `SIMPLE`, consulta el documento, descarga el PDF firmado y reúne la evidencia.
- Los errores salen como `FirmeClientError` con código y mensaje en español. Un envío a medias informa lo ya creado y no reintenta ni borra.
- `isFirmeConfigured()` dice si las tres claves de config tienen valor.
- Las pruebas nuevas viven en `backend/test/firmeClient.test.js`, con `fetchImpl` simulado. No leen el código fuente ni tocan la base.

**Non-Goals:**

- Conectar el cliente a `app.js`, `index.js`, MCP, services, controllers, migraciones o frontend.
- Editar `backend/config.js` ni guardar secretos en Cloud Run.
- Modelo de datos, webhooks, sondeo, GCS, caja del timbre en plantillas, ni decidir si firman uno o dos representantes.
- Reintentos, compensación y paginación de logs o eventos.
- Dependencias npm nuevas.

## Decisions

### D1 — Fábrica con dependencias, no singleton

```js
createFirmeClient({ apiUrl, token, legalEntityId, fetchImpl } = {})
```

Cada argumento omitido (`undefined`) sale de `backend/config.js` o, en el caso de `fetchImpl`, de `global.fetch`. Un string vacío explícito no se reemplaza por el de config. La fábrica no llama a la red ni lanza: la falta de config se detecta al invocar un método.

Exporta además `isFirmeConfigured()` y `FirmeClientError`. `isFirmeConfigured()` lee las tres claves ya resueltas en config (no el `process.env` crudo). En `local`, la URL por defecto cuenta como valor; sin token o sin id de entidad el resultado es false.

**Alternativa:** singleton con caché, como `getGraphClient()`. Se descarta porque el encargo fija la fábrica y las pruebas inyectan `fetchImpl` por llamada.

### D2 — Dos caminos HTTP

Un helper interno `request(step, method, path, body)` arma las llamadas a la API:

- URL = `apiUrl` sin barra final + `path` (el path empieza con `/`).
- Header `Authorization: Bearer <token>`.
- Si hay body, `Content-Type: application/json` y `JSON.stringify`.
- Cualquier estado 2xx es éxito (Firme responde 201 al crear firmante y al crear firma). El cuerpo se parsea como JSON.

`uploadUrl` y `download_url` son URLs absolutas. Van en un helper distinto: no se concatenan con `apiUrl` y no llevan `Authorization`. La subida usa `PUT`, `Content-Type: application/pdf` y el `Buffer` del PDF. La descarga es un `GET` cuyo cuerpo se convierte en `Buffer`.

### D3 — Orden del envío y nombres de `step`

`sendForSignature` valida la entrada y después ejecuta, en este orden. `step` es el nombre de la fila (el encargo ilustra el último como `'complete'`):

| # | `step` | Llamada | Cuerpo |
|---|---|---|---|
| 1 | `transactions` | `POST /transactions` | `{ legalEntityId }` → `id` |
| 2 | `documents` | `POST /documents` | `{ name, transactionId }` → `code`, `uploadUrl` |
| 3 | `upload-pdf` | `PUT uploadUrl` | PDF, sin JSON |
| 4 | `confirm-upload` | `PUT /documents/{code}/upload` | sin cuerpo |
| 5 | `metadata` | `PUT /documents/{code}` | `{ category: 'CONTRATOS', subcategory: 'Contrato de Prestación de Servicios', procedureType: 'SIMPLE' }` |
| 6 | `signees` | `POST /documents/{code}/signees` | datos del firmante, sin `signature` → `privateCode` |
| 7 | `signatures` | `POST /documents/{code}/signatures` | `{ privateCode, page, x, y }` |
| 8 | `complete` | `POST /transactions/{transactionId}/complete` | `{ paymentMethod: 'CREDITS' }` |

Las filas 6 y 7 se repiten por cada firmante, en el orden del arreglo, antes de pasar al siguiente. El resultado es `{ transactionId, documentCode, signees: [{ email, privateCode }] }` en ese mismo orden.

Un firmante entra a `progress.signees` cuando `POST /signees` respondió 2xx, aunque la firma de ese firmante todavía no se haya creado. `progress` es `{ transactionId?, documentCode?, signees }`. `signees` empieza en `[]`.

### D4 — Errores

`FirmeClientError` extiende `Error` con `name`, `message`, `code`, `status`, `step` y `progress`. No se escribe nada en consola. El token no se copia a `message`, `progress` ni a ningún otro campo; si `detail` lo contuviera, se elimina antes de armar el mensaje.

Al entrar a un método, si falta `apiUrl`, `token` o `legalEntityId`, se lanza `FIRME_NOT_CONFIGURED` sin mirar la entrada y sin llamar a `fetch`. Después, solo `sendForSignature` valida la entrada. El primer defecto gana:

1. `pdf` no es `Buffer` → «El campo pdf debe ser un Buffer.»
2. `signees` no es un arreglo con al menos un elemento → «El campo signees debe incluir al menos un firmante.»
3. Por cada firmante, en orden, el primer campo ausente (`null`, `undefined` o string vacío) entre `firstName`, `lastName`, `maternalLastName`, `documentNumber`, `email` y `signature` → «Al firmante N le falta el campo <campo>.» N es la posición desde 1.
4. Dentro de `signature`: si falta `page`, `x` o `y`, el mismo mensaje de campo ausente. `page` presente que no sea un entero ≥ 0 → «El campo page del firmante N debe ser un entero mayor o igual a 0.» `x` o `y` presente que no sea un número finito entre 0 y 1, inclusive → «El campo <x|y> del firmante N debe estar entre 0 y 1.»

Esos casos usan `code` `FIRME_INVALID_INPUT`, sin `status` y sin llamadas. `name` del documento no se valida en local: no está en la tabla del encargo.

Traducción de una respuesta ya recibida, en este orden:

1. HTTP 401 o 403 en una llamada que llevó `Authorization` → `FIRME_AUTH_FAILED`, mensaje «Firme rechazó la autenticación (revise FIRME_API_TOKEN).»
2. HTTP 422 en el paso `complete` → `FIRME_NO_CREDITS`, mensaje «No quedan créditos de firma en Firme para completar el envío.»
3. Cualquier otro no-2xx, incluida S3 o una URL firmada (aunque sea 401 o 403) → `FIRME_API_ERROR`, mensaje «Error al comunicarse con Firme (paso <step>, HTTP <status>).» Si el JSON trae `detail`, se agrega entre paréntesis, recortado a 200 caracteres. Si `detail` no es string, se usa `JSON.stringify` antes de recortar.
4. `fetch` lanza → `FIRME_NETWORK_ERROR`, mensaje «No se pudo conectar con Firme.» `status` queda ausente.

En 1–3, `status` es el HTTP recibido y `step` es el de la fila. En un envío, `progress` es lo ya creado. En los otros métodos, `progress` es `{ signees: [] }`.

Un 2xx al que le falte un campo necesario para seguir (`id`, `code`, `uploadUrl`, `privateCode` o `download_url`) es `FIRME_API_ERROR` del mismo paso. En logs y eventos, `items` ausente se lee como `[]`.

### D5 — Lecturas

`getDocument(documentCode)` hace `GET /documents/{code}` y devuelve `{ status, signedOn, signees }`. `status` se copia tal cual (`PENDING_SIGNATURE`, `SIGNED`, u otro). `signedOn` del documento y de cada firmante es `null` cuando falta o viene `null`. De cada firmante solo se conservan `email` y `signedOn`. Si `signees` no viene, el arreglo va vacío.

`downloadSignedPdf(documentCode)` hace `GET /documents/{code}/files/SIGNED_DOCUMENT`, lee `download_url` y hace `GET` a esa URL sin `Authorization`. Devuelve el `Buffer`.

`collectEvidence(documentCode, privateCodes)` hace `GET /documents/{code}/logs` y guarda `items` en `logs`. Por cada `privateCode`, en orden: `GET /documents/{code}/signees/{privateCode}/emails/events` y guarda `items` en `events`. Por cada `hub_email_id` distinto, en orden de primera aparición, `GET .../emails/{hub_email_id}/certificate`, luego `GET` de `download_url` sin `Authorization`. Dos eventos con el mismo id producen un solo certificado. Devuelve `{ logs, signees: [{ privateCode, events, certificates: [{ emailId, pdf }] }] }`. `emailId` es el `hub_email_id` recibido. No recorre páginas: usa el `items` de esa única respuesta.

Los `step` de estas llamadas son `document`, `signed-file-url`, `download-signed-pdf`, `logs`, `email-events`, `email-certificate` y `download-certificate`.

### D6 — Pruebas

Archivo nuevo `backend/test/firmeClient.test.js`. El `fetchImpl` registra método, URL, headers y cuerpo, y responde según la URL. Ninguna prueba lee el fuente ni abre una conexión real.

Para `isFirmeConfigured` con otra config, el patrón de `graphClient.test.js`: asignar `process.env`, borrar `require.cache` de `backend/config.js` y de `backend/lib/firmeClient.js`, y volver a requerir. Restaurar env y caché al terminar. No se modifica ningún archivo de prueba existente.

## Risks / Trade-offs

- [El envío queda a medias en Firme si un paso falla] → El error trae `progress` para que un recorte posterior reintente o limpie. Este cliente no lo hace.
- [Logs y eventos vienen paginados y solo se lee la primera respuesta] → El encargo pide los `items` de esa llamada. Recorrer páginas queda fuera.
- [En `local` la URL de staging es el default] → `isFirmeConfigured()` sigue en false mientras token o entidad estén vacíos. No se cambia `config.js`.
- [Un 403 de S3 no es un fallo del token] → Se informa como `FIRME_API_ERROR`. `FIRME_AUTH_FAILED` queda reservado a las llamadas que enviaron `Authorization`, porque ese mensaje pide revisar el token.
- [El PDF y el RUT del firmante salen del proceso hacia Firme] → Solo cuando alguien llama al cliente. Este recorte no lo persiste ni lo expone en una ruta.

## Migration Plan

No hay migración ni cambio de arranque: nada importa el módulo todavía. Publicar el archivo no altera la API ni la firma interna. Revertir es quitar `backend/lib/firmeClient.js` y `backend/test/firmeClient.test.js`.

## Open Questions

Ninguna. Quién firma en Firme (uno o dos) no cambia este cliente: el arreglo `signees` ya cubre ambos casos.
