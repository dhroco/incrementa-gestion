## Why

El producto evolucionó: el sistema ya no administrará cláusulas (universales ni por empresa), solo templates estándar y por empresa. Mantener API, UI, editor Tiptap embebido, tablas, seeds y grants de navegación de cláusulas aumenta superficie de mantenimiento, confunde al usuario y deja rutas/permisos obsoletos. Este cambio alinea código, BD y menú con el alcance real del producto.

## What Changes

- **BREAKING**: Eliminación completa de la API `/api/clauses/*` (crear, listar, obtener, editar, `resolve-read`).
- **BREAKING**: Eliminación de rutas frontend `/gestion-contratos/clausulas-universales/*` y `/gestion-contratos/clausulas-por-empresa/*`.
- **BREAKING**: Nueva migración `202605280001_drop_clause_tables.js` que elimina tablas `clause_company`, `clause_universal` y `clause` (CASCADE). `template_clause` ya fue eliminada en `202604230001`.
- **Frontend**: Borrado de 11 páginas, APIs, utilidades, constantes, componentes RichText de catálogo/embebido y `ClauseTemplateMetadataPanel`; limpieza quirúrgica de `AppRouter`, `RichTextEditor`, `ReadOnlyDocPreview`, páginas de vista de templates y archivos colaterales con referencias residuales (`StandardTemplateEditor`, `templateContentJson`, `materializeTemplateDocClient`, `documentBuilder*`, iconografía de sidebar).
- **Backend**: Borrado de controller, services, middleware, utils/lib y tests dedicados; limpieza de `app.js`, `standardTemplatesService`, `companyTemplatesService`, `tipTapMaterialize`, `documentBuilderService`, `templateContentJson`, `tipTapPlainText` y tests asociados.
- **Seeds**: Eliminar `007_gfa_clause_seed.js`, `008_gfa_template_clause_seed.js`, `011_enriched_clause_seed.js`; quitar ítems/acciones/grants de cláusulas en `002_navigation_authorization_seed.js`.
- **Migraciones de grants** (`202604250001`, `202604250003`): **no eliminar archivos** — otorgan también grants de templates estándar; eliminar solo las entradas `NAV_*CLAUSULAS*` del array `CODES`.
- **Documentación**: Eliminar `docs/clause-model-enrichment.md` y `docs/clause-validation-guide.md`.
- **Editor Tiptap**: Se mantiene para templates; se quita extensión `embeddedUniversalClause` y catálogo de inserción.
- **Templates**: Visualización, edición y generación de templates (estándar y por empresa) permanecen; documentos con nodos históricos `embeddedUniversalClause` en `content_json` se muestran sin resolución (nodo ignorado o texto vacío, sin error).

**No se modifica**: migraciones históricas existentes (solo se agrega la de drop); flujos de auth OIDC/Keycloak; empresas, empleados, usuarios plataforma; document builder salvo lógica de materialización de cláusulas.

## Capabilities

### New Capabilities

- `remove-clauses-functionality`: El sistema no expone CRUD ni resolución de cláusulas; no hay entradas de menú ni grants de navegación de cláusulas; tablas `clause*` eliminadas; templates y document builder operan sin insertar ni materializar cláusulas embebidas.

### Modified Capabilities

_(ninguna — no existen specs previas de cláusulas en `openspec/specs/`)_

## Impact

- **Base de datos**: datos de cláusulas eliminados irreversiblemente en `up` de la nueva migración.
- **API**: endpoints `/api/clauses/*` dejan de existir (404 en clientes antiguos).
- **Frontend**: menú de contratos sin submódulos de cláusulas; RichTextEditor sin catálogo de cláusulas.
- **Templates existentes**: `content_json` puede contener nodos `embeddedUniversalClause` legados; no se migran automáticamente — el editor ya no permite insertarlos; preview/PDF omiten resolución.
- **Tests**: eliminar o actualizar tests de cláusulas y de materialización embebida; ejecutar suite backend/frontend.

## Consideraciones de seguridad

- Migración destructiva: ejecutar primero en `local`/`dev`; respaldar BD antes de `migrate:latest` en GCP.
- Eliminar grants y rutas de cláusulas evita acceso a funcionalidad retirada vía navegación o API directa.
- Endpoints de templates deben seguir validando JWT y grants de navegación existentes (sin depender de middleware de cláusulas eliminado).
- Mensajes de error al usuario permanecen en español (es-CL).
