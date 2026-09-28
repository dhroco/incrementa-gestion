## Why

incrementa va a enviar contratos a firma electrónica simple (FES) en Firme.cl. Hoy no existe un cliente de esa API: el primer recorte construye solo el cliente HTTP, sin conectarlo a rutas, servicios, persistencia ni pantallas, para que los recortes siguientes (estado del contrato, envío, evidencia, interfaz) lo reutilicen igual con uno o con dos firmantes.

## What Changes

- Nuevo módulo `backend/lib/firmeClient.js`: fábrica `createFirmeClient` con dependencias inyectadas, `isFirmeConfigured()` y `FirmeClientError`.
- Envío de un PDF a firma `SIMPLE` con uno o más firmantes en orden, cada uno con posición de timbre.
- Consulta de estado del documento, descarga del PDF firmado y reunión de evidencia (logs, eventos de correo y certificados PDF).
- Errores con código y mensaje en español (`es-CL`). Si un paso del envío falla, el error incluye el progreso ya creado; el cliente no reintenta ni limpia.
- Pruebas nuevas en `backend/test/firmeClient.test.js` con `fetch` simulado. Ninguna llamada real a Firme ni a la base.

**Sin cambios en esta etapa:**

- `app.js`, `index.js`, `mcp.mjs`, `mcpTools.mjs`, services, controllers, migraciones y frontend.
- `backend/config.js` (ya expone `FIRME_API_URL`, `FIRME_API_TOKEN` y `FIRME_LEGAL_ENTITY_ID`).
- Modelo de datos, webhooks, GCS, plantillas, secretos en Cloud Run y el flujo actual de firma interna.

## Capabilities

### New Capabilities

- `firme-client`: Cliente HTTP de la API de Firme (fetch nativo) para enviar un PDF a firma simple, consultar estado, descargar el firmado y reunir evidencia, con errores en español y progreso parcial ante fallos.

### Modified Capabilities

- Ninguna. El cliente no altera requisitos de firma interna, contratos ni otras capacidades existentes.

## Impact

- **Backend**: archivo nuevo `lib/firmeClient.js` y pruebas nuevas `test/firmeClient.test.js`.
- **API HTTP del producto**: sin endpoints nuevos ni cambios de contrato.
- **Dependencias**: ninguna. Usa `fetch` nativo de Node.
- **Config**: lee las tres variables `FIRME_*` ya presentes en `backend/config.js`. Sin valor, `isFirmeConfigured()` es false y las operaciones lanzan `FIRME_NOT_CONFIGURED`.
- **Frontend**: fuera de alcance; no hay validación ni pantalla nueva.
- **Validación**: solo en el cliente, antes de cualquier llamada HTTP (PDF `Buffer`, firmantes no vacíos, campos obligatorios, `page` entero ≥ 0, `x`/`y` en 0–1).

## Consideraciones de seguridad

- El token de Firme no aparece en mensajes de error, en `progress` ni en logs. El módulo no escribe en consola.
- Las llamadas a la API llevan `Authorization: Bearer`. La subida del PDF a la `uploadUrl` de S3 y las descargas por URL firmada no llevan ese header.
- `FIRME_API_TOKEN` no tiene valor por defecto en código de este cambio; la configuración existente no se modifica.
- Los datos del firmante (nombre, RUT en `documentNumber`, correo) y el PDF salen solo hacia Firme cuando se invoca el cliente; este recorte no los persiste.
