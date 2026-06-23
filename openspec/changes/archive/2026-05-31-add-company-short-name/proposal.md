## Why

Los contratos referencian a la empresa contratante con un nombre abreviado o comercial (p. ej. "Dynamics" en lugar de "Dynamics Corp. SpA"), pero hoy solo existe `business_name` (razón social). Sin un campo dedicado, las plantillas deben hardcodear el nombre corto o usar la razón social completa, lo cual es impreciso y difícil de mantener.

## What Changes

- Migración `202606010004_add_short_name_to_company.js`: columna `short_name` NOT NULL en `company`, backfill desde `business_name` para filas existentes.
- Backend `companyService.js`: validación obligatoria en create (`requireAll: true`); en update, omitir si no se envía (`undefined`); incluir `short_name` en `listCompanies`.
- Variable de plantilla `company_nombre_comercial` en `buildSubstitutionMap`, `VARIABLE_META` y `variableCatalog.js` (grupo empresa, después de `company_legal_name`).
- Frontend: campo "Nombre comercial" obligatorio en formularios crear/editar (entre Razón Social y RUT), vista de empresa, y helpers de payload/validación.
- MCP `listar_empresas`: incluir `short_name` en respuesta.

**No se incluye**: columna en listado de empresas (`CompaniesListPage`); renombrar columna BD (permanece `short_name`).

## Capabilities

### New Capabilities

- `company-short-name`: Campo obligatorio `short_name` en entidad Empresa — migración, validación backend/frontend, formularios CRUD y vista de detalle.

### Modified Capabilities

- `document-builder-supplier-context`: Nueva variable `company_nombre_comercial` en mapa de sustitución y catálogo frontend.
- `backend-mcp-server`: Herramienta `listar_empresas` retorna `short_name` además de `business_name`.

## Impact

- **Base de datos**: columna `short_name TEXT NOT NULL` en tabla `company`; migración debe ejecutarse antes de desplegar backend.
- **API**: payloads de create/update de empresa aceptan `short_name`; listado incluye el campo; create rechaza ausencia con mensaje en español.
- **Constructor de documento**: plantillas pueden usar `{{company_nombre_comercial}}`; valor proviene de BD, no de overrides.
- **Frontend**: `CompanyCreateLayout`, `CompanyEditLayout`, `CompaniesCreateForm`, `CompaniesEditForm`, `CompaniesViewPage`, `companyFormPayload.js`, `variableCatalog.js`.
- **MCP**: respuesta de `listar_empresas` ampliada; reinicio de cliente MCP tras despliegue.
- **Tests**: actualizar tests de company API, variable context y MCP según patrones existentes.

## Consideraciones de seguridad

- `short_name` es dato de negocio no sensible; mismos permisos CASL existentes para mutación de empresa (`Company`).
- Validación obligatoria en backend (create) y frontend; no confiar solo en UI.
- En update parcial, ausencia de `short_name` no debe borrar valor existente (retorno `undefined` en validación con `requireAll: false`).
- Mensajes de error en español (es-CL); no exponer detalles de esquema en respuestas 500.
