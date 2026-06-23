## Why

El módulo de Trabajadores/Employees quedó fuera del alcance del producto tras la introducción del módulo de Proveedores. Mantener CRUD de empleados, tablas relacionadas (`employee`, `position`, `work_schedule`), rutas, grants de navegación y selección de empleado en el Document Builder genera código huérfano, confunde al usuario y bloquea el flujo natural empresa → proveedor → template → documento. Este cambio elimina el módulo de trabajadores de forma quirúrgica y reconecta el Document Builder al catálogo de proveedores ya existente.

## What Changes

- **BREAKING**: Eliminación completa de la API `/api/employees/*` y del scope `resolveEmployeeCompanyScope`.
- **BREAKING**: Eliminación de rutas frontend `/trabajadores/*` y de todos los grants/nodos de navegación relacionados con trabajadores y jornadas laborales.
- **BREAKING**: El Document Builder deja de aceptar `employee_id` y pasa a requerir `supplier_id` para sustitución de variables.
- **BREAKING**: Variables de plantilla `worker_*` / grupo `trabajador` eliminadas; reemplazadas por variables `proveedor_*` y grupo `proveedor` en catálogo y renderizado.
- **Frontend**: Extracción de `normalizeIsoDateOrNull` y `formatEsDateFromIso` a `frontend/src/utils/dateUtils.js` antes de eliminar `employeeFormUtils.js` (Proveedores ya depende de esas funciones).
- **Frontend**: Borrado de 9 archivos de empleados (páginas, API, auth, utils); limpieza quirúrgica de `AppRouter`, `sidebarIconography`, `variableCatalog`, `VariableCatalog`, `VariableRenderer`, `DocumentBuilderPage`, `documentBuilderSlice`.
- **Backend**: Borrado de controller, service, scope resolver, seeds de position/employee y tests de employees; limpieza de `app.js`, `documentBuilderVariableContext`, `documentBuilderService` y tests asociados.
- **Seeds**: Eliminar nodos/grants de trabajadores en `002_navigation_authorization_seed.js`; eliminar seeds `004_gfa_position_and_schedule_seed.js` y `005_gfa_employee_seed.js`.
- **Migraciones históricas**: Revisar y eliminar solo archivos que contengan exclusivamente lógica de trabajadores (`202604190001`, `202604221003`, `202604290001`); no modificar migraciones ya aplicadas en otros entornos salvo eliminar archivos huérfanos.
- **Nuevas migraciones** (solo crear archivos, no ejecutar):
  - `202605290006_drop_employee_tables.js` — DROP `employee`, `position`, `work_schedule` (CASCADE).
  - `202605290007_drop_trabajadores_navigation_nodes.js` — eliminar nodos/grants con código `%TRABAJADOR%` o `%JORNADA%`.

**No se modifica**: módulo de Proveedores (CRUD existente); flujos de auth OIDC/Keycloak; templates estándar y por empresa; variables de empresa (`company_*`).

## Capabilities

### New Capabilities

- `remove-employees-functionality`: El sistema no expone CRUD ni navegación de trabajadores; tablas `employee`, `position` y `work_schedule` eliminadas; seeds y migraciones residuales de trabajadores retirados; sin referencias huérfanas a `employee`, `trabajador` o `worker_*` en código activo.
- `document-builder-supplier-context`: El Document Builder permite seleccionar empresa + proveedor (global, sin filtro por empresa), sustituye variables `proveedor_*` en preview/PDF usando datos de `supplierService`, y rechaza o deja de usar `employee_id`.

### Modified Capabilities

- `suppliers-admin`: Los proveedores pasan a ser la entidad de terceros usada por el Document Builder para generación de documentos (reutilización de `GET /api/suppliers` en el selector).

## Impact

- **Base de datos**: datos de empleados, cargos y jornadas eliminados irreversiblemente en `up` de `202605290006`.
- **API**: endpoints `/api/employees/*` dejan de existir; document builder API cambia parámetro de contexto de `employee_id` a `supplier_id`.
- **Frontend**: menú sin Gestión de Trabajadores; Document Builder con selector de proveedor (nombre/razón social + RUT + tipo).
- **Templates existentes**: plantillas que usen `{{worker_*}}` dejarán de resolverse (placeholder sin sustituir o vacío según lógica actual); nuevas plantillas deben usar `{{proveedor_*}}`.
- **Tests**: actualizar o eliminar tests de employees y document builder; verificar suite backend/frontend.

## Consideraciones de seguridad

- Migraciones destructivas: ejecutar primero en `local`/`dev`; respaldar BD antes de `migrate:latest` en GCP.
- Eliminar grants y rutas de trabajadores evita acceso a funcionalidad retirada vía navegación o API directa.
- El selector de proveedores en Document Builder debe respetar grants existentes (`NAV_ACTION_PROVEEDORES_READ` o equivalente ya usado en listado).
- Endpoints de document builder deben seguir validando JWT y permisos de navegación.
- Mensajes de error al usuario permanecen en español (es-CL).
