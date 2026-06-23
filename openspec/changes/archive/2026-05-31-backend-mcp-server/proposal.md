## Why

Claude Desktop y otros clientes MCP necesitan operar el ERP de Incrementa de forma conversacional (consultar proveedores, crear registros y validar/generar contratos) sin pasar por la UI web ni duplicar la lógica de negocio que ya vive en los servicios del backend Express. El perfil técnico `MCP_SERVICE` ya existe en base de datos; falta el proceso MCP que lo use como actor fijo y exponga las operaciones clave como herramientas bien descritas.

## What Changes

- Nuevo proceso independiente `backend/mcp.mjs` (o `mcp.js` según formato del SDK): servidor MCP con transporte **stdio**, sin compartir puerto ni ciclo de vida con Express.
- Actor fijo `MCP_USER_ID = '00000000-0000-0000-0000-000000000001'` para todas las operaciones; sin autenticación OIDC en el proceso MCP.
- Instanciación directa de servicios existentes (`supplierService`, `createStandardTemplatesService`, `createDocumentBuilderService`, Knex `db`, `gcsService`, `getUserProfileIdByUserId`) replicando el patrón de `app.js` — **sin** llamadas HTTP internas.
- Ocho herramientas MCP con descripciones orientadas a Claude y respuestas JSON legibles consistentes:
  - `listar_plantillas`, `listar_proveedores`, `obtener_proveedor`, `crear_proveedor`, `actualizar_proveedor`, `listar_empresas`, `validar_contrato`, `generar_contrato`.
- Extensión mínima de `documentBuilderService.generateAndPersist`: soporte `dryRun: true` para validación sin persistir (herramienta `validar_contrato`).
- Script npm `mcp` en `backend/package.json` para lanzar el servidor.
- Merge de entrada `incrementa-gestion-mcp` en `claude_desktop_config.json` del usuario (conservar servidores existentes como `contratos-mcp`).
- Tests unitarios del servidor MCP (handlers de herramientas y formato de respuesta).

**Restricciones explícitas:** no modificar `backend/index.js` ni `backend/app.js`. `contratos-mcp` es solo referencia de patrón `server.tool()` — no integrar ni copiar su código.

## Capabilities

### New Capabilities

- `backend-mcp-server`: Proceso MCP stdio que expone herramientas ERP (proveedores, empresas, plantillas, validación/generación de contratos) reutilizando servicios del backend con actor técnico MCP.

### Modified Capabilities

- `document-builder-supplier-context`: `generateAndPersist` SHALL aceptar `dryRun: true` en el body y, cuando está activo, ejecutar validación de placeholders y resolución de contexto sin escribir en GCS ni insertar filas en `document`.

## Impact

- **Backend**: nuevo archivo `backend/mcp.mjs` (entrypoint MCP), posible helper de respuesta JSON; cambio acotado en `documentBuilderService.js` para `dryRun`; dependencias `@modelcontextprotocol/sdk` y `zod` en `package.json` (ya previstas en el branch).
- **Express / frontend**: sin cambios en rutas HTTP ni UI.
- **Base de datos**: sin migraciones nuevas; usa perfil `MCP_SERVICE` de migración 019.
- **Infra local**: variables de entorno inyectadas desde Claude Desktop (`DATABASE_URL`, `PGSSLMODE`, `GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`); el proceso MCP no usa `SET_VARS_AMBIENTE_LOCAL.cmd`.
- **Seguridad**: el actor MCP tiene `manage/all` en CASL; el servidor solo debe ejecutarse en máquinas de confianza con credenciales GCP/DB limitadas al entorno local/dev. No sustituye JWT humano en producción sin controles adicionales.

## Consideraciones de seguridad

- El UUID técnico MCP tiene permiso `manage`/`all`; cualquier cliente MCP con acceso al proceso puede mutar datos del ERP. Restringir la configuración de Claude Desktop y las credenciales de BD/GCS al entorno de desarrollo.
- Validaciones de negocio (RUT chileno, campos condicionales por tipo de proveedor) siguen en `supplierService`; el MCP no debe omitirlas ni reimplementarlas.
- Errores expuestos a Claude deben ser mensajes en español (es-CL) provenientes de los servicios, sin filtrar stack traces ni detalles internos de PostgreSQL.
- `getUserProfileIdByUserId(MCP_USER_ID)` debe resolver el `user_profile.id` sembrado por migración 019; si falla, las operaciones con auditoría (`createSupplier`, `generateAndPersist`) deben reportar error claro.
