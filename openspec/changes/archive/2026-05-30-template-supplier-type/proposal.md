## Why

Las plantillas estándar de contrato deben indicar si aplican a proveedores persona natural o empresa. Sin ese metadato, el Constructor y otros consumidores no pueden filtrar plantillas compatibles con el tipo del proveedor seleccionado, lo que expone opciones incorrectas y aumenta el riesgo de generar contratos con plantillas inadecuadas.

## What Changes

- Nueva columna `supplier_type` (`VARCHAR NOT NULL`) en la tabla `template`, con check constraint que solo acepta `'persona_natural'` o `'empresa'`.
- Migración numerada que, antes de aplicar el constraint NOT NULL: elimina plantillas con código que empiece por `PLANTILLA-` (seeds de desarrollo) y asigna `supplier_type = 'empresa'` a la plantilla con código `PL0001`.
- `standardTemplatesService`: aceptar `supplier_type` obligatorio en `createStandardTemplate` y `updateStandardTemplate`; filtrar opcionalmente por `supplier_type` en `listStandardTemplates`; incluir `supplier_type` en `mapTemplateRow` y en el listado.
- Endpoints GET `/api/standard-templates` y GET `/api/document-builder/templates`: aceptar query param `supplier_type` y propagarlo al servicio correspondiente.
- Validación en controladores: rechazar create/update sin `supplier_type` válido (HTTP 400, mensaje en español).
- Tests de backend para migración, servicio y APIs afectadas.

**Restricciones explícitas:** no modificar la tabla `template_standard` ni migraciones anteriores. Alcance de este cambio: base de datos y backend únicamente (sin frontend).

## Capabilities

### New Capabilities

- `standard-templates-supplier-type`: Metadato `supplier_type` en plantillas estándar (esquema BD, servicio, API CRUD y listado con filtro opcional).

### Modified Capabilities

- `document-builder-supplier-context`: `GET /api/document-builder/templates` SHALL aceptar filtro opcional `supplier_type` y devolver solo plantillas estándar compatibles con ese tipo.

## Impact

- **Base de datos:** nueva migración `202605300020_*` sobre `template`; eliminación de filas seed `PLANTILLA-*`; actualización de `PL0001`.
- **Backend:** `standardTemplatesService.js`, `standardTemplatesController.js`, `documentBuilderService.js`, `documentBuilderController.js`; tests en `standardTemplatesApi.test.js`, `documentBuilderApi.test.js` y posible test de migración.
- **Frontend / MCP:** sin cambios en este ajuste (consumidores podrán usar el query param en un ajuste posterior).
- **Seeds:** `006_gfa_template_seed.js` quedará inconsistente con el nuevo NOT NULL hasta un ajuste de seeds separado; la migración limpia los códigos `PLANTILLA-*` en bases existentes.

## Consideraciones de seguridad

- `supplier_type` no es dato personal; no introduce nuevos vectores de exposición de PII.
- La validación del valor permitido ocurre en backend (check constraint + validación de servicio/controlador) para evitar inyección de valores arbitrarios vía API.
- Los endpoints siguen protegidos por JWT OIDC y CASL existentes; el filtro no bypassa autorización de empresa en Document Builder.
