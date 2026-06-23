## Why

El producto consolidó el alcance en **templates estándar** como única fuente de plantillas reutilizables. Mantener el módulo "Templates por Empresa" (`template_company`, API `/api/company-templates`, UI dedicada y grants de navegación) duplica funcionalidad, aumenta superficie de mantenimiento y confunde al usuario. Este cambio alinea código, base de datos, menú y Document Builder con el alcance real del producto.

## What Changes

- **BREAKING**: Eliminación completa de la API `/api/company-templates/*` (listar, crear, obtener, editar).
- **BREAKING**: Eliminación de rutas frontend `/app/gestion-contratos/templates-por-empresa/*` (listado, vista, crear, editar).
- **BREAKING**: Migración `202605290008_drop_template_company_table.js`: eliminar constraint `generated_document_one_template_ck`, columna `company_template_id` e índices asociados en `generated_document`; `DROP TABLE template_company CASCADE`.
- **BREAKING**: Migración `202605290009_drop_company_templates_navigation_nodes.js`: eliminar nodos y grants cuyo `code` contenga `TEMPLATES_POR_EMPRESA` (patrón usado en migraciones de trabajadores/cláusulas).
- **Backend**: Eliminar `companyTemplatesController.js`, `companyTemplatesService.js`, tests `companyTemplatesApi.test.js`; limpiar rutas e imports en `app.js`.
- **Backend**: Simplificar `documentBuilderService.js` para operar solo con templates estándar (`getTemplateRow`, `listEligibleTemplates`, `generateAndPersist` sin `company_template_id` ni `kind='company'`).
- **Frontend**: Eliminar páginas `CompanyTemplates*.jsx`, `companyTemplatesApi.js`; limpiar `AppRouter`, `platformPaths`, `sidebarIconography`.
- **Frontend**: Simplificar `StandardTemplateEditor.jsx` (eliminar prop `scope`, `companyId` y lógica condicional por empresa).
- **Frontend**: Simplificar `DocumentBuilderPage.jsx` y `DocumentBuilderPreviewPage.jsx` para mostrar/usar solo templates estándar.
- **Seeds**: Quitar ítems/acciones/grants `NAV_*TEMPLATES_POR_EMPRESA*` de `002_navigation_authorization_seed.js`; limpiar referencias a `template_company` en `003_gfa_company_seed.js` y `006_gfa_template_seed.js`.
- **Migraciones de grants históricos** (`202604250001`, `202604250003`): quitar solo entradas `NAV_*TEMPLATES_POR_EMPRESA*` del array `CODES` (mantener grants de templates estándar).

**No se modifica**: tabla base `template`, módulo de templates estándar (`standardTemplatesController`, `standardTemplatesService`, páginas `StandardTemplates*`), `backend/utils/templateContentJson.js`, auth OIDC/Keycloak, empresas, proveedores.

## Capabilities

### New Capabilities

- `drop-company-templates-module`: El sistema no expone CRUD ni navegación de templates por empresa; la tabla `template_company` y la columna `company_template_id` en `generated_document` quedan eliminadas; el menú de contratos no incluye "Templates por empresa".

### Modified Capabilities

- `document-builder-supplier-context`: El Document Builder (`listEligibleTemplates`, `generate`) opera exclusivamente con templates estándar; la UI no muestra sección de templates por empresa.

## Impact

- **Base de datos**: datos de `template_company` eliminados irreversiblemente en `up` de la migración; filas históricas en `generated_document` que referenciaban company templates pierden esa referencia (columna eliminada).
- **API**: endpoints `/api/company-templates/*` dejan de existir (404 en clientes antiguos).
- **Frontend**: menú de contratos sin submódulo "Templates por empresa"; editor de templates unificado en modo estándar.
- **Document Builder**: selector de plantilla muestra solo templates estándar; requests con `kind: 'company'` dejan de ser válidos.
- **Tests**: eliminar `companyTemplatesApi.test.js`; actualizar tests de document builder y preview que mockean `companyTemplatesApi`.

## Consideraciones de seguridad

- Migración destructiva: ejecutar primero en `local`/`dev`; respaldar BD antes de `migrate:latest` en GCP.
- Eliminar grants y rutas de templates por empresa evita acceso a funcionalidad retirada vía navegación o API directa.
- Endpoints de templates estándar y document builder deben seguir validando JWT y grants de navegación existentes.
- Mensajes de error al usuario permanecen en español (es-CL).
