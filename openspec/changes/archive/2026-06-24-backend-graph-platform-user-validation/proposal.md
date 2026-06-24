## Why

El alta de usuarios de plataforma sigue validando identidades contra Keycloak Admin (`findUserIdByEmail`), pero la migración a Microsoft Entra ID ya avanzó en login (OIDC) y resolución por email. Mantener Keycloak solo para lookup en registro bloquea retirar la infraestructura IdP legacy y duplica credenciales de administración. Microsoft Graph con permiso de aplicación `User.Read.All` (ya consentido) permite validar en solo lectura que el correo existe en el tenant antes de crear `user_profile`, sin tocar frontend ni flujo de login.

## What Changes

- Nuevo cliente `backend/lib/graphClient.js`: autenticación app-only (client credentials), token cacheado, y `findUserByEmail(email)` → `{ id, fullName } | null` (mismo shape que Keycloak).
- Configuración en `backend/config.js`: `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` en todos los entornos; defaults de tenant/clientId en `local`; secreto siempre desde env.
- `platformUsersAdminService.js`: reemplazar lookup Keycloak por Graph en `createPlatformUser`; mensajes de error actualizados a Entra (es-CL).
- Eliminar edición de email en actualización de usuario de plataforma: quitar `updateUserEmail` del flujo de edición y sacar `email` de campos editables en `validateUpdatePayload` (el correo es identidad de Entra, fijada solo al crear).
- Tests unitarios de `graphClient` y actualización de tests de `platformUsersAdminService` con Graph mockeado.

**Sin cambios en esta etapa:**

- Frontend y login MSAL/OIDC.
- Eliminación de `keycloakAdminClient.js` ni `scripts/delete-app-user.js` (etapa 5.5 de limpieza).
- Operaciones de escritura en Graph (solo lectura; `User.Read.All` no permite PATCH/DELETE).

## Capabilities

### New Capabilities

- `backend-graph-client`: Cliente Microsoft Graph app-only (client credentials) con token cacheado, `isGraphConfigured()`, y lookup de usuario por email vía filtro OData robusto (mail, UPN, otherMails).

### Modified Capabilities

- `platform-users-admin`: Lookup en create pasa de Keycloak a Graph; `full_name` desde `displayName` de Graph; update ya no acepta ni propaga cambios de `email`.
- `platform-users-idp-register-only`: Requisitos de alta referencian validación en tenant Entra (Graph) en lugar de Keycloak; mensajes 422 actualizados.
- `backend-keycloak-admin-client`: El requisito de provisioning de usuarios de plataforma deja de exigir uso de Keycloak en runtime; el cliente permanece para scripts operativos.

## Impact

- **Backend**: `lib/graphClient.js` (nuevo), `config.js`, `services/platformUsersAdminService.js`, tests en `backend/test/`.
- **API**: `POST /api/platform/users` mantiene contrato HTTP (422 `IDP_USER_NOT_FOUND`, 503 si Graph no configurado o falla lookup); `PATCH /api/platform/users/:id` ignora/rechaza cambios de email según diseño (email no editable).
- **Config / ops**: variables `GRAPH_*` requeridas para provisioning; `SET_VARS_AMBIENTE_LOCAL.cmd` ya incluye placeholders Graph.
- **Fuera de alcance**: frontend, login, eliminación de Keycloak, scripts de borrado.

## Consideraciones de seguridad

- `GRAPH_CLIENT_SECRET` no debe tener default en código; solo desde variables de entorno.
- Graph es solo lectura: no exponer ni intentar operaciones de escritura que fallarían con 403.
- El email se normaliza con `normalizeAuthEmail` antes de consultar Graph, consistente con el resto del sistema.
- Errores de red/token de Graph se mapean a 503 (fallo de servicio), distintos de "usuario no encontrado" (422), para no filtrar existencia de cuentas por fallos transitorios mal interpretados.
- El filtro OData escapa el email para evitar inyección en la query; permiso `User.Read.All` limita el alcance al tenant configurado.
