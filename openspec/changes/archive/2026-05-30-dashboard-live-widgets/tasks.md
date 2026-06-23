## 1. Backend — servicio y endpoint

- [x] 1.1 Crear `backend/services/dashboardService.js` con `getDashboardStats()` que ejecute en paralelo (`Promise.all`) las queries de conteo sobre `supplier`, `draft_document`, `document` y `template`/`template_standard`; incluir helper `_toCount()` para convertir strings de Knex a número
- [x] 1.2 Crear `backend/controllers/dashboardController.js` con handler delgado que invoque el servicio y mapee errores a 500 con mensaje en español
- [x] 1.3 Registrar `GET /api/dashboard/stats` en `backend/app.js` con middleware `authorize('read', 'Dashboard')` y respuesta via `sendOk`
- [x] 1.4 Verificar que `GET /api/placeholder/dashboard` permanece sin cambios

## 2. Backend — tests

- [x] 2.1 Crear `backend/test/dashboardApi.test.js` con casos: 200 con stats numéricos para usuario autorizado, 401 sin auth, 403 sin permiso Dashboard
- [x] 2.2 Validar en test que los campos numéricos del payload son `typeof number` (no strings)

## 3. Frontend — API client

- [x] 3.1 Crear `frontend/src/api/dashboardApi.js` con `fetchDashboardStats({ accessToken })` usando `apiGet('/api/dashboard/stats')`

## 4. Frontend — estilos del dashboard

- [x] 4.1 Crear `frontend/src/styles/dashboard.css` con grid responsive, estilos de tarjeta (border-radius 24px, degradés por widget, decoración sutil), variantes de botón primario/secundario/deshabilitado, y estado de carga dentro de la tarjeta
- [x] 4.2 Confirmar que no se modifican `variables.css`, `global.css` ni `AppRouter.jsx`

## 5. Frontend — DashboardPage

- [x] 5.1 Reescribir `frontend/src/pages/DashboardPage.jsx`: eliminar imports y uso de componentes placeholder; importar `dashboard.css` y `dashboardApi`
- [x] 5.2 Implementar fetch de stats con estados loading/error/denied/success (patrón existente con `accessToken`, `ErrorBlock`, `AccessDeniedBlock`)
- [x] 5.3 Implementar widget inline **Proveedores** (degradé púrpura): métrica total, desglose persona natural/empresa, acciones a listado y crear (condicionado a `create Supplier`); visible solo con `read Supplier`
- [x] 5.4 Implementar widget inline **Contratos** (degradé naranja): borradores pendientes, total firmados, acción primaria al constructor, "Ver contratos" como elemento no navegable deshabilitado; visible solo con `use DocumentBuilder`
- [x] 5.5 Implementar widget inline **Plantillas** (degradé dorado): total activas, nombre más reciente, acciones a listado y `/gestion-contratos/templates-estandar/nueva` (condicionado a `create Template`); visible solo con `read Template`
- [x] 5.6 Usar `useAbility(AbilityContext)` para permisos por widget y botones; formatear números con `Intl.NumberFormat('es-CL')`
- [x] 5.7 Mostrar mensaje vacío amigable cuando ningún widget es visible para el perfil del usuario

## 6. Verificación manual

- [x] 6.1 Probar dashboard con usuario que tenga los tres permisos: widgets cargan datos reales y acciones navegan correctamente
- [x] 6.2 Probar con usuario sin permisos de módulos: solo mensaje vacío (sin error)
- [x] 6.3 Confirmar que "Ver contratos" no navega y se ve deshabilitado
- [x] 6.4 Ejecutar tests backend: `npm test -- dashboardApi.test.js`
