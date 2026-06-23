## Why

El módulo Clientes ya persiste productos/campañas por cliente, pero la UI aún dice «Campaña» y las plantillas no exponen la variable `client_product_campaign`. Además, cuando faltan placeholders en el Constructor de Documento o vía MCP, el backend solo devuelve claves planas (`missingFieldKeys`), lo que impide renderizar el input correcto (texto, fecha o select con opciones del cliente). Estas tres mejoras coordinadas alinean terminología, catálogo de variables y protocolo de validación para una experiencia consistente en web y Claude Desktop.

## What Changes

- **Labels UI Clientes**: Reemplazar textos visibles «Campaña(s)» por «Producto/Campaña(s)» en `ClientFormSections.jsx` y `ClientListPage.jsx` (columna de listado). Sin renombrar variables, props ni columnas de BD.
- **Variable `client_product_campaign`**: Agregar al catálogo frontend (`variableCatalog.js`) y a `buildSubstitutionMap` con valor base vacío (solo se resuelve vía `missingFieldOverrides`).
- **Protocolo enriquecido de campos faltantes** (**BREAKING** para consumidores de `missingFieldKeys`):
  - Backend: mapa estático `VARIABLE_META` con `label`, `type` y opciones dinámicas para `client_product_campaign` cuando el cliente tiene campañas.
  - Respuesta `MISSING_PLACEHOLDERS` usa `missingFields: [{ key, label, type, options? }]` en lugar de `missingFieldKeys`.
  - Controller HTTP 422 expone `meta.missingFields` al frontend.
  - Frontend Document Builder: dry-run progresivo al seleccionar plantilla; inputs según `type`; botón Generar habilitado solo con todos los campos completos.
  - MCP: actualizar descripción de `validar_contrato` para guiar a Claude sobre tipos y `missingFieldOverrides`.

## Capabilities

### New Capabilities

- `enriched-missing-fields`: Protocolo estructurado de campos faltantes en generación de documentos (metadatos por variable, dry-run progresivo en UI, inputs tipados, contrato HTTP 422 y guía MCP).

### Modified Capabilities

- `clients-admin`: Labels de UI «Producto/Campaña» en formularios y listado (sin cambio de esquema ni API).
- `document-builder-client-context`: Nueva variable `client_product_campaign` en catálogo y sustitución; campos faltantes enriquecidos cuando la plantilla la requiere.
- `backend-mcp-server`: Descripción ampliada de `validar_contrato` documentando `data.missingFields` con tipos y flujo de overrides.

## Impact

- **Frontend**: `ClientFormSections.jsx`, `ClientListPage.jsx`, `variableCatalog.js`, `DocumentBuilderPage.jsx`, `apiClient.js` (lectura de `missingFields`).
- **Backend**: `documentBuilderVariableContext.js`, `documentBuilderService.js`, `documentBuilderController.js`, `mcpTools.mjs`.
- **Tests**: `documentBuilderService.dryRun.test.js`, `documentBuilderApi.test.js`, posible ajuste en `mcpServer.test.js`.
- **API**: Respuesta 422 de `POST /api/document-builder/generate` — **BREAKING**: elimina `missingFieldKeys`; usa `meta.missingFields`.
- **MCP**: Sin cambio de firma de herramientas; solo descripción de `validar_contrato`. Reinicio de Claude Desktop recomendado tras despliegue.

## Consideraciones de seguridad

- Los metadatos de campos faltantes no exponen datos sensibles adicionales: las opciones de `client_product_campaign` son nombres de campaña ya visibles al usuario autorizado que seleccionó el cliente.
- Validación de overrides sigue en backend vía `generateAndPersist`; el frontend y MCP solo presentan inputs — no confiar en valores del cliente sin re-validar en servidor.
- Mensajes de error en español (es-CL); no filtrar detalles internos de BD en respuestas 422/500.
