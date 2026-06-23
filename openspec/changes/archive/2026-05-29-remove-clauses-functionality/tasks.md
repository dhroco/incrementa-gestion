## 1. Base de datos

- [x] 1.1 Crear `backend/migrations/202605280001_drop_clause_tables.js`: `up` — `DROP TABLE IF EXISTS clause_company, clause_universal, clause CASCADE`; `down` — recrear tablas con estructura de `202604160003` + enriquecimiento `202604160005` y constraints de fases B/C (sin datos)
- [x] 1.2 Ejecutar `knex migrate:latest` en local y verificar ausencia de tablas `clause*`

## 2. Seeds y grants históricos

- [x] 2.1 Editar `backend/seeds/002_navigation_authorization_seed.js` (leer completo): eliminar `NAV_ITEM_CONTRATOS_CLAUSULAS_*`, `NAV_ACTION_CONTRATOS_CLAUSULAS_*`, rutas en `ROUTE_PATH_BY_NAV_ITEM_CODE`, nodos en `NAVIGATION_NODES`, grants en perfiles y cualquier referencia residual
- [x] 2.2 Eliminar seeds: `007_gfa_clause_seed.js`, `008_gfa_template_clause_seed.js`, `011_enriched_clause_seed.js`
- [x] 2.3 Editar `202604250001_company_admin_universal_read_grants.js`: quitar solo `NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES` y `NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ` del array `CODES` (mantener grants de plantillas)
- [x] 2.4 Editar `202604250003_accountant_universal_read_grants.js`: mismo tratamiento de cláusulas en `CODES` (no eliminar archivo)

## 3. Backend — eliminar archivos

- [x] 3.1 Controller: `clauseController.js`
- [x] 3.2 Services: `clauseService.js`, `clauseStatusService.js`
- [x] 3.3 Middleware: `requireClauseUniversalGrant.js`, `requireClauseByIdGrant.js`, `requireCompanyClauseScope.js`
- [x] 3.4 Lib/utils: `clauseContentJson.js`, `resolveCompanyClauseContext.js`
- [x] 3.5 Tests: `clauseApi.test.js`, `clauseContentJson.test.js`, `clauseStatusService.test.js`
- [x] 3.6 Script: `check_clause_company_code_duplicates.js`

## 4. Backend — modificar archivos

- [x] 4.1 `app.js` (leer completo): quitar imports y bloque completo `/api/clauses/*`
- [x] 4.2 `standardTemplatesService.js`: eliminar resolución/materialización de cláusulas embebidas; mantener CRUD/generación de templates
- [x] 4.3 `companyTemplatesService.js`: mismo tratamiento
- [x] 4.4 `tipTapMaterialize.js`: quitar lógica `embeddedUniversalClause`; si queda vacío, eliminar archivo y actualizar importadores
- [x] 4.5 `templateContentJson.js`, `tipTapPlainText.js`, `documentBuilderService.js`, `documentBuilderTipTapPdf.js`: limpiar referencias a cláusulas
- [x] 4.6 Tests: `tipTapMaterialize.test.js`, `standardTemplatesService.embeddedRefs.test.js`, `standardTemplatesApi.test.js`, `templateContentJson.test.js` — eliminar o actualizar
- [x] 4.7 `delete-app-user.js`: quitar limpieza de datos de cláusulas si existe

## 5. Frontend — eliminar archivos

- [x] 5.1 Páginas: `ClauseUniversalListPage.jsx`, `ClauseUniversalCreatePage.jsx`, `ClauseUniversalViewPage.jsx`, `ClauseCompanyListPage.jsx`, `ClauseCompanyCreatePage.jsx`, `ClauseCompanyViewPage.jsx`, `ClauseEditPage.jsx`, `ClauseEditorTest.jsx`, `ClauseForm.css`, `ClauseCompanyListPage.test.jsx`, `ClauseCompanyCreatePage.test.jsx`
- [x] 5.2 API: `clausesApi.js`, `clauseResolveReadBatcher.js`, `clauseResolveReadBatcher.test.js`
- [x] 5.3 Utils/constants: `clauseStatus.js`, `clauseStatus.test.js`, `clauseContentJson.js`, `clauseContentJson.test.js`, `clauseMessages.js`, `clauseMessages.test.js`
- [x] 5.4 RichText cláusulas: `EmbeddedUniversalClauseRenderer.jsx`, `EmbeddedUniversalClauseNode.js`, `EmbeddedClauseCatalog.jsx`, `EmbeddedClauseCatalogTabbed.jsx`
- [x] 5.5 Componentes: `ClauseTemplateMetadataPanel.jsx`, `ClauseTemplateMetadataPanel.test.jsx`

## 6. Frontend — modificar archivos

- [x] 6.1 `AppRouter.jsx`: quitar imports y rutas `/gestion-contratos/clausulas-universales/*` y `/gestion-contratos/clausulas-por-empresa/*`
- [x] 6.2 `RichTextEditor/index.jsx`: quitar extensión, catálogo y toolbar de cláusulas
- [x] 6.3 `ReadOnlyDocPreview.jsx`: quitar resolución/render de `embeddedUniversalClause`
- [x] 6.4 `StandardTemplateViewPage.jsx`, `CompanyTemplateViewPage.jsx`: quitar `clauseResolveReadBatcher` / `clausesApi`
- [x] 6.5 `StandardTemplateEditor.jsx`, `templateContentJson.js`, `materializeTemplateDocClient.js`: quitar lógica de cláusulas
- [x] 6.6 `DocumentBuilderPage.jsx`, `DocumentBuilderPreviewPage.jsx` (+ tests): quitar materialización de cláusulas
- [x] 6.7 `sidebarIconography.jsx`: quitar rutas de cláusulas
- [x] 6.8 `RichTextEditor/styles.module.css` (+ test): eliminar estilos solo de cláusulas
- [x] 6.9 Actualizar tests de navegación (`authorizationSelectors.test.js`, `navigationConfig.test.js`, `profileNavGuardDecision.test.js`) que usen rutas/códigos de cláusulas como fixtures

## 7. Documentación

- [x] 7.1 Eliminar `docs/clause-model-enrichment.md`, `docs/clause-validation-guide.md`

## 8. Verificación

- [x] 8.1 Grep en `frontend/src` y `backend` (excl. `migrations/`, `node_modules/`) por `clause`, `clausula`, `embeddedUniversalClause`, `clausesApi` — limpiar residuos
- [x] 8.2 `npm test` en backend y frontend
- [x] 8.3 `npm run build` en frontend sin errores de import
- [x] 8.4 Smoke manual: menú contratos → templates estándar y por empresa (listar, ver, editar); document builder preview/PDF
