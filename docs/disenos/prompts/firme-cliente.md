# Recorte · firme-cliente

> Encargo de Ignacio (arquitecto), 28-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/firma-firme.md`.

## 1. Objetivo

incrementa va a enviar contratos a firma electrónica simple (FES) en Firme.cl. Este recorte
construye **solo el cliente HTTP** de la API de Firme, sin conectarlo a nada del sistema. Al terminar,
existe `backend/lib/firmeClient.js` y con él se puede:

- **Enviar un PDF a firma** `SIMPLE` con uno o más firmantes, que firman en el orden en que se
  entregan, cada uno con su posición de timbre.
- **Consultar el estado** de un documento enviado.
- **Descargar el PDF firmado.**
- **Reunir la evidencia**: logs del documento, eventos de correo por firmante y certificados de
  correo en PDF.

Los errores tienen código y mensaje en español. Ninguna ruta, servicio, migración ni pantalla lo usa
todavía.

## 2. Arquitectura

- **Archivo nuevo** `backend/lib/firmeClient.js`, con el estilo de `backend/lib/graphClient.js`
  (clase de error propia, mensajes en español), pero **como fábrica con dependencias inyectadas**:

  ```js
  createFirmeClient({ apiUrl, token, legalEntityId, fetchImpl } = {})
  ```

  Sin argumentos, toma `FIRME_API_URL`, `FIRME_API_TOKEN` y `FIRME_LEGAL_ENTITY_ID` de
  `backend/config.js` (ya existen) y `fetchImpl` = `global.fetch`.
- También exporta `isFirmeConfigured()` (true si las tres variables de config tienen valor) y
  `FirmeClientError`.
- Todas las llamadas usan `Authorization: Bearer <token>` y `apiUrl` como base. La subida del PDF va
  a la `uploadUrl` de S3 que devuelve Firme, **sin** el header `Authorization`.
- Sin dependencias nuevas: usa `fetch` nativo de Node.
- **No toques** `app.js`, `index.js`, `mcp.mjs`, `mcpTools.mjs`, services, controllers, migraciones
  ni frontend.

## 3. Contrato del cliente

### `sendForSignature({ pdf, name, signees })`

- `pdf`: `Buffer` del PDF. `name`: nombre del documento en Firme.
- `signees`: arreglo no vacío, en el orden de firma. Cada uno:
  `{ firstName, lastName, maternalLastName, documentNumber, email, signature: { page, x, y } }`.
  `page` es entero base 0; `x` e `y` son fracciones de la página entre 0 y 1 (esquina superior
  izquierda del timbre).
- Pasos, **en este orden**:
  1. `POST /transactions` con `{ legalEntityId }` → `id`.
  2. `POST /documents` con `{ name, transactionId }` → `code`, `uploadUrl`.
  3. `PUT uploadUrl` con el PDF y `Content-Type: application/pdf`.
  4. `PUT /documents/{code}/upload`.
  5. `PUT /documents/{code}` con
     `{ category: 'CONTRATOS', subcategory: 'Contrato de Prestación de Servicios', procedureType: 'SIMPLE' }`.
  6. Por cada firmante, en orden: `POST /documents/{code}/signees` con sus datos (sin `signature`)
     → `privateCode`; luego `POST /documents/{code}/signatures` con
     `{ privateCode, page, x, y }`.
  7. `POST /transactions/{transactionId}/complete` con `{ paymentMethod: 'CREDITS' }`.
- Devuelve `{ transactionId, documentCode, signees: [{ email, privateCode }] }`, en el orden de
  entrada.
- Si un paso falla, lanza `FirmeClientError` con `step` (el número y nombre del paso, por ejemplo
  `'complete'`) y `progress` = lo que ya se creó (`{ transactionId?, documentCode?, signees }`), para
  que quien lo llame pueda reintentar o limpiar. No reintenta ni limpia por su cuenta.

### `getDocument(documentCode)`

`GET /documents/{code}` → `{ status, signedOn, signees: [{ email, signedOn }] }`. `status` es el
de Firme tal cual (`PENDING_SIGNATURE`, `SIGNED`, …). `signedOn` es `null` si falta.

### `downloadSignedPdf(documentCode)`

`GET /documents/{code}/files/SIGNED_DOCUMENT` → `download_url`; luego un `GET` a esa URL (sin
`Authorization`) → `Buffer`.

### `collectEvidence(documentCode, privateCodes)`

- `GET /documents/{code}/logs` → `logs` (los `items` tal cual).
- Por cada `privateCode`: `GET /documents/{code}/signees/{privateCode}/emails/events` →
  `events` (los `items`); por cada `hub_email_id` distinto entre esos eventos,
  `GET /documents/{code}/signees/{privateCode}/emails/{hub_email_id}/certificate` →
  `download_url` → `GET` (sin `Authorization`) → `Buffer`.
- Devuelve `{ logs, signees: [{ privateCode, events, certificates: [{ emailId, pdf }] }] }`.

### Errores (`FirmeClientError`: `message`, `code`, `status`, `step`, `progress`)

| Situación | `code` | `message` |
|---|---|---|
| Falta config (`apiUrl`, `token` o `legalEntityId`) al llamar | `FIRME_NOT_CONFIGURED` | «Firme no está configurado (revise FIRME_API_URL, FIRME_API_TOKEN y FIRME_LEGAL_ENTITY_ID).» |
| Firme responde 401 o 403 | `FIRME_AUTH_FAILED` | «Firme rechazó la autenticación (revise FIRME_API_TOKEN).» |
| `complete` responde 422 | `FIRME_NO_CREDITS` | «No quedan créditos de firma en Firme para completar el envío.» |
| Otra respuesta no 2xx (incluida S3) | `FIRME_API_ERROR` | «Error al comunicarse con Firme (paso <step>, HTTP <status>).» y, si la respuesta trae `detail`, se agrega entre paréntesis, recortado a 200 caracteres |
| `fetch` lanza (red caída) | `FIRME_NETWORK_ERROR` | «No se pudo conectar con Firme.» |
| Entrada inválida (`pdf` no es `Buffer`, `signees` vacío, firmante sin algún campo, `x`/`y` fuera de 0–1, `page` no entero ≥ 0) | `FIRME_INVALID_INPUT` | En español, nombrando el campo. **Se valida antes de cualquier llamada.** |

- **El token nunca aparece** en un mensaje, en `progress` ni en un log.
- No se escribe nada en consola.

## 4. Recomendaciones

- Un helper interno `request(step, method, path, body)` que arme la URL, los headers, parsee JSON y
  traduzca errores deja cada función en pocas líneas.
- `uploadUrl` y `download_url` son URLs externas completas: no se concatenan con `apiUrl`.

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`.
- **Ninguna prueba ni comando llama a Firme de verdad**: todo va con `fetchImpl` simulado. Nada que
  se conecte a la base.
