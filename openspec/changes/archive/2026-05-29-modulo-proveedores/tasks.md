## 1. Base de datos

- [x] 1.1 Crear `backend/migrations/202605290003_create_supplier_tables.js`: tablas `supplier` y `supplier_social_network` con estructura exacta del modelo (tipos, CHECK `supplier_type`, personería, auditoría FK a `user_profile`); `down` — `DROP TABLE IF EXISTS supplier_social_network, supplier CASCADE`
- [x] 1.2 Crear `backend/migrations/202605290004_insert_proveedores_navigation_nodes.js`: SELECT parent `NAV_MENU_ADMIN_GLOBAL`; insertar `NAV_ITEM_PROVEEDORES_PROVEEDORES` + acciones READ/CREATE/EDIT; otorgar grants a `ADMINISTRADOR_PLATAFORMA`; `down` — eliminar nodos y grants insertados (idempotente en `up` si nodos ya existen)
- [x] 1.3 Ejecutar `npm run migrate:latest` en backend y verificar tablas + nodos de navegación

## 2. Seeds y navegación

- [x] 2.1 Editar `backend/seeds/002_navigation_authorization_seed.js` (leer completo): agregar códigos a arrays de limpieza/orden; `ROUTE_PATH_BY_NAV_ITEM_CODE` con `/app/proveedores`; nodos bajo `menuAdminGlobalId` (NO crear `NAV_MENU_PROVEEDORES`); grants READ+CREATE+EDIT en perfil `ADMINISTRADOR_PLATAFORMA`

## 3. Backend — servicio

- [x] 3.1 Crear `backend/services/supplierService.js` con `listSuppliers`, `getSupplierById`, `createSupplier`, `updateSupplier`
- [x] 3.2 Implementar validación RUT con `parseRut` (patrón `employeeService.js`), campos requeridos por tipo, transacciones Knex, replace-all de redes sociales en update, ordenamiento empresa→persona alfabético, búsqueda ILIKE
- [x] 3.3 Formatear RUT en respuestas (`XX.XXX.XXX-X`) y errores 404/400 en español

## 4. Backend — controller y rutas

- [x] 4.1 Crear `backend/controllers/supplierController.js` (patrón `employeeController.js`): `getList`, `getDetail`, `postCreate`, `putUpdate`
- [x] 4.2 Editar `backend/app.js` (leer completo): registrar `GET/POST /api/suppliers` y `GET/PUT /api/suppliers/:id` con `requireAuth` y grants `NAV_ACTION_PROVEEDORES_READ|CREATE|EDIT` (PUT con `anyOf` CREATE+EDIT como empleados)

## 5. Backend — tests (opcional recomendado)

- [x] 5.1 Crear `backend/test/supplierApi.test.js`: list con búsqueda, create persona natural/empresa, update redes, 403 sin grant, 404 inexistente

## 6. Frontend — API y permisos

- [x] 6.1 Crear `frontend/src/api/suppliersApi.js` (patrón `employeesApi.js`): `fetchSuppliersList`, `fetchSupplierDetail`, `createSupplier`, `updateSupplier`
- [x] 6.2 Crear `frontend/src/navigation/proveedoresAuth.js`: `PROVEEDORES_MUTATE_GRANT_CODES`, `canMutateProveedores(grants)`

## 7. Frontend — páginas

- [x] 7.1 Crear `frontend/src/pages/SupplierFormSections.jsx` (patrón `EmployeeFormSections.jsx`): tipo, datos PN/empresa, rep. legal, personería, redes dinámicas
- [x] 7.2 Crear `frontend/src/pages/SupplierUpsertPage.jsx`: create/edit, tipo bloqueado en edición, validaciones RUT y fechas ISO, botones Guardar/Cancelar según grants
- [x] 7.3 Crear `frontend/src/pages/SupplierListPage.jsx`: búsqueda subheader, tabla con chip tipo, columnas nombre/RUT/cantidad redes, links Ver/Editar `#F62D84`, botón Nuevo con CREATE
- [x] 7.4 Crear `frontend/src/pages/SupplierViewPage.jsx`: secciones condicionales solo lectura, botones Volver/Editar según grants

## 8. Frontend — rutas e iconografía

- [x] 8.1 Editar `frontend/src/routes/AppRouter.jsx` (leer completo): rutas `/proveedores`, `/proveedores/nuevo`, `/proveedores/:id`, `/proveedores/:id/edit` con protección READ/CREATE/EDIT (patrón employees)
- [x] 8.2 Editar `frontend/src/navigation/sidebarIconography.jsx`: ícono para `NAV_ITEM_PROVEEDORES_PROVEEDORES` (no agregar `NAV_MENU_PROVEEDORES`)

## 9. Verificación

- [x] 9.1 Smoke manual: login admin plataforma → Proveedores bajo Administración global → crear PN y Empresa con redes → ver detalle → editar → buscar en listado
- [x] 9.2 `npm test` backend; `npm run build` frontend sin errores de import
- [x] 9.3 Verificar UI: botones píldora, cards 8px, Nunito Sans, links `#F62D84`; botones acción ocultos sin grant
