## 1. Utilidad numberToWords

- [x] 1.1 Crear `backend/utils/numberToWords.js` con `numberToWords(n)` para enteros ≥ 0 (reglas es-CL: veintiuno, cien/ciento, un millón, un mil)
- [x] 1.2 Agregar `backend/test/numberToWords.test.js` con casos obligatorios: 0, 21, 100, 101, 1_500_000, 2_350_000

## 2. Catálogo backend — VARIABLE_META y buildSubstitutionMap

- [x] 2.1 Actualizar `VARIABLE_META` en `documentBuilderService.js`: eliminar `proveedor_tipo`, `contract_type`, `work_schedule`, `signing_city`, `contract_date`; agregar variables nuevas con tipos y sources correctos
- [x] 2.2 Actualizar `buildSubstitutionMap` en `documentBuilderVariableContext.js`: eliminar variables obsoletas; agregar entradas base vacías para variables nuevas de contrato y proveedor social
- [x] 2.3 Actualizar `documentBuilderVariableContext.test.js`: quitar aserciones de `proveedor_tipo`; agregar tests para detección de missing en variables nuevas

## 3. Pares secundarios y buildMissingFields

- [x] 3.1 Definir `SECONDARY_FIELDS` en `documentBuilderService.js`
- [x] 3.2 Refactorizar `buildMissingFields(missingKeys, { clientRow, supplierRow })`: normalizar secundarios → primarios, desduplicar, agregar `pairField`, opciones social network con `{ label, values }`, fallback text si no hay redes
- [x] 3.3 Actualizar llamada en `generateAndPersist`: `buildMissingFields(missing, { clientRow, supplierRow: supplier })`

## 4. Preprocesamiento de overrides

- [x] 4.1 Implementar `preprocessMissingFieldOverrides(overrides)` en `documentBuilderService.js`: formateo miles para `cantidad_reels` y `precio_numero`; auto-generar `precio_texto` con `numberToWords`
- [x] 4.2 Invocar preprocess antes de `buildSubstitutionMap` en `generateAndPersist`
- [x] 4.3 Agregar tests en `documentBuilderService.dryRun.test.js` para formateo numérico, pares precio, y missing fields de redes sociales

## 5. Catálogo frontend

- [x] 5.1 Actualizar `frontend/src/data/variableCatalog.js`: grupo proveedor (eliminar `proveedor_tipo`, agregar redes sociales); grupo contrato (eliminar `contract_type`/`work_schedule`, agregar variables nuevas, reemplazar `signing_city` por `lugar_contrato`, `contract_date` por `fecha_contrato`)

## 6. Frontend MissingFieldInput

- [x] 6.1 Agregar soporte `type: 'number'` con `<input type="number" min="0">` en `DocumentBuilderPage.jsx`
- [x] 6.2 Agregar soporte select con opciones objeto `{ label, values }`: al seleccionar, despachar `setMissingField` para cada entry de `values`; mantener comportamiento string para `client_product_campaign`
- [x] 6.3 Verificar que `allMissingFieldsFilled` no requiera cambios (secundarios no están en `missingFieldDefs`)

## 7. MCP

- [x] 7.1 Actualizar descripción de `validar_contrato` en `backend/mcpTools.mjs`: opciones con `values`, campo `pairField`, type `number`
- [x] 7.2 Actualizar `backend/test/mcpServer.test.js` si hay aserciones sobre la descripción del tool

## 8. Tests de integración y limpieza

- [x] 8.1 Actualizar `documentBuilderApi.test.js` y `documentBuilderService.dryRun.test.js`: reemplazar `signing_city`/`contract_date` por `lugar_contrato`/`fecha_contrato` en fixtures
- [x] 8.2 Ejecutar suite de tests backend afectados y corregir fallos
