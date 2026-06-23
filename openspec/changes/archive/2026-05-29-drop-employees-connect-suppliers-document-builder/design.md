## Context

El sistema incluye un módulo completo de Trabajadores (`employee`, `position`, `work_schedule`) con CRUD frontend/backend, grants de navegación bajo `NAV_MENU_GESTION_TRABAJADORES`, y selección multi-trabajador en el Document Builder. Paralelamente, el módulo de Proveedores (`supplier`) ya está implementado y es global (sin `company_id`).

**Dependencia crítica descubierta en análisis**: `employeeFormUtils.js` exporta utilidades de fecha usadas por `SupplierUpsertPage.jsx` y `SupplierFormSections.jsx`. Esas dos funciones deben moverse a `frontend/src/utils/dateUtils.js` **antes** de eliminar el archivo de empleados.

**Dependencia de BD adicional**: la tabla `generated_document` (migración `202604300001`) tiene FK `employee_id NOT NULL` → `employee`. Antes de `DROP TABLE employee`, la migración `202605290006` debe reemplazar esa columna por `supplier_id` referenciando `supplier`, o el drop fallará / dejará esquema inconsistente.

Restricciones del cambio:
- Leer cada archivo completo antes de editar.
- No modificar migraciones históricas existentes; solo agregar `202605290006` y `202605290007`.
- No ejecutar `migrate:latest` durante la implementación.
- Botones UI: siempre `className="btn"`.
- Orden: `dateUtils.js` + imports de Proveedores → eliminar archivos de empleados → wiring compartido.

## Goals / Non-Goals

**Goals:**
- Eliminar toda funcionalidad de trabajadores (UI, API, scope resolver, tests, seeds dedicados, tablas).
- Reconectar Document Builder: empresa + proveedor + template → PDF con variables `proveedor_*`.
- Reemplazar grupo `trabajador` / `worker_*` por `proveedor` / `proveedor_*` en catálogo y resolución.
- Dejar cero referencias huérfanas a `employee`, `trabajador`, `worker_` en código activo (salvo migraciones históricas).
- Preservar flujo de empresa y templates intacto.

**Non-Goals:**
- Migrar datos históricos de `employee` a `supplier` (no hay correspondencia 1:1).
- Migrar automáticamente placeholders `{{worker_*}}` en templates existentes.
- Cambiar CRUD de proveedores (solo consumirlo desde Document Builder).
- Eliminar tabla `generated_document` ni el flujo de descarga de PDFs.
- Modificar auth OIDC/Keycloak.

## Decisions

### 1. Orden de ejecución: utilidades compartidas primero

1. Crear `frontend/src/utils/dateUtils.js` con `normalizeIsoDateOrNull` y `formatEsDateFromIso` (copia literal desde `employeeFormUtils.js`).
2. Actualizar imports en `SupplierUpsertPage.jsx` y `SupplierFormSections.jsx` → `../utils/dateUtils`.
3. Eliminar archivos 100% dedicados a empleados.
4. Editar archivos compartidos (router, slice, document builder, backend).

**Alternativa descartada**: eliminar `employeeFormUtils.js` primero — rompe build de Proveedores.

### 2. Document Builder: proveedor único (reemplaza multi-trabajador)

El slice pasa de `workersSelected: string[]` a `selectedSupplierId: string | null` (o equivalente). La UI deja de ser checklist multi-select de empleados por empresa; pasa a selector de proveedor global (lista vía `fetchSuppliersList` de `suppliersApi`).

El API `POST` document builder cambia body de `employeeIds: string[]` a `supplierId: string` (singular). Se mantiene un PDF por solicitud (POC simplificado). Constante de batch máximo de empleados se elimina o se reemplaza por validación de un solo proveedor.

**Alternativa descartada**: mantener array `supplierIds` sin requisito explícito — añade complejidad sin caso de uso actual.

### 3. Mapeo de variables en `buildSubstitutionMap`

Reemplazar lógica `worker_*` por `proveedor_*` usando fila mapeada de `supplierService.getSupplierById`:

| Variable | Persona natural | Empresa |
|----------|-----------------|---------|
| `proveedor_nombre` | `full_name` | `razon_social` |
| `proveedor_rut` | `rut_display` | `rut_empresa_display` |
| `proveedor_direccion` | `address` | `direccion_empresa` |
| `proveedor_giro` | `''` | `giro` |
| `proveedor_rep_legal` | `''` | `nombre_rep_legal` |
| `proveedor_rep_legal_rut` | `''` | `rut_rep_legal_display` |
| `proveedor_tipo` | `'Persona Natural'` | `'Empresa'` |

