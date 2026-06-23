## 1. Configuración Keycloak admin

- [x] 1.1 Agregar `KEYCLOAK_ADMIN_URL`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD` y `KEYCLOAK_REALM` en `backend/config.js` (todos los ambientes vía `process.env`; defaults según design)
- [x] 1.2 Actualizar `backend/SET_VARS_AMBIENTE_LOCAL.cmd`: `KEYCLOAK_ADMIN_PASSWORD=admin`, URL/user/realm y eco de verificación en el script

## 2. Cliente Keycloak Admin

- [x] 2.1 Crear `backend/lib/keycloakAdminClient.js` con obtención de token master (ROPC `admin-cli`), caché con margen de 10 s y `getKeycloakAdminClient()` que retorna `null` si falta config
- [x] 2.2 Implementar `createUser` (POST users, `username`/`email`, `emailVerified`, credencial `temporary: false`, sin `requiredActions`, UUID desde `Location`)
- [x] 2.3 Agregar comentario de deuda técnica (Entra ID / obsolescencia de `must_change_password` en BD) en `keycloakAdminClient.js`
- [x] 2.4 Implementar `deleteUser` y `updateUserEmail` usando solo `fetch`
- [x] 2.5 Mapear errores HTTP de Keycloak a `Error` con mensajes en español (es-CL) para consumo de servicios

## 3. Servicios de aprovisionamiento

- [x] 3.1 Migrar `accountantAdminService.js`: reemplazar Supabase admin por Keycloak en `createAccountant` y rollback `deleteUser`; actualizar mensaje `ADMIN_CLIENT_UNAVAILABLE`
- [x] 3.2 Migrar `platformUsersAdminService.js`: create + rollback + `updateUserEmail` en flujo de actualización de correo
- [x] 3.3 Migrar `internalCompanyUsersService.js`: create + rollback + `updateUserEmail`
- [x] 3.4 Confirmar que `completePasswordRotation` / `accountantPlatformController.postPasswordRotationComplete` no requieren llamadas admin (solo BD)

## 4. Scripts de borrado

- [x] 4.1 Reescribir `delete-accountant-user.js`: sin `auth.users` ni `deleteAuthDependentsForUsers`; resolver por `user_profile`, borrar datos app, `deleteUser` en Keycloak
- [x] 4.2 Reescribir `delete-app-user.js` con el mismo criterio (solo `public.*` + Keycloak Admin API)

## 5. Verificación manual

- [ ] 5.1 Con Keycloak local y vars cargadas: crear contador (`POST /api/platform/accountants` o UI) y verificar usuario en Admin Console realm `incrementa`
- [ ] 5.2 Login `POST /api/auth/login` con credenciales del usuario creado → token válido
- [ ] 5.3 Verificar que `user_profile.user_id` en BD coincide con el UUID del usuario en Keycloak
- [ ] 5.4 Probar flujo `must_change_password`: login ROPC con contraseña inicial sin bloqueo de Keycloak; flag en sesión desde BD; `POST /api/me/password-rotation-complete` limpia el flag en BD
