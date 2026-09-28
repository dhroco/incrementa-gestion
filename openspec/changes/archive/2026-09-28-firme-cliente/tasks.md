## 1. Cliente HTTP

No conectar el módulo a `app.js`, `index.js`, MCP, services, controllers, migraciones ni frontend. No editar `backend/config.js`.

- [x] 1.1 Crear `backend/lib/firmeClient.js` con `FirmeClientError` (`message`, `code`, `status`, `step`, `progress`), `isFirmeConfigured()` sobre `FIRME_API_URL`, `FIRME_API_TOKEN` y `FIRME_LEGAL_ENTITY_ID` de `backend/config.js`, y `createFirmeClient({ apiUrl, token, legalEntityId, fetchImpl } = {})`. Lo omitido (`undefined`) sale de config o de `global.fetch`. Un string vacío no se reemplaza. La fábrica no llama a la red.
- [x] 1.2 Helper interno para la API (`Authorization: Bearer`, JSON en las llamadas con cuerpo, URL = `apiUrl` sin barra final + path, 2xx incluido 201 como éxito) y otro para URLs absolutas (`uploadUrl` y `download_url`, sin `Authorization`). Traducir errores según el diseño: `FIRME_AUTH_FAILED` solo si la llamada llevó el token y respondió 401 o 403; `FIRME_NO_CREDITS` en 422 de `complete`; `FIRME_API_ERROR` en el resto de no-2xx, con `detail` recortado a 200 caracteres; `FIRME_NETWORK_ERROR` si `fetch` lanza. El token no entra en el mensaje ni en `progress`. Nada se escribe en consola.
- [x] 1.3 Implementar `sendForSignature` en el orden del diseño (pasos `transactions`, `documents`, `upload-pdf`, `confirm-upload`, `metadata`, `signees`, `signatures`, `complete`), validando la entrada antes de cualquier llamada y armando `progress` con lo ya creado. Si falta config, `FIRME_NOT_CONFIGURED` gana y no hay validación ni llamadas.
- [x] 1.4 Implementar `getDocument`, `downloadSignedPdf` y `collectEvidence` con la forma de retorno de la spec. Un certificado por cada `hub_email_id` distinto. Sin paginar.

## 2. Pruebas nuevas

Todas en el archivo nuevo `backend/test/firmeClient.test.js`. `fetchImpl` simulado que registra método, URL, headers y cuerpo. Ninguna prueba lee el código fuente, llama a Firme ni toca la base. No modificar archivos de prueba existentes.

- [x] 2.1 Envío con dos firmantes y envío con uno: orden de llamadas, cuerpos, posiciones y `privateCode` en el orden de entrada.
- [x] 2.2 Headers: `Authorization: Bearer <token>` en toda llamada a `apiUrl`; la subida a S3 y las descargas por URL firmada sin ese header; la subida con `Content-Type: application/pdf` y el `Buffer`.
- [x] 2.3 Errores: 401 en `POST /transactions` → `FIRME_AUTH_FAILED`; 422 en `complete` → `FIRME_NO_CREDITS` con `progress` (`transactionId`, `documentCode` y los firmantes creados); 500 en `POST /signees` para el **segundo** firmante → `FIRME_API_ERROR`, `step` `signees`, el `detail` en el mensaje, y `progress.signees` con **solo el primer firmante**; 403 en la subida a `uploadUrl` (S3) → `FIRME_API_ERROR` con `step` `upload-pdf` (no `FIRME_AUTH_FAILED`, porque esa llamada no lleva `Authorization`); `fetch` que lanza → `FIRME_NETWORK_ERROR`. Ni el mensaje ni `progress` contienen el token.
- [x] 2.4 Entrada inválida: cada caso de la spec (`pdf`, `signees` vacío, campo de firmante ausente, `page`, `x`/`y`) da `FIRME_INVALID_INPUT` y cero llamadas.
- [x] 2.5 Sin configuración: `createFirmeClient({ fetchImpl })` con config vacía da `FIRME_NOT_CONFIGURED` al llamar `sendForSignature`, sin llamadas.
- [x] 2.6 `getDocument`, `downloadSignedPdf` y `collectEvidence` devuelven la forma de la spec. Dos eventos con el mismo `hub_email_id` producen un solo certificado.
- [x] 2.7 `isFirmeConfigured` true y false según la config, recargando con el patrón de `graphClient.test.js` (limpiar `require.cache` de config y del módulo).
- [x] 2.8 Fábrica y defaults: `createFirmeClient()` sin argumentos, con las tres claves de config presentes, usa esos valores y `global.fetch` (stub temporal de `global.fetch` en la prueba, restaurado al terminar); `createFirmeClient({ fetchImpl })` con las tres claves de config presentes hace que toda llamada use `fetchImpl` y que `apiUrl`/`token`/`legalEntityId` salgan de config; un string vacío explícito en `apiUrl`, `token` o `legalEntityId` no se reemplaza por el valor de config.

## 3. Verificación

- [x] 3.1 Correr `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Las dos en verde. Si una prueba existente falla, no ajustarla: consultar a la mesa.
