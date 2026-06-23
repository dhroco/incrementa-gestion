## Why

El módulo "Gestión de suscripciones" existe solo como entradas de navegación (menú, grants e iconos) sin controllers, services, tablas ni páginas reales. Mantenerlo en el sidebar confunde al usuario con enlaces que no llevan a funcionalidad implementada y aumenta superficie de mantenimiento en seeds y migraciones de navegación.

## What Changes

- **BREAKING**: Eliminación del menú lateral "Gestión de suscripciones" y sus 3 sub-ítems (Tarifas y planes, Suscripción / renovación, Facturación) para todos los perfiles que los tenían concedidos.
- Migración `202605290011_drop_suscripciones_navigation_nodes.js`: DELETE de `profile_navigation_grant` y `navigation_node` donde `code ILIKE '%SUSCRIPCIONES%'`.
- Seed `002_navigation_authorization_seed.js`: quitar nodo `NAV_MENU_GESTION_SUSCRIPCIONES`, sus 3 hijos, rutas en `ROUTE_PATH_BY_NAV_ITEM_CODE`, entradas en `CODES_IN_SCOPE` y los 4 grants de `ADMINISTRADOR_PLATAFORMA`.
- `sidebarIconography.jsx`: quitar mapeos de icono para los 3 `NAV_ITEM_SUSCRIPCIONES_*` y eliminar imports MUI huérfanos (`PaymentsOutlinedIcon`, `AutorenewOutlinedIcon`, `ReceiptLongOutlinedIcon`) si no se usan en otro nodo.

**No se modifica**: `AppRouter.jsx`, controllers, services, tablas de BD ni otros módulos del menú (empresas, contratos, proveedores, admin, sistema).

## Capabilities

### New Capabilities

- `remove-subscriptions-navigation`: El sistema no expone menú, grants ni iconografía de Gestión de suscripciones; la navegación del admin no incluye entradas de suscripciones.

### Modified Capabilities

_(ninguna — cambio acotado a navegación; no altera specs de auth, empresas, contratos ni proveedores)_

## Impact

- **Base de datos**: eliminación de 4 nodos (`NAV_MENU_GESTION_SUSCRIPCIONES` + 3 ítems) y grants asociados en `profile_navigation_grant`.
- **Seeds**: entornos frescos dejan de recrear el menú de suscripciones.
- **Frontend**: sidebar sin iconos ni entradas de suscripciones; posible reducción de imports MUI no usados.
- **API / rutas**: sin cambio — las rutas `/app/suscripciones/*` nunca estuvieron en `AppRouter.jsx`.

## Consideraciones de seguridad

- Migración destructiva e irreversible: ejecutar primero en `local`/`dev`; respaldar BD antes de `migrate:latest` en GCP.
- Solo se eliminan nodos cuyo `code` contiene `SUSCRIPCIONES`; no se alteran grants de otros módulos.
- Reduce confusión (enlaces a funcionalidad inexistente) sin ampliar permisos.
