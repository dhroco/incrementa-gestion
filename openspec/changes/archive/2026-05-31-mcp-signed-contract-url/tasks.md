## 1. gcsService — URL firmada

- [x] 1.1 Agregar `getSignedUrl({ gcsPath, expiresInMinutes })` en `backend/services/gcsService.js` usando `file.getSignedUrl({ version: 'v4', action: 'read', expires })`; incluir en el objeto retornado por `createGcsService` sin modificar `uploadBuffer`, `downloadBuffer` ni `deleteFile`
- [x] 1.2 Crear `backend/test/gcsService.test.js` (o extender suite existente): mock de `@google-cloud/storage`; verificar que `getSignedUrl` invoca `getSignedUrl` del file con acción `read` y expiración acorde a `expiresInMinutes`

## 2. Herramienta MCP obtener_url_contrato

- [x] 2.1 Ampliar firma de `registerMcpTools` en `backend/mcpTools.mjs` para aceptar `gcsService` en `deps`
- [x] 2.2 Registrar herramienta `obtener_url_contrato` con parámetro `documentId` (UUID Zod) y descripción para Claude (usar tras `generar_contrato` o bajo demanda; URL válida 60 min)
- [x] 2.3 Implementar handler: query `draft_document` por `id`; errores `NOT_FOUND` / `GCS_PATH_MISSING`; éxito con `signedUrl`, `file_name`, `documentId`, `expiresInMinutes: 60`, `expiresAt` ISO; capturar fallos de firma como `SIGNED_URL_FAILED`
- [x] 2.4 Pasar `gcsService` a `registerMcpTools` desde `backend/mcp.mjs`

## 3. Tests MCP

- [x] 3.1 Extender `backend/test/mcpServer.test.js`: mock de `gcsService.getSignedUrl` y query `draft_document`; verificar respuesta exitosa con URL firmada
- [x] 3.2 Agregar casos de test: `documentId` inexistente → `NOT_FOUND`; fila sin `gcs_path` → `GCS_PATH_MISSING`
- [x] 3.3 Ejecutar `npm test` en backend — suite completa verde

## 4. Verificación manual

- [x] 4.1 Smoke conversacional en Claude Desktop: `generar_contrato` → `obtener_url_contrato` con el id retornado → abrir `signedUrl` en navegador y confirmar visualización del PDF
