## Why

Las plantillas estándar usan tres estados (`draft`, `active`, `inactive`), pero el cliente confirmó que no hay diferencia operativa entre **Borrador** e **Inactivo**. Mantener ambos estados genera confusión en administración, etiquetado inconsistente y riesgo de que flujos conversacionales (MCP) expongan plantillas no utilizables. Simplificar a `active` e `inactive` alinea el modelo de datos con el uso real y reduce superficie de error.

## What Changes

- **BREAKING (datos):** migración que convierte filas `draft` → `inactive`, elimina `draft` del check constraint y cambia el default de columna a `'inactive'`.
- `standardTemplatesService`: defaults y validación de status solo `active` | `inactive`; filtro opcional `status` en `listStandardTemplates` (uso interno/MCP, sin cambiar firma pública del REST admin).
- MCP `listar_plantillas`: invoca el listado con `status: 'active'` para no ofrecer plantillas inactivas en conversaciones.
- Frontend admin: editor de plantillas sin opción Borrador; nuevas plantillas nacen como Inactivo; mapeo de etiquetas sin fallback a "Borrador".
- Tests backend/frontend afectados actualizados (`standardTemplatesApi`, `mcpServer`, util `templateStatus`).

**Sin cambios explícitos en este ajuste:**

- `dashboardService.js` (ya filtra por `active`).
- Seeds (ya usan `active`).
- Filtro de status en `StandardTemplatesListPage` (sigue mostrando activas e inactivas).
- Firma pública de `GET /api/standard-templates` (sin nuevo query param expuesto).
- `documentBuilderService` / Constructor (comportamiento heredado del endpoint existente).

## Capabilities

### New Capabilities

- `standard-templates-status`: Modelo de estados de plantilla (`active` | `inactive`), migración de datos, validación en servicio CRUD, UI admin y util de etiquetas en español.

### Modified Capabilities

- `backend-mcp-server`: `listar_plantillas` SHALL retornar solo plantillas con status `active`.

## Impact

- **Base de datos:** nueva migración `202606010001_simplify_template_status.js` sobre `template.status`.
- **Backend:** `standardTemplatesService.js`, `mcpTools.mjs`; tests `standardTemplatesApi.test.js`, `mcpServer.test.js`.
- **Frontend:** `StandardTemplateEditor.jsx`, `templateStatus.js`; listado y vista usan el mapper actualizado (plantillas antes `draft` se muestran como "Inactivo" tras migración).
- **MCP / Claude Desktop:** requiere reinicio del cliente MCP tras desplegar cambio en `mcpTools.mjs`.
- **Operaciones:** ejecutar `knex migrate:latest` desde `backend/` con variables de entorno cargadas.

## Consideraciones de seguridad

- El cambio no expone datos sensibles adicionales; reduce el riesgo de que asistentes conversacionales generen contratos con plantillas no activas.
- Validación de status permanece en backend (servicio + check constraint PostgreSQL); valores inválidos rechazados con mensajes en español en la API admin existente.
- Autorización CASL/JWT sin cambios; el filtro `active` en MCP es una restricción de negocio, no un bypass de permisos.
