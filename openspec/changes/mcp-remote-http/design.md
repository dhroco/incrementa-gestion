## Context

El backend expone un servidor MCP stdio en `backend/mcp.mjs` que registra herramientas ERP vía `registerMcpTools` (`mcpTools.mjs`) con actor fijo `MCP_USER_ID`. Las herramientas reutilizan servicios de dominio (Knex, GCS, supplier/client/contract services) sin pasar por HTTP Express.

El SDK `@modelcontextprotocol/sdk` ^1.29.0 incluye `StreamableHTTPServerTransport` en `server/streamableHttp.js`, compatible con clientes Claude Desktop y Claude.ai en modo remoto. Cloud Run pre-prod ya despliega `incrementa-backend` con imagen Docker, conector Cloud SQL, SA runtime y secretos.

Restricciones del cambio:
- **No romper** el MCP stdio local.
- **Sin auth** en esta etapa (endpoint abierto); salvaguarda `ENVIRONMENT !== 'prod'`.
- **Stateless** Streamable HTTP (sin sesiones persistentes) para autoescalado multi-instancia en Cloud Run.
- **Reusar** imagen backend existente; no nuevo Dockerfile ni build pipeline.
- **Sin dependencias nuevas**.

## Goals / Non-Goals

**Goals:**
- Exponer MCP en `/mcp` por Streamable HTTP stateless, desplegable en Cloud Run pre-prod.
- Extraer factory compartida para evitar duplicar bootstrap de servicios entre stdio y HTTP.
- Health check `GET /health` para Cloud Run / operaciones.
- CI automatizado: deploy `incrementa-mcp` en push a `preprod`.
- Mantener actor fijo `MCP_USER_ID` y todas las tools existentes sin cambios de comportamiento.

**Non-Goals:**
- OAuth, JWT, API keys o CASL por request en el endpoint MCP (fase siguiente).
- Modificar `app.js`, rutas REST ni frontend.
- Desplegar MCP remoto en producción del cliente.
- Crear imagen Docker separada para MCP.
- Cambiar contratos de las herramientas MCP ni permisos del actor técnico.

## Decisions

### 1. Factory compartida `backend/mcpServer.mjs`

Exportar `createMcpServer()` que:
1. Usa `createRequire(import.meta.url)` para módulos CJS (mismo patrón que `mcp.mjs` actual).
2. Instancia `db`, servicios y factories (`standardTemplatesService`, `documentBuilderService`, `contractsQueryService`, `contractSigningService`).
3. Crea `new McpServer({ name: 'incrementa-gestion-mcp', version: '1.0.0' })`.
4. Llama `registerMcpTools(server, deps)`.
5. Retorna `{ server }` (y opcionalmente `deps` si tests lo necesitan).

`mcp.mjs` queda reducido a: import factory → `createMcpServer()` → `StdioServerTransport` → `server.connect(transport)`.

**Alternativa descartada:** duplicar bootstrap en `mcp-http.mjs` — divergencia inevitable entre entrypoints.

### 2. Entrypoint HTTP `backend/mcp-http.mjs`

Servidor HTTP minimalista (Node `http` nativo o Express ligero — preferir **http nativo** para evitar acoplar al stack Express del API; si el equipo prefiere consistencia, Express standalone sin montar `app.js` también es válido).

Endpoints:
| Método | Ruta | Comportamiento |
|--------|------|----------------|
| GET | `/health` | `200` JSON `{ status: 'ok' }` |
| POST | `/mcp` | Streamable HTTP MCP (stateless) |
| GET | `/mcp` | SSE stream según SDK (stateless) |
| DELETE | `/mcp` | Cierre de sesión según SDK (stateless: no-op o handler mínimo) |

**Modo stateless** (patrón oficial SDK): por cada request MCP, crear **nuevo** `McpServer` (vía factory) + **nuevo** `StreamableHTTPServerTransport` con `sessionIdGenerator: undefined`. Conectar server al transport y delegar el request. No mantener mapa de sesiones en memoria.

Pseudocódigo:

```javascript
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const config = require('./config')

if (config.ENVIRONMENT === 'prod') {
  console.error('mcp-http.mjs: modo HTTP abierto no permitido en producción (ENVIRONMENT=prod)')
  process.exit(1)
}

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './mcpServer.mjs'

const PORT = process.env.PORT || 8080
const HOST = '0.0.0.0'

// POST /mcp
async function handleMcpRequest(req, res) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined // stateless
  })
  const { server } = createMcpServer()
  await server.connect(transport)
  await transport.handleRequest(req, res)
}

// GET /health → 200 { status: 'ok' }
```

Escuchar en `process.env.PORT` (Cloud Run inyecta 8080) y `0.0.0.0`.

**Alternativa descartada:** modo stateful con sesiones en memoria — incompatible con múltiples instancias Cloud Run sin sticky sessions.