- Mensajes, documentación y commits en español.

## 6. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente.** Si cualquier
prueba existente falla, **no la ajustes: consulta a la mesa.**

## 7. Pruebas nuevas

**Todas en el archivo nuevo `backend/test/firmeClient.test.js`.** Usan un `fetchImpl` simulado que
registra cada llamada (método, URL, headers y cuerpo) y responde según la URL. Ninguna lee el código
fuente.

- **Envío con dos firmantes**: las llamadas salen en el orden de la sección 3, con los cuerpos
  indicados; los firmantes y sus posiciones se crean en el orden de entrada; el resultado trae los
  dos `privateCode` en ese orden.
- **Envío con un firmante**: mismo flujo, un solo par signee + signature.
- **Headers**: todas las llamadas a `apiUrl` llevan `Authorization: Bearer <token>`; la subida a S3
  y las descargas por URL firmada **no** lo llevan; la subida a S3 lleva `Content-Type: application/pdf`
  y el `Buffer` del PDF.
- **Errores**: 401 en `POST /transactions` da `FIRME_AUTH_FAILED`; 422 en `complete` da
  `FIRME_NO_CREDITS` con `progress` que trae `transactionId`, `documentCode` y los firmantes creados;
  un 500 en `POST /documents/{code}/signees` da `FIRME_API_ERROR` con `step` de ese paso y el
  `detail` en el mensaje; `fetch` que lanza da `FIRME_NETWORK_ERROR`; ningún mensaje ni `progress`
  contiene el token.
- **Entrada inválida**: cada caso de la tabla da `FIRME_INVALID_INPUT` y **no se hizo ninguna
  llamada**.
- **Sin configuración**: `createFirmeClient({ fetchImpl })` con config vacía da
  `FIRME_NOT_CONFIGURED` al llamar `sendForSignature`, sin llamadas.
- **`getDocument`**, **`downloadSignedPdf`** y **`collectEvidence`**: devuelven la forma de la
  sección 3. `collectEvidence` pide un certificado por cada `hub_email_id` distinto (dos eventos con
  el mismo id → un certificado).
- **`isFirmeConfigured`**: true y false según la config. Para cargar config distinta, sigue el
  patrón de `graphClient.test.js` (limpiar `require.cache` de config y del módulo).

## 8. Puntos de atención

- `backend/config.js` ya trae `FIRME_API_URL`, `FIRME_API_TOKEN` y `FIRME_LEGAL_ENTITY_ID`; no lo
  edites.
- En la base de esta corrida hay pruebas de `rut.test.js` que el recorte `rut-dv-estricto` deja en
  verde. Si ves pruebas del RUT en rojo, la base está mal: consulta a la mesa, no las toques.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Las
  dos en verde.
