## 1. Dependencias y preparación

- [x] 1.1 Verificar/agregar en `backend/package.json`: `@modelcontextprotocol/sdk`, `zod`, script `"mcp": "node mcp.mjs"`; ejecutar `npm install` en backend
- [x] 1.2 Confirmar migración 019 aplicada y que `getUserProfileIdByUserId('00000000-0000-0000-0000-000000000001')` retorna un id (query manual o test rápido)

## 2. dryRun en documentBuilderService

- [x] 2.1 Editar `backend/services/documentBuilderService.js`: tras validación de placeholders, si `body.dryRun === true` retornar `{ ok: true, data: { valid: true, message: '...' } }` sin GCS ni inserts
- [x] 2.2 Agregar tests en `backend/test/documentBuilderService.test.js`: dry run éxito sin side effects; dry run con `MISSING_PLACEHOLDERS`; dry run no dispara `DUPLICATE_DRAFT`

## 3. Servidor MCP — bootstrap

- [x] 3.1 Crear `backend/mcp.mjs` con `createRequire`, constante `MCP_USER_ID`, instanciación de `db`, `supplierService`, `createStandardTemplatesService`, `createDocumentBuilderService`, `gcsService`, `getUserProfileIdByUserId` (patrón `app.js`)
- [x] 3.2 Crear helper `jsonToolResult(data)` y función `registerMcpTools(server, deps)` exportable para tests
- [x] 3.3 Conectar `McpServer` + `StdioServerTransport` al final de `mcp.mjs`

## 4. Herramientas MCP — proveedores y catálogos

- [x] 4.1 Registrar `listar_plantillas` → `standardTemplatesService.listStandardTemplates`; descripción para Claude sobre cuándo usarla
- [x] 4.2 Registrar `listar_proveedores` → `supplierService.listSuppliers`; descripción enfatizando verificar duplicados antes de crear
- [x] 4.3 Registrar `obtener_proveedor`, `crear_proveedor`, `actualizar_proveedor` con schemas Zod y `userId: MCP_USER_ID`
- [x] 4.4 Registrar `listar_empresas` → query Knex directa a tabla `company` (id, name, rut display)

## 5. Herramientas MCP — contratos

- [x] 5.1 Registrar `validar_contrato` → `generateAndPersist` con `dryRun: true`; descripción clara de que NO genera PDF
- [x] 5.2 Registrar `generar_contrato` → `generateAndPersist` sin dryRun; parámetros `companyId`, `supplierId`, `template`, `missingFieldOverrides?`, `overwrite?`
- [x] 5.3 Mapear respuestas de servicio (`MISSING_PLACEHOLDERS`, `DUPLICATE_DRAFT`, etc.) al JSON uniforme de herramientas

## 6. Tests MCP

- [x] 6.1 Crear `backend/test/mcpServer.test.js`: mock de servicios; verificar que handlers llaman servicios correctos con `MCP_USER_ID` y formato JSON de respuesta
- [x] 6.2 Ejecutar `npm test` en backend — suite completa verde

## 7. Claude Desktop y verificación manual

- [x] 7.1 Merge en `C:\Users\Administrator\AppData\Roaming\Claude\claude_desktop_config.json`: agregar `incrementa-gestion-mcp` conservando `contratos-mcp`; env `DATABASE_URL`, `PGSSLMODE`, `GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`, `ENVIRONMENT=local`
- [x] 7.2 Smoke local: `npm run mcp` con env vars (proceso arranca sin error); reiniciar Claude Desktop
- [x] 7.3 Smoke conversacional: listar proveedores → crear proveedor → listar plantillas/empresas → validar_contrato → generar_contrato