**Alternativa descartada:** montar MCP en Express `app.js` — acopla lifecycleState HTTP MCP al API REST y complica despliegue independiente.

### 3. Salvaguarda anti-prod

Al inicio de `mcp-http.mjs`, leer `config.ENVIRONMENT` (desde `_${./config.js}`). Si es `'prod'`:
- Log a stderr: mensaje en español indicando que el MCP HTTP abierto no está permitido en producción.
- `process.exit(1)`.

Permite `local` y `dev` (pre-prod usa `ENVIRONMENT=dev`).

### 4. Despliegue Cloud Run `incrementa-mcp`

Reutilizar imagen backend ya en Artifact Registry:

```bash
gcloud run deploy incrementa-mcp \
  --project incrementa-gestion-dev \
  --region us-central1 \
  --platform=managed \
  --image us-central1-docker.pkg.dev/incrementa-gestion-dev/incrementa/backend:${SHA} \
  --command node \
  --args mcp-http.mjs \
  --service-account incrementa-run-sa@incrementa-gestion-dev.iam.gserviceaccount.com \
  --add-cloudsql-instances incrementa-gestion-dev:us-central1:incrementa-db \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,RESEND_API_KEY=RESEND_API_KEY:latest \
  --set-env-vars ENVIRONMENT=dev,GCS_BUCKET=incrementa-contratos-dev,RESEND_FROM_EMAIL=onboarding@resend.dev \
  --allow-unauthenticated \
  --quiet
```

**No setear:** `PORT`, `GOOGLE_APPLICATION_CREDENTIALS`, `PGSSLMODE`, `OIDC_*`, `GRAPH_*`, `CORS_ORIGIN`.

Secrets mínimos: `DATABASE_URL` (Cloud SQL), `RESEND_API_KEY` (firma de contratos vía MCP). OIDC/Graph no requeridos — MCP no autentica usuarios.

### 5. CI: step en deploy-preprod.yml

Insertar **después** del push de imagen backend (paso a), **antes o en paralelo** con deploy backend — no depende de URLs frontend/backend:

1. Agregar env `MCP_SERVICE: incrementa-mcp`.
2. Step `Deploy MCP a Cloud Run` con flags anteriores.
3. Step `Obtener URL del MCP` con `gcloud run services describe` → output + echo en español.
4. Incluir URL MCP en step `Resumen del despliegue`.

No altera el orden de los 5 pasos existentes (backend → frontend → CORS); el deploy MCP es independiente y puede ir justo después del push backend.

### 6. Script npm (opcional)

Agregar `"mcp:http": "node mcp-http.mjs"` en `backend/package.json` para smoke local. Mantener `"mcp": "node mcp.mjs"` sin cambios.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Endpoint público sin auth en pre-prod | Solo `incrementa-gestion-dev`; datos de prueba; salvaguarda anti-prod; documentar en proposal |
| Actor MCP con `manage/all` expuesto en internet | Limitar conocimiento de URL; fase OAuth siguiente; no desplegar en prod |
| Stateless: overhead por request (nuevo server+transport) | Aceptable para pre-prod / bajo tráfico; Cloud Run escala horizontalmente |
| SDK streamable HTTP API cambia entre versiones | Fijar `@modelcontextprotocol/sdk` ^1.29.0; seguir ejemplo oficial stateless |
| Logs en stdout rompen protocolo MCP stdio | Solo aplica a stdio; HTTP usa respuestas HTTP — usar stderr para logs en ambos |
| URL filtrada → abuso de herramientas | Rotar/restringir en fase OAuth; monitoreo Cloud Run logs |

## Migration Plan

1. Implementar `mcpServer.mjs` y refactor `mcp.mjs` — verificar `npm run mcp` (stdio) sin regresión.
2. Implementar `mcp-http.mjs` — smoke local con MCP Inspector en `http://localhost:8080/mcp`.
3. Verificar salvaguarda: `ENVIRONMENT=prod node mcp-http.mjs` → exit 1.
4. Merge a `preprod` → CI despliega `incrementa-mcp`.
5. Configurar Claude Desktop / Claude.ai con URL remota `https://…/mcp`.
6. Smoke remoto: listar proveedores, health check.

**Rollback:** eliminar servicio Cloud Run `incrementa-mcp`; revertir step CI; `mcp.mjs` stdio sigue operativo vía factory.

## Open Questions

- ¿Usar `http` nativo vs Express standalone en `mcp-http.mjs`? Recomendación: **http nativo** (menor superficie, sin middleware accidental). Implementación puede elegir Express si simplifica routing GET/POST/DELETE en `/mcp`.
- ¿Agregar tests automatizados para `/health` y salvaguarda prod? Recomendado en tasks; no bloqueante para diseño.
