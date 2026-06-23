## Why

El dashboard actual consume `/api/placeholder/dashboard` y muestra tarjetas y tablas con datos hardcodeados, junto a un bloque "En construcción". Los usuarios no obtienen visibilidad real del estado de proveedores, contratos ni plantillas — las tres funcionalidades centrales del sistema. Este cambio entrega un resumen operativo con métricas vivas desde PostgreSQL.

## What Changes

- Nuevo endpoint `GET /api/dashboard/stats` que ejecuta conteos reales en paralelo sobre `supplier`, `draft_document`, `document` y `template` (plantillas estándar activas), convirtiendo COUNT de Knex a números antes de responder.
- Nuevo backend: `dashboardService.js`, `dashboardController.js` y registro de ruta en `app.js`.
- Nuevo frontend: API client `dashboardApi.js`, reescritura completa de `DashboardPage.jsx` con tres widgets inline (Proveedores, Contratos, Plantillas) y estilos dedicados en `frontend/src/styles/dashboard.css`.
- Cada widget se renderiza solo si el usuario tiene el permiso CASL correspondiente (`read Supplier`, `use DocumentBuilder`, `read Template`); botones de creación condicionados a `create`.
- El endpoint placeholder `/api/placeholder/dashboard` **se mantiene sin cambios**.
- Se elimina el uso de componentes placeholder (`PlaceholderCardGrid`, `PlaceholderTable`, `UnderConstructionBlock`) en el dashboard.

## Capabilities

### New Capabilities

- `dashboard-live-widgets`: endpoint de estadísticas del dashboard y UI de widgets con datos reales, permisos CASL por widget y acciones de navegación.

### Modified Capabilities

_(ninguna — no existen specs previas de dashboard en `openspec/specs/`)_

## Impact

- **API**: un endpoint nuevo bajo `/api/dashboard/stats`; requiere JWT y permiso `read Dashboard`.
- **Frontend**: reemplazo total de `DashboardPage.jsx`; nuevo CSS aislado; sin cambios en `AppRouter.jsx`, `variables.css` ni `global.css`.
- **Base de datos**: solo lecturas (COUNT); sin migraciones.
- **Tests**: tests de API para el nuevo endpoint siguiendo el patrón de `placeholderApi.test.js`.
- **Deuda técnica documentada**: botón "Ver contratos" deshabilitado (listado de contratos aún no existe).

## Consideraciones de seguridad

- El endpoint exige JWT válido y permiso CASL `read Dashboard` (mismo gate que el placeholder actual).
- Los conteos agregados no exponen filas individuales ni PII; la visibilidad por widget se refuerza en frontend con `useAbility`.
- Errores al usuario en español (es-CL); no exponer detalles internos de BD en respuestas 500.
- Validación de sesión en frontend antes de llamar al API (patrón existente con `accessToken`).
