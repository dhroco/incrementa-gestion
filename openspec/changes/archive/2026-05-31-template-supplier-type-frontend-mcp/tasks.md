## 1. Formulario CRUD de plantillas

- [x] 1.1 En `StandardTemplateEditor.jsx`: añadir estado `supplierType` (default `'persona_natural'`), cargarlo en edit desde `t.supplier_type`, incluir `<select className="clause-input">` con opciones Persona Natural / Empresa en panel de metadatos
- [x] 1.2 Incluir `supplier_type` en payload de create/update; extender `canSubmit` para exigir valor válido (`persona_natural` | `empresa`)
- [x] 1.3 En `StandardTemplateViewPage.jsx`: mostrar tipo de proveedor en metadatos con `SupplierTypeChip` o etiqueta equivalente

## 2. Listado de plantillas

- [x] 2.1 En `StandardTemplatesListPage.jsx`: añadir columna sortable "Tipo de proveedor" que renderice `SupplierTypeChip` desde `row.supplier_type`
- [x] 2.2 Extender lógica de sort (`getValue`) para la nueva columna

## 3. Constructor de Documento

- [x] 3.1 En `documentBuilderApi.js`: extender `fetchDocumentBuilderTemplates` para aceptar `supplierType` y añadir `supplier_type` al query string junto con `companyId`
- [x] 3.2 En `DocumentBuilderPage.jsx`: derivar `selectedSupplier` y pasar `supplier_type` al fetch de plantillas; limpiar `templateSelected` al cambiar proveedor
- [x] 3.3 Actualizar `DocumentBuilderPage.test.jsx`: verificar que la llamada API incluye `supplier_type` del proveedor mock

## 4. MCP listar_plantillas

- [x] 4.1 En `mcpTools.mjs`: añadir parámetro opcional `supplier_type` (enum `persona_natural` | `empresa`) a `listar_plantillas`; pasarlo a `listStandardTemplates`; actualizar descripción de herramienta
- [x] 4.2 En `backend/test/mcpServer.test.js`: añadir test que invoque `listar_plantillas` con `supplier_type` y verifique filtrado

## 5. Verificación

- [x] 5.1 Ejecutar tests frontend y backend afectados (`DocumentBuilderPage.test.jsx`, `mcpServer.test.js`)
- [x] 5.2 Verificación manual: crear plantilla con tipo → listado muestra columna → Constructor filtra al seleccionar proveedor → MCP acepta `supplier_type` (reiniciar Claude Desktop tras despliegue MCP)
