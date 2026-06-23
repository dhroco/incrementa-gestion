## Context

El backend Incrementa-Gestión expone un API REST Express con autenticación OIDC (Keycloak) y autorización CASL. Los servicios de dominio (`supplierService`, `standardTemplatesService`, `documentBuilderService`, `companyService`) encapsulan la lógica de negocio y ya se instancian en `app.js` con Knex, GCS y `getUserProfileIdByUserId`.

La migración `202605300019_mcp_service_profile` sembró el perfil `MCP_SERVICE` con usuario técnico `00000000-0000-0000-0000-000000000001` y grant `manage/all`. Claude Desktop ya tiene configurado un servidor MCP de referencia (`contratos-mcp`) con transporte stdio y patrón `server.tool()` del SDK `@modelcontextprotocol/sdk` v1.x (ESM).

Restricciones del cambio:
- Proceso MCP **independiente** de Express (`backend/mcp.mjs`); no modificar `index.js` ni `app.js`.
- Reutilizar servicios existentes por import directo (misma instancia Knex/GCS).
- Sin OIDC en MCP; actor fijo `MCP_USER_ID`.
- Variables de entorno inyectadas desde `claude_desktop_config.json` (no `SET_VARS_AMBIENTE_LOCAL.cmd`).

## Goals / Non-Goals

**Goals:**
- Exponer 8 herramientas MCP que orquesten servicios existentes con respuestas JSON legibles y descripciones orientadas a Claude.
- Permitir flujo conversacional: listar plantillas/empresas/proveedores → crear o actualizar proveedor → validar variables → generar contrato PDF.
- Configurar Claude Desktop con merge no destructivo de `mcpServers`.
- Verificar que `getUserProfileIdByUserId(MCP_USER_ID)` resuelve el perfil sembrado.

**Non-Goals:**
- Autenticación OIDC, tokens JWT ni middleware CASL en el proceso MCP.
- Nuevos endpoints HTTP ni cambios en frontend.
- Copiar o empaquetar el proyecto `contratos-mcp`.
- Herramientas MCP para usuarios plataforma, roles, dashboard u otros módulos.
- Exponer descarga de PDF por MCP (solo generación/validación en este cambio).

## Decisions

### 1. Entrypoint ESM con `createRequire` para módulos CommonJS

`@modelcontextprotocol/sdk` (v1.29+) exporta ESM (`import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'`). El backend usa CommonJS (`require`).

**Decisión:** archivo `backend/mcp.mjs` con `"type": "module"` implícito por extensión; usar `createRequire(import.meta.url)` para importar `./db/knex`, servicios, `profileService`, etc.

**Alternativa descartada:** convertir todo el backend a ESM — fuera de alcance.

### 2. Transporte stdio y proceso aislado

Claude Desktop lanza `node backend/mcp.mjs` como subproceso; comunicación por stdin/stdout.

**Alternativa descartada:** HTTP/SSE MCP compartiendo puerto Express — contradice requisito de proceso independiente y complica auth.

### 3. Actor fijo MCP_USER_ID

Constante exportada o definida en `mcp.mjs`:

```javascript
const MCP_USER_ID = '00000000-0000-0000-0000-000000000001'
```

Todas las llamadas a servicios pasan `userId: MCP_USER_ID`. No se consulta Keycloak.

**Alternativa descartada:** impersonar usuario humano vía token — requiere OIDC y no está en alcance.

### 4. Instanciación de servicios (réplica de `app.js`)

Al inicio de `mcp.mjs`:

```javascript
const { db } = require('./db/knex')
const { getUserProfileIdByUserId } = require('./services/profileService')
const supplierService = require('./services/supplierService')
const standardTemplatesService = createStandardTemplatesService({ db })
const documentBuilderService = createDocumentBuilderService({ db, gcsService, getUserProfileIdByUserId })
```

`companyService` no se usa para `listar_empresas`; se hace query directa `db('company')` como indicó el brief (listado simple id + nombre/razón social).

### 5. Patrón `server.tool()` con Zod y respuesta JSON uniforme

Seguir patrón de `contratos-mcp/index.js`: `McpServer`, `StdioServerTransport`, `server.tool(name, description, schema, handler)`.

Helper local `jsonToolResult(data)` serializa con `JSON.stringify(data, null, 2)` y retorna `{ content: [{ type: 'text', text }] }`. En errores de servicio (`ok: false`), incluir `{ ok: false, code, message, ...data }` sin stack trace.

**Alternativa descartada:** respuestas en prosa libre — inconsistente para Claude.

### 6. Herramientas y mapeo a servicios

