## Why

Hoy `listar_plantillas` solo expone metadata (id, name, code, status, supplier_type) de plantillas activas. Claude no puede **ver el texto** de una plantilla antes de validar o generar un contrato, lo que dificulta responder preguntas del usuario sobre cláusulas, variables requeridas o el contenido literal del documento. Se necesita una herramienta MCP de solo lectura que devuelva el contenido legible con marcadores `{{variableId}}` sin resolver valores.

## What Changes

- **Nueva tool MCP `obtener_plantilla`**: parámetro `id` (UUID); llama `standardTemplatesService.getStandardTemplateById(id)` y convierte `content_json` (TipTap) a texto plano vía `tipTapDocToPlainTextAsync`. Retorna metadata + campo `content`.
- **`backend/mcpServer.mjs`**: inyectar `tipTapDocToPlainTextAsync` en deps de `registerMcpTools` (import CJS con `createRequire`).
- **`backend/mcpTools.mjs`**: registrar handler siguiendo el patrón existente (`jsonToolResult`, errores `NOT_FOUND` en español).
- **Test**: caso en `backend/test/mcpServer.test.js` para id válido (content con placeholders) e id inexistente.

**Restricciones explícitas:** no crear servicio, endpoint REST ni migración; no cambiar permisos ni `MCP_USER_ID`; no modificar tools existentes ni transportes stdio/HTTP.

## Capabilities

### New Capabilities

_(ninguna — extiende `backend-mcp-server`)_

### Modified Capabilities

- `backend-mcp-server`: nueva herramienta `obtener_plantilla` para consultar contenido legible de plantillas estándar.

## Impact

- **Backend MCP**: `mcpServer.mjs`, `mcpTools.mjs`; test `mcpServer.test.js`.
- **Despliegue**: reutiliza imagen backend existente; tras redeploy a pre-prod (servicios `incrementa-backend` e `incrementa-mcp`), la tool aparece en `tools/list` sin cambios de CI.
- **Operacional**: reiniciar cliente MCP o reconectar remoto tras despliegue para refrescar catálogo de herramientas.

## Consideraciones de seguridad

- La tool es de **solo lectura**; no muta BD ni GCS.
- Expone el texto completo de cualquier plantilla por UUID (incluidas inactivas), accesible con permisos del actor técnico `MCP_USER_ID`. Aceptable en pre-prod; en producción futura el endpoint MCP requerirá auth por usuario.
- No resuelve variables ni datos de proveedor/cliente — solo marcadores `{{...}}`, sin PII adicional.
