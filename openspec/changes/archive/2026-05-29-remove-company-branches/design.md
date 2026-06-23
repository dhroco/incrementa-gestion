## Context

Las empresas (`company`) tienen datos propios (razón social, RUT, representantes legales, etc.) y, adicionalmente, sucursales en la tabla `company_branch` (FK `company_id` ON DELETE CASCADE). El backend expone `branches` en create/update/detail; el frontend usa un patrón React Context en `CompanyCreateLayout` / `CompanyEditLayout` con rutas hijas para alta/edición de sucursales (`CompanyBranchWorkPage`). Document Builder agrega `branches_text` al cargar la empresa y mapea `company_branches` en `buildSubstitutionMap`.

No existen nodos de navegación separados para sucursales — el acceso queda bajo grants de empresas. Por tanto no se requiere migración de navegación.

Restricciones del cambio:
- No modificar migraciones históricas; solo agregar `202605290010`.
- No comentar código — eliminar limpiamente.
- Mantener CRUD completo de empresas con todos los demás campos intactos.
- No migrar templates que usen `{{company_branches}}`.

## Goals / Non-Goals

**Goals:**
- Eliminar tabla `company_branch` y toda lógica asociada en backend, frontend, seeds y tests.
- Dejar Gestión de Empresas 100% funcional (list, create, edit, view) sin sección de sucursales.
- Document Builder operativo con variables `company_*` restantes y `proveedor_*`.
- Cero referencias vivas a `company_branch`, `branches`, `CompanyBranchWorkPage`, `company_branches` (salvo migraciones históricas).

**Non-Goals:**
- Cambiar el esquema de `company` ni otros campos del formulario.
- Migrar o reescribir contenido de templates con `{{company_branches}}`.
- Eliminar estilos CSS huérfanos de sucursales (opcional en limpieza posterior; no bloqueante).
- Modificar auth, proveedores, templates estándar o navegación.

## Decisions

### 1. Una sola migración de schema (sin nav)

**Migración** `202605290010_drop_company_branch_table.js`:
- `up`: verificar existencia de tabla → `DROP TABLE IF EXISTS company_branch CASCADE`.
- `down`: recrear estructura mínima según `202604240002_company_branch_table.js` (sin datos).

**Alternativa descartada**: migración de datos a columnas en `company` — el producto descarta el concepto por completo.

### 2. Contrato API: eliminar `branches` del payload y respuesta

- `validateCompanyPayload` / `createCompany` / `updateCompany` / `getCompanyDetail`: quitar validación, persistencia y campo `branches`.
- Eliminar funciones `validateBranchesPayload` y `replaceCompanyBranches`.
- Clientes que envíen `branches` dejarán de tener efecto; no es necesario error 400 explícito si el campo ya no se lee.

**Alternativa descartada**: mantener lectura pasiva de `branches` ignorándolo — genera deuda; mejor eliminar del contrato y tests.

### 3. Document Builder: quitar `branches_text` y variable

- `loadCompanyRow` en `documentBuilderService.js`: eliminar sub-query a `company_branch` y propiedad `branches_text`.
- `buildSubstitutionMap`: eliminar clave `company_branches`.
- `variableCatalog.js` y `resolveCompanyVariablePreview.js`: quitar entrada/case.

Templates históricos con `{{company_branches}}` quedan sin sustituir (vacío/`—`); alcance aceptado.

### 4. Frontend: eliminar hojas primero, luego wiring

Orden sugerido:
1. Eliminar `CompanyBranchWorkPage.jsx` (+ test).
2. Quitar rutas e imports en `AppRouter.jsx`.
3. Limpiar layouts (`CompanyCreateLayout`, `CompanyEditLayout`), formularios (`CompaniesCreateForm`, `CompaniesEditForm`, `CompaniesViewPage`), `companyFormPayload.js`.
4. Reducir `CompanyFormSections.jsx` a solo `FormSection` (eliminar helpers y `BranchTableEditor`).
5. Eliminar o actualizar tests colaterales.

**Alternativa descartada**: ocultar UI pero mantener estado en context — deja código muerto.

### 5. Seeds: solo `003_gfa_company_seed.js`

Quitar inserciones y limpieza condicional de `company_branch`. Las empresas demo deben crearse igual sin sucursales.

### 6. Archivos colaterales (grep)

Incluir en limpieza si hay referencias:
- `frontend/src/components/CompanyFormSections.test.js`
- `frontend/src/utils/companyFormPayload.test.js`
- `frontend/src/utils/resolveCompanyVariablePreview.test.js`
- `backend/test/documentBuilderVariableContext.test.js` si menciona `company_branches`
- `frontend/src/styles/shared-form.css` — clases `.company-branch-*` pueden quedar huérfanas (no bloqueante)

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Pérdida irreversible de sucursales en BD | Backup antes de migrate; alcance explícito de descarte |
| Templates con `{{company_branches}}` sin resolver | Aceptado; no migrar datos |
| Context consumers rotos tras quitar `branches` | Grep por `branches`, `setBranches`, `CompanyBranch` en frontend |
| Tests de empresa fallan por payloads con `branches` | Actualizar `companyApi.test.js` y tests de formulario |
| `CompanyFormSections` import roto si se elimina `FormSection` | Conservar `FormSection`; solo eliminar exports de sucursales |

## Migration Plan

1. Desplegar backend + frontend con código sin referencias a sucursales.
2. Ejecutar `knex migrate:latest` (010).
3. Verificar: CRUD empresas OK; Document Builder genera con variables `company_name`, etc.; sin rutas `/sucursales/*`.
4. Rollback: `down` de migración recrea tabla vacía (estructural, sin restauración de datos).

## Open Questions

_(ninguna — alcance definido por el usuario)_
