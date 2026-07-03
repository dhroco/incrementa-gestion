## 1. Factory compartida MCP

- [x] 1.1 Crear `backend/mcpServer.mjs` con `createMcpServer()`: mover bootstrap de servicios y `registerMcpTools` desde `mcp.mjs` actual; exportar `{ server }` (y `deps` si tests lo requieren)
- [x] 1.2 Refactorizar `backend/mcp.mjs` para usar `createMcpServer()` + `StdioServerTransport`; verificar que no cambia comportamiento
- [ ] 1.3 Smoke stdio: `npm run mcp` con env vars — proceso arranca sin error

## 2. Entrypoint HTTP MCP

- [x] 2.1 Crear `backend/mcp-http.mjs`: salvaguarda `ENVIRONMENT === 'prod'` → log stderr + `process.exit(1)`
- [x] 2.2 Implementar `GET /health` → 200 `{ status: 'ok' }`
- [x] 2.3 Implementar `/mcp` con `StreamableHTTPServerTransport` en modo stateless (`sessionIdGenerator: undefined`): crear server+transport por request vía `createMcpServer()`; cerrar en `res.on('close')`
- [x] 2.4 GET/DELETE `/mcp` → 405 Method Not Allowed (stateless); POST delega a transport; escuchar `process.env.PORT || 8080`, host `0.0.0.0`
- [x] 2.5 Agregar script `"mcp:http": "node mcp-http.mjs"` en `backend/package.json`

## 3. Tests

- [x] 3.1 Crear `backend/test/mcpHttp.test.js`: salvaguarda prod (exit 1 con `ENVIRONMENT=prod`); `GET /health` retorna 200; GET/DELETE `/mcp` → 405; singleton db
- [ ] 3.2 Verificar tests existentes de MCP (`mcpServer.test.js`) siguen verdes tras refactor de factory
- [ ] 3.3 Ejecutar `npm test` en backend — suite completa verde

## 4. CI / despliegue pre-prod

- [x] 4.1 En `.github/workflows/deploy-preprod.yml`: agregar env `MCP_SERVICE: incrementa-mcp`
- [x] 4.2 Step `Deploy MCP a Cloud Run` después del push de imagen backend: reusar `${{ env.AR_HOST }}/backend:${{ github.sha }}`, `--command node --args mcp-http.mjs`, flags Cloud SQL/secrets/env según design
- [x] 4.3 Step `Obtener URL del MCP` con `gcloud run services describe`; echo URL en español
- [x] 4.4 Actualizar step `Resumen del despliegue` para incluir URL MCP

## 5. Verificación manual

- [ ] 5.1 Local: `source set-env-local.sh && node mcp-http.mjs` — probar `/health` y conectar MCP Inspector a `http://localhost:8080/mcp`
- [ ] 5.2 Local: confirmar `ENVIRONMENT=prod node mcp-http.mjs` sale con error
- [ ] 5.3 Post-deploy pre-prod: curl `GET <mcp-url>/health`; conectar Claude Desktop/Claude.ai a `<mcp-url>/mcp` y listar herramientas
