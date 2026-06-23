## 1. Base de datos

- [x] 1.1 Crear `backend/migrations/202606010004_add_short_name_to_company.js`: agregar `short_name` nullable, backfill desde `business_name`, SET NOT NULL; `down` elimina columna
- [x] 1.2 Ejecutar `npm run migrate:latest` en backend y verificar columna `company.short_name`

## 2. Backend — companyService

- [x] 2.1 Editar `backend/services/companyService.js` — `validateCompanyPayload`: leer `short_name`/`shortName`, validar obligatorio con `requireAll`, retornar `short_name` en data (undefined si ausente)
- [x] 2.2 Editar `listCompanies`: incluir `c.short_name` en el select
- [x] 2.3 Actualizar `backend/test/companyApi.test.js`: create sin short_name rechazado, create/update con short_name, list incluye campo

## 3. Backend — variables de plantilla

- [x] 3.1 Editar `backend/services/documentBuilderVariableContext.js`: agregar `company_nombre_comercial` en bloque empresa de `buildSubstitutionMap`
- [x] 3.2 Editar `backend/services/documentBuilderService.js`: agregar entrada `company_nombre_comercial` en `VARIABLE_META`
- [x] 3.3 Actualizar `backend/test/documentBuilderVariableContext.test.js` con escenario de sustitución de nombre comercial

## 4. MCP

- [x] 4.1 Editar `backend/mcpTools.mjs` — `listar_empresas`: agregar `short_name` al select y al objeto mapeado
- [x] 4.2 Actualizar `backend/test/mcpServer.test.js` para assert de `short_name` en respuesta

## 5. Frontend — helpers y layouts

- [x] 5.1 Editar `frontend/src/utils/companyFormPayload.js`: parámetro `shortName` en `buildCompanyMutationPayload` y validación en `validateHeadquartersForCompanySubmit` (antes de RUT)
- [x] 5.2 Editar `frontend/src/pages/companies/CompanyCreateLayout.jsx`: estado `shortName`/`setShortName` en outlet context
- [x] 5.3 Editar `frontend/src/pages/companies/CompanyEditLayout.jsx`: estado e inicialización desde `data.short_name` en outlet context

## 6. Frontend — formularios y vista

- [x] 6.1 Editar `frontend/src/pages/companies/CompaniesCreateForm.jsx`: campo Nombre comercial entre Razón Social y RUT, `canSubmit`, payload y validación
- [x] 6.2 Editar `frontend/src/pages/companies/CompaniesEditForm.jsx`: mismos cambios que create
- [x] 6.3 Editar `frontend/src/pages/companies/CompaniesViewPage.jsx`: mostrar "Nombre comercial" junto a "Razón Social"
- [x] 6.4 Editar `frontend/src/data/variableCatalog.js`: agregar `company_nombre_comercial` después de `company_legal_name` en grupo empresa

## 7. Verificación

- [x] 7.1 Smoke manual: crear/editar empresa con nombre comercial distinto de razón social; ver detalle
- [x] 7.2 Generar documento con `{{company_nombre_comercial}}` y confirmar valor en PDF
- [x] 7.3 `npm test` en backend; `npm run build` en frontend sin errores
- [x] 7.4 MCP: `listar_empresas` retorna `short_name`; reiniciar cliente MCP tras despliegue
