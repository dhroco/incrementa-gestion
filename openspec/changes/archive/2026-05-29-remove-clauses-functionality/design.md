## Context

El sistema nació con un modelo de cláusulas reutilizables (universales y por empresa) insertables en templates vía nodo Tiptap `embeddedUniversalClause`, con API REST dedicada, middleware de grants y tablas `clause` / `clause_universal` / `clause_company`. La tabla puente `template_clause` ya se eliminó (`202604230001`). El producto consolidó el alcance en **solo templates** (estándar y por empresa) y document builder.

Restricciones del cambio:
- Leer cada archivo a modificar completo antes de editar.
- No modificar migraciones históricas; solo agregar `202605280001_drop_clause_tables.js`.
- No comentar código — eliminar limpiamente.
- Grants en `202604250001` y `202604250003` mezclan cláusulas y templates → editar arrays `CODES`, no borrar archivos.

## Goals / Non-Goals

**Goals:**
- Eliminar toda funcionalidad de cláusulas (UI, API, servicios, tests, seeds, docs, tablas).
- Mantener RichTextEditor operativo para edición de templates.
- Mantener listado, vista, edición y generación de templates estándar y por empresa.
- Mantener document builder y PDF sin paso de materialización de cláusulas.
- Dejar cero imports huérfanos y cero referencias `clause` en código vivo (salvo migraciones históricas y comentarios de historial).

**Non-Goals:**
- Migrar o limpiar `content_json` existente que contenga nodos `embeddedUniversalClause` (se toleran como legado inerte).
- Eliminar fuente Lora / variable `--font-family-clause-editor` del CSS global (puede reutilizarse el editor de templates; limpieza cosmética opcional fuera de alcance).
- Cambiar modelo de templates, empresas, empleados o auth.

## Decisions

### 1. Orden de eliminación: hojas primero, luego wiring

Eliminar archivos 100% dedicados a cláusulas antes de editar archivos compartidos (`app.js`, servicios de templates, RichTextEditor). Así los errores de import guían qué referencias faltan limpiar.

**Alternativa descartada**: editar `app.js` primero — deja imports rotos en frontend hasta el final.

### 2. Migración additive con DROP CASCADE

`up`: `DROP TABLE IF EXISTS clause_company CASCADE; clause_universal CASCADE; clause CASCADE`.

`down`: recrear estructura mínima desde `202604160003` + columnas de `202604160005` y restricciones de fases B/C (sin re-poblar datos). Documentar que `down` es estructural, no restauración de datos.

**Alternativa descartada**: modificar `202604160003` — rompe historial de migraciones en prod.

### 3. Migraciones de grants: editar in-place, no borrar

`202604250001_company_admin_universal_read_grants.js` y `202604250003_accountant_universal_read_grants.js` incluyen también:
- `NAV_ITEM_CONTRATOS_PLANTILLAS`
- `NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ`

Solo remover del array `CODES`:
- `NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES`
- `NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ`

**Nota**: El perfil `CONTADOR` fue eliminado en cambio previo; `202604250003` puede quedar como archivo histórico — si el perfil ya no existe, la migración es no-op en re-seed; no eliminar el archivo por mezcla de grants.

### 4. Nodos legados `embeddedUniversalClause` en content_json

En preview/materialización: recorrer el árbol Tiptap y **omitir** nodos `embeddedUniversalClause` (no llamar API, no fallar). El editor no registra la extensión; documentos viejos no muestran contenido resuelto de cláusula.

**Alternativa descartada**: script de migración de contenido — fuera de alcance; riesgo alto para poco beneficio si el producto ya no usa cláusulas.

### 5. `tipTapMaterialize.js`

Tras quitar resolución de cláusulas, evaluar si quedan funciones útiles (variables, campos). Si el archivo queda vacío o solo con código de cláusulas, eliminarlo y actualizar importadores (`documentBuilderService`, tests).

### 6. Archivos colaterales detectados (no listados explícitamente en el brief, pero con referencias)

Incluir en limpieza quirúrgica tras grep:
- `frontend/src/components/StandardTemplateEditor.jsx`
- `frontend/src/utils/templateContentJson.js` (+ test)
- `frontend/src/utils/materializeTemplateDocClient.js`
- `frontend/src/navigation/sidebarIconography.jsx` (rutas cláusulas)
- `frontend/src/navigation/__testonly__/navigationConfig.js` y tests si referencian códigos NAV de cláusulas
- `backend/utils/templateContentJson.js` (+ test)
- `backend/utils/tipTapPlainText.js`
- `backend/services/documentBuilderService.js`, `documentBuilderTipTapPdf.js`
- `backend/test/standardTemplatesService.embeddedRefs.test.js`, `tipTapMaterialize.test.js`, `standardTemplatesApi.test.js`
- `backend/scripts/delete-app-user.js` si borra datos de cláusulas
- `frontend/src/components/RichTextEditor/styles.module.css` (+ test) — estilos solo de cláusulas

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Templates con nodos embebidos muestran huecos en preview/PDF | Aceptado; comunicar que contenido legado no se resuelve |
| `DROP CASCADE` elimina datos irreversiblemente | Backup BD antes de prod; probar en dev |
| Referencias `clause` residuales en archivos no listados | Grep final en `frontend/src` y `backend` (excl. `migrations/`, `node_modules/`) |
| Tests de navegación usan rutas de cláusulas como ejemplo | Actualizar fixtures a rutas de templates |
| Eliminar `tipTapMaterialize` rompe document builder | Verificar imports; mantener funciones no-cláusula o inline mínimo |

## Migration Plan

1. Implementar cambios en branch; `npm test` backend + frontend.
2. `knex migrate:latest` en local → verificar tablas `clause*` ausentes.
3. `knex seed:run` (o seeds relevantes) → menú sin cláusulas.
4. Smoke: login → menú contratos → templates estándar/empresa (listar, ver, editar) → document builder preview/PDF.
5. Desplegar a dev → repetir migrate + smoke.
6. Prod: backup → migrate → deploy frontend/backend.

**Rollback**: `knex migrate:down` recrea tablas vacías; no restaura datos ni código — rollback de código requiere revert de deploy.

## Open Questions

- Ninguna crítica; el brief del usuario es exhaustivo. Opcional post-merge: renombrar `--font-family-clause-editor` a `--font-family-template-editor` en CSS global.
