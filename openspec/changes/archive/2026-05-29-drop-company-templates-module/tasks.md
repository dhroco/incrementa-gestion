## 1. Base de datos



- [x] 1.1 Crear `backend/migrations/202605290008_drop_template_company_table.js`: `up` — verificar y dropear constraint `generated_document_one_template_ck` si existe; dropear columna `company_template_id` de `generated_document` si existe; `DROP TABLE IF EXISTS template_company CASCADE`; `down` — recrear `template_company` con estructura mínima de `202604160003` + columna `code` de `202604220001`, recrear columna `company_template_id` y constraint XOR (sin datos)

- [x] 1.2 Crear `backend/migrations/202605290009_drop_company_templates_navigation_nodes.js`: patrón de `202605290007` — SELECT ids WHERE `code ILIKE '%TEMPLATES_POR_EMPRESA%'`, DELETE grants, DELETE nodes; `down` vacío

- [x] 1.3 Ejecutar `knex migrate:latest` en local y verificar ausencia de `template_company` y columna `company_template_id`



## 2. Seeds y grants históricos



- [x] 2.1 Editar `backend/seeds/002_navigation_authorization_seed.js` (leer completo): eliminar `NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA`, `NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_*`, rutas en `ROUTE_PATH_BY_NAV_ITEM_CODE`, nodos en `NAVIGATION_NODES`, grants en perfiles y referencias residuales

- [x] 2.2 Editar `backend/seeds/003_gfa_company_seed.js`: quitar limpieza/inserción de `template_company`

- [x] 2.3 Editar `backend/seeds/006_gfa_template_seed.js`: quitar bloques que insertan/eliminan `template_company`

- [x] 2.4 Editar `202604250001_company_admin_universal_read_grants.js`: quitar solo códigos `NAV_*TEMPLATES_POR_EMPRESA*` del array `CODES` (mantener grants de templates estándar)

- [x] 2.5 Editar `202604250003_accountant_universal_read_grants.js`: mismo tratamiento de templates por empresa en `CODES` (no eliminar archivo)



## 3. Backend — eliminar archivos



- [x] 3.1 Eliminar `backend/controllers/companyTemplatesController.js`

- [x] 3.2 Eliminar `backend/services/companyTemplatesService.js`

- [x] 3.3 Eliminar `backend/test/companyTemplatesApi.test.js`



## 4. Backend — modificar archivos



- [x] 4.1 `backend/app.js` (leer completo): quitar imports y bloques de rutas `/api/company-templates/*` y grants `NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_*`

- [x] 4.2 `backend/services/documentBuilderService.js`: eliminar rama `kind === 'company'` en `getTemplateRow`; quitar query `template_company` de `listEligibleTemplates`; eliminar persistencia de `company_template_id` en `generateAndPersist`; rechazar `kind !== 'standard'` con 400 en español

- [x] 4.3 Actualizar tests de document builder si referencian company templates (`documentBuilderApi.test.js`, `documentBuilderVariableContext.test.js`)



## 5. Frontend — eliminar archivos



- [x] 5.1 Páginas: `CompanyTemplatesListPage.jsx`, `CompanyTemplateViewPage.jsx`, `CompanyTemplateCreatePage.jsx`, `CompanyTemplateEditPage.jsx`

- [x] 5.2 API: `frontend/src/api/companyTemplatesApi.js`



## 6. Frontend — modificar archivos



- [x] 6.1 `AppRouter.jsx`: quitar imports y 4 rutas `gestion-contratos/templates-por-empresa/*` y grants asociados

- [x] 6.2 `platformPaths.js`: eliminar constante `COMPANY_TEMPLATES_LIST_PATH`

- [x] 6.3 `sidebarIconography.jsx`: quitar entrada `NAV_ITEM_CONTRATOS_TEMPLATES_POR_EMPRESA` y ruta `/app/gestion-contratos/templates-por-empresa`

- [x] 6.4 `StandardTemplateEditor.jsx`: eliminar prop `scope`, `companyId`, imports de `companyTemplatesApi`, rutas/labels condicionales; operar solo con `standardTemplatesApi` y rutas estándar

- [x] 6.5 `DocumentBuilderPage.jsx`: eliminar sección UI de templates por empresa y filtro `kind === 'company'`

- [x] 6.6 `DocumentBuilderPreviewPage.jsx` (+ test): quitar import/uso de `companyTemplatesApi`; cargar template solo vía estándar o document builder

- [x] 6.7 Actualizar tests de navegación (`authorizationSelectors.test.js`, `navigationConfig.test.js`, `AppSidebar.test.jsx`) que usen códigos/rutas de templates por empresa



## 7. Verificación



- [x] 7.1 Grep en `frontend/src` y `backend` (excl. `migrations/`, `node_modules/`) por `companyTemplate`, `template_company`, `TEMPLATES_POR_EMPRESA`, `templates-por-empresa`, `company-templates` — limpiar residuos

- [x] 7.2 `npm test` en backend y frontend

- [x] 7.3 `npm run build` en frontend sin errores de import

- [x] 7.4 Smoke manual: CRUD templates estándar OK; Document Builder lista y genera solo templates estándar; menú sin "Templates por empresa"


