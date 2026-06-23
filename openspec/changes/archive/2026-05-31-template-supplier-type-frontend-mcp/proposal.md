## Why

El backend ya persiste y expone `supplier_type` en plantillas estándar (Ajuste 1 — BD y Backend), pero la UI de administración y el Constructor de Documento siguen mostrando todas las plantillas sin distinguir tipo de proveedor. El flujo MCP tampoco permite filtrar por tipo una vez identificado el proveedor. Esto expone plantillas incompatibles y aumenta el riesgo de generar contratos con plantillas incorrectas.

## What Changes

- **Módulo Plantillas (CRUD):** selector obligatorio "Tipo de proveedor" (Persona Natural / Empresa) en crear y editar; columna informativa en listado; campo visible en vista de solo lectura.
- **Constructor de Documento (web):** filtrar automáticamente plantillas según `supplier_type` del proveedor seleccionado, pasando el query param a `GET /api/document-builder/templates` — sin preguntar al usuario.
- **API client frontend:** incluir `supplier_type` en payloads de create/update de plantillas; soportar query param en `fetchDocumentBuilderTemplates`.
- **MCP:** agregar parámetro opcional `supplier_type` a `listar_plantillas` en `mcpTools.mjs`, con descripción que indique usarlo una vez conocido el tipo del proveedor.
- **Tests:** actualizar tests de frontend (Document Builder, plantillas) y MCP para cubrir el nuevo comportamiento.

**Restricciones explícitas:** no crear componente nuevo para el selector (usar patrón `<select className="clause-input">` existente); no modificar `app.js` ni rutas backend; no cambiar lógica de servicio backend (ya implementada).

## Capabilities

### New Capabilities

_(ninguna — extiende capacidades existentes con requisitos de UI y MCP)_

### Modified Capabilities

- `standard-templates-supplier-type`: requisitos de UI para capturar, mostrar y validar `supplier_type` en formularios CRUD y listado de plantillas.
- `document-builder-supplier-context`: filtrado automático de plantillas en el Constructor según el tipo del proveedor seleccionado.
- `backend-mcp-server`: parámetro opcional `supplier_type` en herramienta `listar_plantillas`.

## Impact

- **Frontend:** `StandardTemplateEditor.jsx`, `StandardTemplateViewPage.jsx`, `StandardTemplatesListPage.jsx`, `DocumentBuilderPage.jsx`, `documentBuilderApi.js`, `standardTemplatesApi.js`; tests en `DocumentBuilderPage.test.jsx` y posibles tests de plantillas.
- **MCP:** `backend/mcpTools.mjs`; test en `backend/test/mcpServer.test.js`.
- **Backend API:** sin cambios de código (endpoints ya soportan `supplier_type`).
- **Operacional:** tras desplegar cambio MCP, reiniciar Claude Desktop para registrar el nuevo parámetro en `listar_plantillas`.

## Consideraciones de seguridad

- `supplier_type` no es dato personal; no introduce nuevos vectores de exposición de PII.
- La validación obligatoria en formulario es defensa en profundidad; el backend ya rechaza create/update sin tipo válido.
- El filtrado en Constructor reduce exposición de plantillas inadecuadas pero no bypassa autorización CASL existente.
- Mensajes de error del backend se muestran en español (es-CL) sin cambios adicionales.
