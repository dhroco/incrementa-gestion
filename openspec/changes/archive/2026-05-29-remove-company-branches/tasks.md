## 1. Base de datos

- [x] 1.1 Crear `backend/migrations/202605290010_drop_company_branch_table.js`: `up` — verificar existencia de tabla → `DROP TABLE IF EXISTS company_branch CASCADE`; `down` — recrear estructura mínima según `202604240002_company_branch_table.js` (sin datos)

- [x] 1.2 Ejecutar `knex migrate:latest` en local y verificar ausencia de tabla `company_branch`

## 2. Seeds

- [x] 2.1 Editar `backend/seeds/003_gfa_company_seed.js` (leer completo): eliminar inserciones en `company_branch` y limpieza condicional de branches; verificar que empresas demo se crean correctamente

## 3. Backend — companyService

- [x] 3.1 Editar `backend/services/companyService.js` (leer completo): eliminar `validateBranchesPayload`, `replaceCompanyBranches`, constante `MAX_BRANCHES` si solo aplica a branches

- [x] 3.2 En `validateCompanyPayload`: quitar validación y campo `branches` del resultado

- [x] 3.3 En `getCompanyDetail`: eliminar query a `company_branch` y propiedad `branches` del retorno

- [x] 3.4 En `createCompany` y `updateCompany`: eliminar persistencia y lógica de branches; ajustar validación de payload vacío si aplica

## 4. Backend — Document Builder

- [x] 4.1 Editar `backend/services/documentBuilderService.js`: en `loadCompanyRow`, eliminar sub-query `company_branch` y construcción de `branches_text`

- [x] 4.2 Editar `backend/services/documentBuilderVariableContext.js`: eliminar mapeo `company_branches` en `buildSubstitutionMap`; actualizar JSDoc si referencia `branches_text`

- [x] 4.3 Actualizar `backend/test/documentBuilderVariableContext.test.js` si referencia `company_branches`

## 5. Backend — tests

- [x] 5.1 Editar `backend/test/companyApi.test.js`: eliminar o reescribir tests que envían/verifican `branches` en payloads; mantener cobertura de CRUD empresa

## 6. Frontend — eliminar archivos

- [x] 6.1 Eliminar `frontend/src/pages/CompanyBranchWorkPage.jsx`

- [x] 6.2 Eliminar `frontend/src/pages/CompanyBranchWorkPage.test.jsx`

## 7. Frontend — rutas y layouts

- [x] 7.1 Editar `frontend/src/routes/AppRouter.jsx`: quitar imports y sub-rutas `/sucursales/nueva` y `/sucursales/:branchKey` bajo create/edit de empresa

- [x] 7.2 Editar `frontend/src/pages/CompanyCreateLayout.jsx`: eliminar estado `branches`/`setBranches`, imports de `emptyBranchRow`, y campo `branches` del context del outlet

- [x] 7.3 Editar `frontend/src/pages/CompanyEditLayout.jsx`: eliminar `mapApiBranchToRow`, estado `branches`/`setBranches` y campo del context

## 8. Frontend — formularios y vista

- [x] 8.1 Editar `frontend/src/pages/CompaniesCreateForm.jsx`: quitar sección sucursales, imports de `BranchTableEditor`, validaciones `branchesClientValidationOk`/`validateSignificantBranchesForSubmit` y dependencias de `branches` en canSubmit

- [x] 8.2 Editar `frontend/src/pages/CompaniesEditForm.jsx`: mismo tratamiento que create form

- [x] 8.3 Editar `frontend/src/pages/CompaniesViewPage.jsx`: eliminar sección `BranchTableEditor` readOnly y `mapApiBranchToRow` en carga

## 9. Frontend — utilidades y componentes

- [x] 9.1 Editar `frontend/src/components/CompanyFormSections.jsx`: eliminar `emptyBranchRow`, `mapApiBranchToRow`, `branchesToPayload`, `BranchTableEditor`, `BranchListEditor`; conservar `FormSection`

- [x] 9.2 Editar `frontend/src/utils/companyFormPayload.js`: eliminar `branchRowHasData`, `branchesClientValidationOk`, `validateSignificantBranchesForSubmit`; quitar `branches` de `buildCompanyMutationPayload` e import de `branchesToPayload`

- [x] 9.3 Editar `frontend/src/data/variableCatalog.js`: eliminar entrada `company_branches`

- [x] 9.4 Editar `frontend/src/utils/resolveCompanyVariablePreview.js`: eliminar case `company_branches`

## 10. Frontend — tests

- [x] 10.1 Actualizar `frontend/src/utils/companyFormPayload.test.js`: quitar tests de branches

- [x] 10.2 Actualizar o eliminar `frontend/src/components/CompanyFormSections.test.js` según exports restantes

- [x] 10.3 Actualizar `frontend/src/utils/resolveCompanyVariablePreview.test.js`: quitar casos `company_branches`

## 11. Verificación

- [x] 11.1 Grep en `frontend/src` y `backend` (excl. `migrations/` históricas, `node_modules/`) por `company_branch`, `CompanyBranch`, `branches_text`, `company_branches`, `/sucursales/` — limpiar residuos

- [x] 11.2 `npm test` en backend y frontend

- [x] 11.3 `npm run build` en frontend sin errores de import

- [x] 11.4 Smoke manual: list/create/edit/view empresa OK; Document Builder genera con variables `company_*` restantes; sin rutas de sucursales
