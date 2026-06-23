## Why

El cambio 7 (`drop-contador-empresa-profiles`) eliminó correctamente los perfiles `CONTADOR` y `USUARIO_EMPRESA_ADMINISTRADOR`, pero dejó residuos en la base de datos y en artefactos de código: los nodos de navegación de Contadores y sus grants para `ADMINISTRADOR_PLATAFORMA` siguen activos. Como resultado, el menú lateral muestra la entrada "Contadores" aunque la funcionalidad ya no existe.

## What Changes

- Nueva migración Knex irreversible que elimina de `profile_navigation_grant` todos los registros cuyo `navigation_node_id` corresponda a nodos con código `ILIKE '%CONTADOR%'`, y luego elimina esos nodos de `navigation_node`.
- Limpieza de `backend/seeds/002_navigation_authorization_seed.js`: quitar definiciones, mapeos de ruta e inserciones de `NAV_ITEM_ADMIN_GLOBAL_CONTADORES`, sus tres acciones (READ/CREATE/EDIT) y `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS`.
- Limpieza de `frontend/src/navigation/sidebarIconography.jsx`: quitar mapeos de ícono y ruta para Contadores.
- Limpieza de `backend/package.json`: eliminar el script `delete-accountant` que apunta a un archivo inexistente.

**Restricciones:** no modificar migraciones existentes; no tocar otras entradas del seed ni del sidebar.

## Capabilities

### New Capabilities

- `remove-contadores-navigation-residuals`: Completar la limpieza post–drop-contador eliminando nodos de navegación, grants y referencias de código asociados a Contadores, de modo que el admin no vea entradas de menú ni artefactos huérfanos.

### Modified Capabilities

- `drop-contador-empresa-profiles`: Ampliar el alcance de limpieza de seeds y verificación para incluir nodos/grants de Contadores otorgados a `ADMINISTRADOR_PLATAFORMA`, no solo grants de perfiles eliminados.

## Impact

- **Base de datos**: eliminación de 4+ filas en `profile_navigation_grant` y nodos `NAV_*CONTADOR*` en `navigation_node` (confirmado: `NAV_ITEM_ADMIN_GLOBAL_CONTADORES`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE`, `NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT`).
- **Seeds**: `002_navigation_authorization_seed.js` deja de recrear nodos/grants de Contadores en entornos frescos.
- **Frontend**: sidebar sin ícono ni ruta para `/app/admin-global/contadores`.
- **Backend**: script npm huérfano eliminado.
- **Criterio de éxito**: login como `admin@incrementa.la` — el menú lateral no muestra "Contadores".

## Consideraciones de seguridad

- Migración destructiva e irreversible: ejecutar primero en entornos no productivos; respaldar BD antes de `migrate:latest` en GCP.
- Solo se eliminan nodos cuyo código contiene `CONTADOR`; no se alteran grants ni nodos de otras funcionalidades.
- La limpieza reduce superficie de confusión (enlace a funcionalidad inexistente) sin ampliar permisos.