| Herramienta | Implementación |
|-------------|----------------|
| `listar_plantillas` | `standardTemplatesService.listStandardTemplates({ search? })` |
| `listar_proveedores` | `supplierService.listSuppliers({ search? })` |
| `obtener_proveedor` | `supplierService.getSupplierById(id)` |
| `crear_proveedor` | `supplierService.createSupplier({ payload, userId: MCP_USER_ID })` |
| `actualizar_proveedor` | `supplierService.updateSupplier(id, { payload, userId: MCP_USER_ID })` |
| `listar_empresas` | `db('company').select('id', 'name', 'rut_display').orderBy('name')` (columnas mínimas útiles) |
| `validar_contrato` | `documentBuilderService.generateAndPersist({ userId, requestedCompanyId, body: { ..., dryRun: true } })` |
| `generar_contrato` | `documentBuilderService.generateAndPersist({ userId, requestedCompanyId, body })` |

Descripciones de herramientas (orientadas a Claude):
- `listar_proveedores`: enfatizar que debe llamarse **antes** de crear uno para verificar duplicados por RUT o nombre.
- `validar_contrato`: **no genera PDF ni escribe en BD/GCS**; solo reporta variables faltantes (`MISSING_PLACEHOLDERS`) o éxito de validación.
- `generar_contrato`: requiere `companyId`, `supplierId`, `template: { kind: 'standard', id }`; opcional `missingFieldOverrides`, `overwrite`.

Parámetros Zod con `.describe()` en español claro.

### 7. Extensión `dryRun` en `generateAndPersist`

Hoy `generateAndPersist` no tiene `dryRun`. Tras resolver placeholders y **antes** de comprobar duplicados/GCS/insert:

```javascript
if (body?.dryRun === true) {
  return { ok: true, data: { valid: true, message: 'Todas las variables están resueltas.' } }
}
```

Si hay `MISSING_PLACEHOLDERS`, comportamiento existente (422) — no escribe nada.

**Alternativa descartada:** duplicar lógica de validación en MCP — viola restricción de no duplicar negocio.

### 8. Variables de entorno y config Claude Desktop

El proceso MCP lee:
- `DATABASE_URL`, `PGSSLMODE` — Knex (vía `config.js` / env estándar del backend)
- `GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS` — GCS service
- `ENVIRONMENT` — opcional, default `local`

Merge en `%APPDATA%\Claude\claude_desktop_config.json`:

```json
"incrementa-gestion-mcp": {
  "command": "node",
  "args": [
    "C:\\Users\\Administrator\\Workspaces\\incrementa-gestion\\backend\\mcp.mjs"
  ],
  "env": {
    "ENVIRONMENT": "local",
    "DATABASE_URL": "<valor local>",
    "PGSSLMODE": "disable",
    "GCS_BUCKET": "<bucket>",
    "GOOGLE_APPLICATION_CREDENTIALS": "C:\\Users\\Administrator\\Workspaces\\incrementa-gestion\\backend\\gcs-credentials.json"
  }
}
```

Conservar entrada existente `contratos-mcp`. Documentar en tasks que el operador debe completar valores sensibles.

### 9. Script npm y dependencias

Agregar en `backend/package.json`:

```json
"scripts": { "mcp": "node mcp.mjs" },
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.29.0",
  "zod": "^3.24.0"
}
```

(Verificar versión zod compatible con SDK; contratos-mcp usa zod 4 — alinear con lo que resuelva npm en backend.)

### 10. Tests

`backend/test/mcpServer.test.js`: importar helpers de registro de herramientas (extraer `registerTools(server, deps)` desde `mcp.mjs` o módulo `mcpTools.js` para testabilidad) con servicios mockeados; verificar formato JSON y propagación de `MCP_USER_ID`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Actor MCP con `manage/all` puede mutar todo el ERP | Solo uso local; credenciales limitadas; documentar en README del cambio |
| SDK ESM + backend CJS frágil en imports | `createRequire`; smoke manual con Claude Desktop |
| `getUserProfileIdByUserId` retorna null si migración 019 no corrida | Test de arranque o herramienta de diagnóstico; mensaje claro en español |
| `dryRun` no detecta duplicados de borrador | Aceptable: validación es solo placeholders; duplicados se manejan en `generar_contrato` |
| Logs MCP en stdout rompen protocolo | Usar `console.error` para debug; nunca `console.log` en producción MCP |

## Migration Plan

1. Implementar `dryRun` en `documentBuilderService` + test unitario.
2. Crear `backend/mcp.mjs` (y opcional `mcpTools.js`).
3. Agregar script `npm run mcp` y dependencias si faltan.
4. Ejecutar migraciones (019) y verificar perfil MCP en BD local.
5. Merge manual de `claude_desktop_config.json`; reiniciar Claude Desktop.
6. Smoke: listar proveedores → validar contrato → generar contrato en entorno local.

**Rollback:** eliminar entrada `incrementa-gestion-mcp` de Claude config; borrar `mcp.mjs`; revertir `dryRun` si no se usa en HTTP (campo ignorado por API Express).

## Open Questions

- Valores exactos de `DATABASE_URL` y `GCS_BUCKET` para el entorno del operador (completar al aplicar tasks, no commitear secretos).
- ¿Extraer `registerTools` a `mcpTools.js` para tests? Recomendado en implementación; no bloqueante para el diseño.