Variables `company_*` y grupo `contrato` (si existe) permanecen sin cambio.

### 4. Migración `202605290006`: alterar `generated_document` antes del DROP

Secuencia `up()`:
1. Eliminar filas de `generated_document` (datos POC ligados a empleados; no migrables a proveedor) **o** truncar tabla — preferir `DELETE FROM generated_document` por claridad.
2. Drop FK/index sobre `employee_id`.
3. Drop columna `employee_id`; add `supplier_id UUID NOT NULL REFERENCES supplier(id) ON DELETE CASCADE` + index.
4. `DROP TABLE IF EXISTS employee CASCADE`.
5. `DROP TABLE IF EXISTS position CASCADE`.
6. `DROP TABLE IF EXISTS work_schedule CASCADE`.

`down()`: recrear `position`, `work_schedule`, `employee` con estructura acumulada de `202604160003` + migraciones enrich (`202604260001`, `202604270001`–`003`); revertir columna `generated_document` a `employee_id`. Documentar que `down` es estructural, sin datos.

### 5. Migración `202605290007`: nodos TRABAJADOR y JORNADA

Patrón exacto del brief: borrar grants en `profile_navigation_grant`, luego nodos en `navigation_node` donde `code ILIKE '%TRABAJADOR%'` OR `code ILIKE '%JORNADA%'`. `down()` vacío.

Complementar seed `002_navigation_authorization_seed.js` eliminando solo entradas de trabajadores listadas en el brief.

### 6. Migraciones históricas solo-trabajadores: eliminar archivos

Tras lectura completa, eliminar (solo lógica de trabajadores/jornadas):
- `202604190001_nav_jornadas_under_gestion_trabajadores.js`
- `202604221003_revoke_jornadas_laborales_platform_admin.js`
- `202604290001_trabajadores_edit_grant_when_create_exists.js`

No tocar migraciones enrich de columnas `employee` (historial); la nueva migración 006 hace el drop final.

### 7. Selector de proveedor en Document Builder

- Carga sin filtro de empresa (`fetchSuppliersList` global).
- Cada opción muestra: nombre/razón social + RUT + chip de tipo (`Persona Natural` / `Empresa`).
- Requiere grant de lectura de proveedores (`NAV_ACTION_PROVEEDORES_READ` o el código ya usado en listado).
- Document Builder deja de depender de `useEmployeeCompanyScope` para cargar terceros; puede mantener scope solo para empresa activa.

### 8. `VariableCatalog.jsx` y `VariableRenderer.jsx`

- Catálogo: quitar tab/grupo trabajador; mostrar grupo proveedor desde `variableCatalog.js`.
- Renderer: eliminar resolución `worker_*`; resolver `proveedor_*` desde contexto Redux (`documentBuilderSlice` / props) o preview estático según patrón existente.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Templates con `{{worker_*}}` dejan de sustituirse | Documentado en proposal; nuevas plantillas usan `proveedor_*` |
| `generated_document` pierde PDFs históricos al truncar | Aceptado (POC); backup BD antes de prod |
| DROP employee falla por FKs residuales | 006 altera `generated_document` primero; grep FKs antes de merge |
| Referencias huérfanas en tests/fixtures | Grep final `employee\|trabajador\|worker_` en `.js`/`.jsx` |
| `documentBuilderSlice.test.js` / `DocumentBuilderPage.test.jsx` rotos | Actualizar en misma PR |
| Eliminar `employeeFormUtils.js` antes de dateUtils | Orden estricto en tasks |

## Migration Plan

1. Implementar en branch; `npm test` backend + frontend.
2. Revisar archivos de migración creados (no ejecutar en implementación).
3. Manual post-review: `knex migrate:latest` en local.
4. Verificar tablas `employee`, `position`, `work_schedule` ausentes; `generated_document.supplier_id` presente.
5. `knex seed:run` → menú sin trabajadores; proveedores operativos.
6. Smoke: login → Document Builder → seleccionar empresa + proveedor + template → generar PDF → descargar.
7. Desplegar dev → migrate → smoke → prod con backup.

**Rollback**: `migrate:down` recrea tablas vacías; código requiere revert de deploy. PDFs generados post-cambio usan `supplier_id`.

## Open Questions

- ¿Truncar `generated_document` en 006 es aceptable para todos los entornos? (Asumido sí — POC sin migración employee→supplier.)
- ¿El Document Builder debe seguir permitiendo generación en lote (varios proveedores)? (Asumido no — un proveedor por generación, alineado al brief.)
