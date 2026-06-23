## Why

El catálogo de variables de plantilla conserva campos obsoletos del modelo laboral anterior (`proveedor_tipo`, `contract_type`, `work_schedule`, `signing_city`) y carece de variables necesarias para contratos comerciales actuales (redes sociales del proveedor, fechas/lugares de contrato, cantidades y precios). Sin estas variables y sin soporte para pares primario/secundario, el Constructor de Documento y las herramientas MCP no pueden capturar ni auto-completar datos contractuales clave.

## What Changes

- **Eliminar variables obsoletas** de `VARIABLE_META`, `variableCatalog.js` y `buildSubstitutionMap`: `proveedor_tipo`, `contract_type`, `work_schedule`, `signing_city`.
- **Agregar variables nuevas** al catálogo backend y frontend:
  - Proveedor: `proveedor_red_social` (select), `proveedor_cuenta_social` (text, secundario).
  - Contrato: `fecha_contrato` (date), `lugar_contrato` (text), `mes_ejecucion` (text), `cantidad_reels` (number), `precio_numero` (number), `precio_texto` (text, auto-generado).
- **Implementar pares primario/secundario** con constante `SECONDARY_FIELDS` y lógica en `buildMissingFields`: solo el primario aparece en missing fields; el secundario se llena automáticamente.
- **Par redes sociales**: select con opciones `{ label, values }` construidas desde `supplier.social_networks`; fallback a `type: 'text'` si no hay redes.
- **Par precio**: `precio_numero` ingresado por usuario; `precio_texto` auto-generado con `numberToWords(n)` en backend.
- **Preprocesamiento de overrides** en `generateAndPersist`: formateo chileno de miles para `cantidad_reels` y `precio_numero`; auto-generación de `precio_texto`.
- **Nueva utilidad** `backend/utils/numberToWords.js` para conversión entero → palabras en español.
- **Frontend `MissingFieldInput`**: soporte `type: 'number'` y opciones select con objeto `values` (despacho multi-campo).
- **MCP `validar_contrato`**: actualizar descripción para opciones con `values` y campo `pairField`.
- **BREAKING**: Plantillas que usen `proveedor_tipo`, `contract_type`, `work_schedule` o `signing_city` dejarán de resolver esos placeholders automáticamente; deben migrarse a las variables nuevas (p. ej. `signing_city` → `lugar_contrato`).

## Capabilities

### New Capabilities

- `number-to-words`: Utilidad backend que convierte enteros a palabras en español (es-CL, masculino genérico) para generar `precio_texto` desde `precio_numero`.
- `template-variable-pairs`: Comportamiento de variables emparejadas (primario/secundario) en missing fields, select con doble fill, y preprocesamiento de overrides numéricos.

### Modified Capabilities

- `enriched-missing-fields`: Catálogo `VARIABLE_META` actualizado, `SECONDARY_FIELDS`, `buildMissingFields` con `supplierRow`, tipos `number`, opciones con `values`, y preprocesamiento de overrides.
- `document-builder-supplier-context`: `buildSubstitutionMap` sin variables obsoletas y con entradas base vacías para variables nuevas; catálogo frontend actualizado.
- `backend-mcp-server`: Descripción de `validar_contrato` ampliada para pares y opciones con `values`.

## Impact

- **Backend**: `documentBuilderService.js`, `documentBuilderVariableContext.js`, nuevo `utils/numberToWords.js`, `mcpTools.mjs`; tests en `documentBuilderVariableContext.test.js`, `documentBuilderService.dryRun.test.js`, `documentBuilderApi.test.js`, `mcpServer.test.js`.
- **Frontend**: `variableCatalog.js`, `DocumentBuilderPage.jsx` (`MissingFieldInput`).
- **Sin cambios de BD**: no se modifican migraciones ni tablas; `signing_city` solo se elimina del catálogo en código.
- **Locale**: formateo numérico chileno (separador de miles con punto) aplicado solo a overrides, no a datos de BD.
- **Seguridad**: sin datos sensibles nuevos; validación de overrides numéricos en backend antes de formateo; inputs numéricos con `min="0"` en frontend.
