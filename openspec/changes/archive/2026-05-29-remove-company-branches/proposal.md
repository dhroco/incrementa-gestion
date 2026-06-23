## Why

El producto simplifica el modelo de **Gestión de Empresas**: cada empresa se gestiona con sus datos directos, sin sub-entidades de sucursales. Mantener `company_branch`, UI de sucursales, validaciones y la variable `company_branches` en Document Builder añade complejidad sin valor para el alcance actual y fragmenta el flujo CRUD de empresas.

## What Changes

- **BREAKING**: Migración `202605290010_drop_company_branch_table.js` — `DROP TABLE company_branch CASCADE`.
- **BREAKING**: La API de empresas (`GET/POST/PUT /api/companies`) deja de aceptar y retornar el campo `branches`.
- **BREAKING**: Eliminación de rutas frontend `/sucursales/nueva` y `/sucursales/:branchKey` bajo creación/edición de empresa.
- **BREAKING**: Variable de template `company_branches` eliminada del catálogo y de `buildSubstitutionMap`; templates existentes que la usen quedarán sin resolver (aceptado).
- **Backend**: Limpiar `companyService.js` (validación, persistencia y lectura de sucursales), `documentBuilderService.js` (`branches_text`), `documentBuilderVariableContext.js` y seed `003_gfa_company_seed.js`.
- **Frontend**: Eliminar `CompanyBranchWorkPage.jsx` (+ test); quitar sección sucursales de formularios/vista; limpiar `companyFormPayload.js`, layouts de contexto, `AppRouter`, `variableCatalog.js` y `resolveCompanyVariablePreview.js`.
- **Tests**: Actualizar `companyApi.test.js`, `companyFormPayload.test.js`, `CompanyFormSections.test.js`, `resolveCompanyVariablePreview.test.js` y tests de document builder si referencian sucursales.

**No se modifica**: estructura CRUD de `company` (demás campos), grants de navegación de empresas, auth OIDC/Keycloak, proveedores, templates estándar ni otros módulos.

## Capabilities

### New Capabilities

- `remove-company-branches`: El sistema no modela, persiste ni expone sucursales; Gestión de Empresas (list, create, edit, view) opera solo con datos de la empresa; Document Builder ya no ofrece la variable `company_branches`.

### Modified Capabilities

- `document-builder-supplier-context`: `buildSubstitutionMap` y el catálogo de variables ya no incluyen `company_branches`; las demás variables `company_*` y `proveedor_*` permanecen.

## Impact

- **Base de datos**: datos de `company_branch` eliminados irreversiblemente al ejecutar la migración.
- **API**: respuestas de detalle/creación/edición de empresa sin array `branches`; payloads con `branches` son ignorados o rechazados según validación residual (idealmente ignorados sin error si el campo desaparece del contrato).
- **Frontend**: formularios de empresa más simples; desaparece el área de trabajo de sucursales; context de `CompanyCreateLayout` / `CompanyEditLayout` sin estado `branches`.
- **Document Builder**: generación sigue operativa; `{{company_branches}}` en templates históricos produce texto vacío o placeholder.
- **Tests**: ajuste de payloads y expectativas en tests de empresa y variables.

## Consideraciones de seguridad

- Migración destructiva: ejecutar primero en `local`/`dev`; respaldar BD antes de `migrate:latest` en GCP.
- Endpoints de empresas siguen protegidos por JWT y grants de navegación existentes; no se relajan permisos al eliminar sucursales.
- Mensajes de validación al usuario permanecen en español (es-CL).
