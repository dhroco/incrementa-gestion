## 0. Lectura previa (obligatoria)

- [x] 0.1 Leer completos: `backend/app.js`, `backend/services/abilityService.js`, `backend/controllers/platformUsersController.js`, `backend/services/platformUsersAdminService.js`
- [x] 0.2 Leer completos: `frontend/src/pages/PlatformUsersListPage.jsx`, `frontend/src/pages/PlatformUserCreatePage.jsx`, `frontend/src/routes/AppRouter.jsx`, `frontend/src/navigation/menuConfig.js`, `frontend/src/styles/global.css`

## 1. Catálogo de permisos

- [x] 1.1 Crear `backend/config/permissionsCatalog.js` con `SUBJECTS`, `ACTIONS_BY_SUBJECT`, `ACTION_LABELS` (sin action `delete`)
- [x] 1.2 Crear `frontend/src/config/permissionsCatalog.js` con contenido idéntico al backend

## 2. Backend — service

- [x] 2.1 Crear `backend/services/rolesService.js` con `listRoles()` (incluye `usersCount`, `permissionsCount`)
- [x] 2.2 Implementar `getRoleById(roleId)` retornando perfil + permisos `{ id, action, subject, inverted }`
- [x] 2.3 Implementar `createRole({ code, label })` con validación de campos y code único
- [x] 2.4 Implementar `updateRoleLabel({ roleId, label })` (code inmutable)
- [x] 2.5 Implementar `deleteRole(roleId)` con guardas: usuarios asignados y `ADMINISTRADOR_PLATAFORMA`
- [x] 2.6 Implementar `replaceRolePermissions({ roleId, permissions })` con validación contra catálogo + excepción `manage/all`, transacción DELETE+INSERT

## 3. Backend — controller y rutas

- [x] 3.1 Crear `backend/controllers/rolesController.js` (factory) con handlers: getList, postCreate, getById, putUpdateLabel, deleteRole, putPermissions
- [x] 3.2 Registrar rutas `/api/roles` en `backend/app.js` después de platform/users, con `authorize` en subject `RolePermission`
- [x] 3.3 Crear `backend/test/rolesApi.test.js` cubriendo listado, creación, validación de permisos, delete bloqueado y guarda admin

## 4. Frontend — API client

- [x] 4.1 Crear `frontend/src/api/rolesApi.js` con fetchRolesList, fetchRoleById, createRole, updateRoleLabel, deleteRole, saveRolePermissions (patrón suppliersApi)

## 5. Frontend — componente PermissionMatrix

- [x] 5.1 Crear `frontend/src/components/PermissionMatrix.jsx` con matriz subjects × actions, em dash donde no aplica, props `permissions`, `onChange`, `readOnly`
- [x] 5.2 Usar estilos de tabla existentes (`global.css`); sin CSS nuevo innecesario

## 6. Frontend — páginas

- [x] 6.1 Crear `RolesListPage.jsx`: PageShell, tabla, empty state, badge "Acceso total", botones con `.btn` y checks CASL
- [x] 6.2 Crear `RoleCreatePage.jsx`: formulario code (UPPER_SNAKE_CASE) + label, POST y redirect a detalle
- [x] 6.3 Crear `RoleDetailPage.jsx`: sección datos (label editable, code readonly), sección permisos (panel manage/all o PermissionMatrix), re-fetch tras guardar permisos, eliminar si usersCount === 0

## 7. Frontend — rutas

- [x] 7.1 Agregar rutas en `AppRouter.jsx` bajo `admin-global/roles-permisos` con `RequireCan` (read/create/read según ruta)
- [x] 7.2 Verificar breadcrumb y navegación desde menú existente en `menuConfig.js`

## 8. Verificación

- [x] 8.1 Backend: `npm test` pasa incluyendo `rolesApi.test.js`
- [x] 8.2 Frontend: `npm run build` sin errores
- [x] 8.3 Smoke manual: listar roles → crear rol → editar label → configurar permisos → intentar eliminar rol con usuarios → verificar badge "Acceso total" en ADMINISTRADOR_PLATAFORMA
