## Why

Claude Desktop y Claude.ai requieren un servidor MCP **remoto** accesible por HTTP para conectarse sin depender de un proceso stdio local. Hoy `backend/mcp.mjs` solo expone transporte stdio (uso local con credenciales en la máquina del operador). Para habilitar pruebas integradas en pre-prod con datos de prueba, hace falta un endpoint MCP Streamable HTTP desplegado en Cloud Run — en una etapa intencionalmente **sin autenticación**, antes de agregar OAuth por usuario.

## What Changes

- **Factory compartida** `backend/mcpServer.mjs` con `createMcpServer()`: construye `McpServer`, instancia dependencias (db, servicios) y llama `registerMcpTools`. Usada por stdio y HTTP.
- **Refactor** de `backend/mcp.mjs`: consume la factory; comportamiento stdio **sin cambios** (Claude Desktop local sigue igual).
- **Nuevo entrypoint** `backend/mcp-http.mjs`: servidor HTTP con endpoint MCP en `/mcp` vía `StreamableHTTPServerTransport` (modo **stateless**, server+transport por request). `GET /health` → `{ status: 'ok' }`. Escucha en `process.env.PORT`, host `0.0.0.0`. **Sin middleware de auth**.
- **Salvaguarda anti-prod**: si `ENVIRONMENT === 'prod'`, `mcp-http.mjs` loguea error y `process.exit(1)`.
- **Despliegue pre-prod**: nuevo servicio Cloud Run `incrementa-mcp` reutilizando la **misma imagen** que `incrementa-backend`, con `--command node --args mcp-http.mjs`. Solo en proyecto `incrementa-gestion-dev`.
- **CI**: step en `.github/workflows/deploy-preprod.yml` para desplegar `incrementa-mcp` tras push de imagen backend (reusa tag `${{ github.sha }}`).

**Sin cambios en esta etapa:**

- Autenticación OAuth en el endpoint MCP (fase siguiente).
- Lógica de herramientas MCP (`mcpTools.mjs`): sigue actor fijo `MCP_USER_ID` (god-mode).
- Express API REST (`index.js` / `app.js`), frontend, migraciones.
- Dockerfile del backend (no se crea imagen nueva).

## Capabilities

### New Capabilities

- `mcp-remote-http`: Servidor MCP Streamable HTTP stateless en Cloud Run pre-prod, endpoint abierto `/mcp`, health check, salvaguarda anti-prod, despliegue vía CI reutilizando imagen backend.

### Modified Capabilities

- `backend-mcp-server`: Extraer factory compartida `createMcpServer()`; mantener entrypoint stdio; añadir entrypoint HTTP stateless.
- `preprod-deploy-workflow`: Desplegar servicio Cloud Run `incrementa-mcp` con imagen backend y comando `node mcp-http.mjs`.

## Impact

- **Backend**: nuevos `mcpServer.mjs`, `mcp-http.mjs`; refactor acotado de `mcp.mjs`. Sin dependencias nuevas (`@modelcontextprotocol/sdk` ^1.29.0 ya incluye `server/streamableHttp.js`).
- **Infra / CI**: step de deploy en `deploy-preprod.yml`; servicio Cloud Run `incrementa-mcp` en `incrementa-gestion-dev` (us-central1).
- **Operaciones**: URL pública del MCP en pre-prod (ej. `https://incrementa-mcp-….run.app/mcp`); configuración en Claude Desktop / Claude.ai apuntando a esa URL.
- **Local**: `node mcp-http.mjs` (con env vars vía `set-env-local.sh`) para smoke con MCP Inspector.

## Consideraciones de seguridad

- **Endpoint abierto intencional en pre-prod**: cualquier cliente con la URL puede invocar herramientas MCP con permisos del actor técnico `MCP_USER_ID` (`manage/all`). Aceptable solo porque pre-prod usa datos de prueba y la app es nueva; **no** es un modelo para producción.
- **Salvaguarda anti-prod**: `mcp-http.mjs` **no arranca** si `ENVIRONMENT=prod` (`process.exit(1)` con mensaje claro). Impide desplegar accidentalmente el modo abierto en producción.
- **Fase siguiente**: se agregará OAuth por usuario (Entra ID + capa de auth compatible con DCR de clientes Claude) antes de exponer MCP en producción. Ver `docs/mcp-remoto-opciones-auth.html`.
- **Cloud Run**: servicio `--allow-unauthenticated` a nivel de plataforma; el MCP no valida JWT ni API keys en esta etapa.
- **Credenciales runtime**: `DATABASE_URL`, `RESEND_API_KEY` vía Secret Manager; GCS vía ADC de la SA `incrementa-run-sa`. No commitear secretos ni incluirlos en la imagen.
- **Actor técnico**: las tools siguen operando como `00000000-0000-0000-0000-000000000001`; cualquier invocación remota tiene capacidad de mutación completa del ERP en la BD de pre-prod.
