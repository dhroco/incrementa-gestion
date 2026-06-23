## 1. Labels UI — Clientes

- [x] 1.1 Editar `frontend/src/pages/ClientFormSections.jsx`: reemplazar textos visibles «Campaña(s)» por «Producto/Campaña(s)» (título de bloque, placeholders, empty states, aria-labels, botones Agregar/Eliminar). No renombrar props ni variables.
- [x] 1.2 Editar `frontend/src/pages/ClientListPage.jsx`: cambiar header de columna «N° campañas» → «N° productos/campañas».
- [x] 1.3 Revisar `ClientViewPage.jsx` y `ClientUpsertPage.jsx` por strings sueltos (deben usar `ClientFormPageStack` sin labels adicionales).

## 2. Variable client_product_campaign — catálogos

- [x] 2.1 Editar `frontend/src/data/variableCatalog.js`: agregar `{ id: 'client_product_campaign', label: 'Producto/Campaña', description: 'Producto o campaña del cliente para este contrato' }` al grupo `client`.
- [x] 2.2 Editar `backend/services/documentBuilderVariableContext.js`: en `buildSubstitutionMap`, agregar `client_product_campaign: ''` al grupo client (valor solo vía overrides).
- [x] 2.3 Actualizar `backend/test/documentBuilderVariableContext.test.js`: escenarios de override y campo vacío por defecto.

## 3. Backend — protocolo enriquecido missingFields

- [x] 3.1 Editar `backend/services/documentBuilderService.js`: crear `VARIABLE_META`, `getVariableMeta(key)` y helper para construir `missingFields` desde `missingKeys` + `clientRow`.
- [x] 3.2 Reemplazar `data.missingFieldKeys` por `data.missingFields` en respuesta `MISSING_PLACEHOLDERS`; eliminar `missingFieldKeys`.
- [x] 3.3 Editar `backend/controllers/documentBuilderController.js`: HTTP 422 con `meta.missingFields` (sin `missingFieldKeys` en `error`).
- [x] 3.4 Actualizar `backend/test/documentBuilderService.dryRun.test.js` y `backend/test/documentBuilderApi.test.js` para assertar `missingFields` con shape `{ key, label, type, options? }`.

## 4. Frontend — API y Document Builder

- [x] 4.1 Editar `frontend/src/api/apiClient.js`: parsear `meta.missingFields` en 422; eliminar soporte de `missingFieldKeys`.
- [x] 4.2 Editar `frontend/src/pages/DocumentBuilderPage.jsx`: `useEffect` dry-run progresivo (deps: `templateSelected`, `selectedSupplierId`, `companyId`, `selectedClientId`; solo si `stage1Ok`); limpiar overrides al cambiar deps.
- [x] 4.3 Renderizar inputs según `type` (`text`, `date`, `select`); sección «Información adicional requerida» desde objetos enriquecidos.
- [x] 4.4 Habilitar botón Generar solo cuando todos los `missingFields` tienen valor en overrides; estado «listo» cuando dry-run `ok: true`.
- [x] 4.5 Actualizar manejo de error 422 en `executeGenerate` para leer `res.missingFields` en lugar de `res.missingFieldKeys`.

## 5. MCP

- [x] 5.1 Editar `backend/mcpTools.mjs`: reemplazar descripción de `validar_contrato` con guía sobre `data.missingFields`, tipos y `missingFieldOverrides`.
- [x] 5.2 Actualizar `backend/test/mcpServer.test.js` si asserta `missingFieldKeys` en validación.

## 6. Verificación

- [x] 6.1 `npm test` en backend — todos los tests de document builder y MCP pasan.
- [x] 6.2 Smoke manual: Clientes con labels correctos → Constructor con plantilla que usa `{{client_product_campaign}}` → dry-run muestra select con campañas → generar con override.
- [x] 6.3 Verificar flujo 409 duplicado sin regresiones.
- [x] 6.4 Reiniciar Claude Desktop tras cambios MCP (documentar en commit/PR si aplica).
