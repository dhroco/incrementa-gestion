## Context

El sistema mantiene dos variantes de templates sobre la tabla base `template`:
- **Estándar** (`template_standard`): plantillas globales reutilizables.
- **Por empresa** (`template_company`): plantillas scoped a una empresa con código único por company.

Ambas variantes tienen API REST dedicada, páginas CRUD, grants de navegación (`NAV_*TEMPLATES_POR_EMPRESA*`) y soporte en Document Builder (`kind: 'standard' | 'company'`). La tabla `generated_document` referencia exactamente uno de `standard_template_id` o `company_template_id` vía constraint `generated_document_one_template_ck`.

Tras cambios previos (eliminación de cláusulas, empleados), el producto opera con templates estándar + proveedores en Document Builder. El módulo por empresa queda obsoleto.

Restricciones del cambio:
- Leer cada archivo a modificar completo antes de editar.
- No modificar migraciones históricas; solo agregar `202605290008` y `202605290009`.
- No comentar código — eliminar limpiamente.
- No tocar `template`, `template_standard`, ni archivos del módulo estándar.

## Goals / Non-Goals

**Goals:**
- Eliminar toda funcionalidad de templates por empresa (UI, API, servicios, tests, seeds, tablas, grants).
- Mantener CRUD, vista y edición de templates estándar sin cambios funcionales.
- Simplificar Document Builder para listar y generar solo con templates estándar.
- Simplificar `StandardTemplateEditor` a modo estándar único.
- Dejar cero imports huérfanos y cero referencias `template_company` / `company-templates` en código vivo (salvo migraciones históricas).

**Non-Goals:**
- Migrar contenido de templates por empresa a templates estándar (datos se descartan).
- Eliminar tabla base `template` ni `template_standard`.
- Cambiar modelo de empresas, proveedores, auth o templates estándar.
- Modificar `backend/utils/templateContentJson.js` (compartido con estándar).

## Decisions

### 1. Dos migraciones separadas (schema + navegación)

**Migración 1** (`202605290008_drop_template_company_table.js`):
1. Verificar existencia de `generated_document_one_template_ck` → `ALTER TABLE ... DROP CONSTRAINT IF EXISTS generated_document_one_template_ck`.
2. Verificar columna `company_template_id` → dropear FK implícita vía `alterTable` dropColumn (Knex maneja FK de `.references()`).
3. `DROP TABLE IF EXISTS template_company CASCADE` (elimina filas hijas en `template` vía FK si existe).

**Migración 2** (`202605290009_drop_company_templates_navigation_nodes.js`):
- Patrón idéntico a `202605290007_drop_trabajadores_navigation_nodes.js`:
  - SELECT ids de `navigation_node` WHERE `code ILIKE '%TEMPLATES_POR_EMPRESA%'`.
  - DELETE de `profile_navigation_grant` WHERE `navigation_node_id IN (...)`.
  - DELETE de `navigation_node` WHERE id IN (...).

**Alternativa descartada**: una sola migración — separar schema de nav grants facilita rollback parcial y sigue convención del repo.

### 2. Constraint post-drop en `generated_document`

Tras eliminar `company_template_id`, el constraint XOR ya no aplica. No agregar constraint nuevo que fuerce `standard_template_id IS NOT NULL` — la columna permanece nullable por diseño histórico; generaciones nuevas seguirán persistiendo `standard_template_id`.

### 3. Orden de eliminación: hojas primero, luego wiring

1. Eliminar archivos 100% dedicados (controller, service, páginas, API, tests).
2. Editar archivos compartidos (`app.js`, `documentBuilderService.js`, `StandardTemplateEditor.jsx`, `DocumentBuilderPage.jsx`, seeds).

**Alternativa descartada**: editar `app.js` primero — deja imports rotos hasta el final.

### 4. Document Builder: eliminar `kind` de company en API y UI

- `listEligibleTemplates`: retornar solo items con `kind: 'standard'` (o eliminar campo `kind` si todos son standard — mantener `kind: 'standard'` por compatibilidad con frontend existente).
- `getTemplateRow`: eliminar rama `kind === 'company'`.
- `getTemplateDetail` / `generateAndPersist`: rechazar `kind !== 'standard'` con 400 en español.
- Frontend `DocumentBuilderPage.jsx`: eliminar sección "Templates por empresa" y filtro `kind === 'company'`.
- `DocumentBuilderPreviewPage.jsx`: eliminar import de `companyTemplatesApi`; cargar solo vía API estándar o document builder detail.

### 5. `StandardTemplateEditor`: simplificar a modo estándar

Eliminar props `scope`, `companyId`; usar siempre `standardTemplatesApi`; rutas y labels fijos a templates estándar. Las páginas `CompanyTemplateCreatePage` / `EditPage` se eliminan — no queda caller con `scope="company"`.

### 6. Seeds y migraciones de grants históricos

- `002_navigation_authorization_seed.js`: quitar nodos, acciones, rutas y grants `NAV_*TEMPLATES_POR_EMPRESA*`.
- `003_gfa_company_seed.js`, `006_gfa_template_seed.js`: quitar bloques que insertan/limpian `template_company`.
- `202604250001`, `202604250003`: quitar solo códigos `NAV_*TEMPLATES_POR_EMPRESA*` del array `CODES` (mantener templates estándar).

### 7. Archivos colaterales detectados (grep)

Incluir en limpieza:
- `frontend/src/navigation/__testonly__/navigationConfig.js` y tests de navegación si referencian códigos NAV de templates por empresa.
- `backend/test/documentBuilderApi.test.js`, `documentBuilderVariableContext.test.js` si asumen company templates.
- `frontend/src/pages/DocumentBuilderPreviewPage.test.jsx` (mock de `companyTemplatesApi`).
- `frontend/src/navigation/authorizationSelectors.test.js`, `navigationConfig.test.js`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Pérdida irreversible de templates por empresa en BD | Backup antes de migrate en dev/prod; alcance explícito de descarte |
| `generated_document` histórico pierde referencia a company template | Columna nullable; no bloquea operación; solo afecta trazabilidad histórica |
| Imports rotos en archivos no listados | Grep post-cambio por `companyTemplate`, `template_company`, `TEMPLATES_POR_EMPRESA`, `templates-por-empresa` |
| Document Builder roto si `listEligibleTemplates` queda vacío | Verificar join `template` + `template_standard`; tests backend |
| Grants residuales en BD prod | Migración 009 + limpieza seed para re-seeds locales |

## Migration Plan

1. Desplegar backend + frontend con código limpio (sin rutas company-templates).
2. Ejecutar `knex migrate:latest` (008 luego 009).
3. Verificar: menú sin "Templates por empresa", Document Builder lista solo estándar, CRUD estándar OK.
4. Rollback: `down` de migraciones recrea estructura mínima sin datos (documentar como estructural, no restauración).

## Open Questions

_(ninguna — alcance definido por el usuario)_
