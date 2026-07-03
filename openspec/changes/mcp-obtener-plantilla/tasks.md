## 1. Dependencia tipTapPlainText en factory MCP

- [x] 1.1 En `backend/mcpServer.mjs`: importar `tipTapDocToPlainTextAsync` con `createRequire` desde `./utils/tipTapPlainText`
- [x] 1.2 Agregar `tipTapDocToPlainTextAsync` al objeto `mcpDeps` pasado a `registerMcpTools`

## 2. Tool obtener_plantilla

- [x] 2.1 En `backend/mcpTools.mjs`: destructurar `tipTapDocToPlainTextAsync` de `deps`; extender JSDoc de deps
- [x] 2.2 Registrar `server.tool('obtener_plantilla', ...)` con:
  - Parámetro `id`: `z.string().uuid()` requerido
  - Descripción en español: ver contenido/texto de plantilla estándar; id desde `listar_plantillas`; variables como `{{...}}` sin rellenar
  - Handler: `getStandardTemplateById(id)` → si `!ok` o `notFound` → `{ ok: false, code: 'NOT_FOUND', message: 'Plantilla no encontrada.' }`
  - Si ok: `content = await tipTapDocToPlainTextAsync(template.content_json)` → `{ ok: true, data: { id, name, code, supplier_type, status, description, content } }`
- [x] 2.3 Colocar la tool junto a `listar_plantillas` (sección plantillas)

## 3. Tests

- [x] 3.1 En `backend/test/mcpServer.test.js`: test `obtener_plantilla` con mock de `getStandardTemplateById` y `tipTapDocToPlainTextAsync` — verifica metadata + `content` con placeholders
- [x] 3.2 Test id inexistente → `ok: false`, `code: 'NOT_FOUND'`, mensaje en español
- [x] 3.3 Ejecutar `npm test` en backend — suite verde

## 4. Verificación

- [x] 4.1 Local: registrar tools (stdio o `mcp-http`) y confirmar `obtener_plantilla` en listado
- [ ] 4.2 Post-deploy pre-prod: `tools/call` con id válido de `listar_plantillas` retorna texto con `{{placeholders}}`
