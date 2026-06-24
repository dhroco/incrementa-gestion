## Context

El alta de usuarios de plataforma (`createPlatformUser` en `platformUsersAdminService.js`) valida hoy que el correo exista en Keycloak mediante `getKeycloakAdminClient().findUserIdByEmail(email)`. Si existe, persiste `user_profile` con `user_id` = UUID de Keycloak y `full_name` derivado de `firstName`/`lastName`. En edición, `updatePlatformUser` puede cambiar el email vía `updateUserEmail` en Keycloak.

La migración a Entra ID ya cubrió validación OIDC del JWT y resolución de identidad interna por email (`backend-entra-id-email-identity`). Keycloak Admin queda como dependencia residual solo para lookup en registro y sync de email en edición — credenciales y URL de admin que ya no corresponden al IdP productivo.

Microsoft Graph con permiso de aplicación `User.Read.All` (consentido) permite consultar usuarios del tenant en solo lectura. El patrón de cliente singleton + token cacheado ya existe en `keycloakAdminClient.js` y se reutiliza como referencia.

## Goals / Non-Goals

**Goals:**

- Nuevo `backend/lib/graphClient.js` con autenticación client credentials, token cacheado (margen 10 s), `isGraphConfigured()`, y `findUserByEmail(email)` → `{ id, fullName } | null`.
- Config `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` en `backend/config.js` (todos los entornos).
- `platformUsersAdminService.js` usa Graph en create; elimina uso de Keycloak en runtime de este servicio.
- Quitar edición de email en update (sin `updateUserEmail`; email no editable tras el alta).
- Tests unitarios de `graphClient` y tests de servicio con Graph mockeado.

**Non-Goals:**

- Frontend, login MSAL, middleware OIDC.
- Eliminar `keycloakAdminClient.js` ni `scripts/delete-app-user.js` (etapa 5.5).
- Operaciones de escritura en Graph (PATCH/DELETE).
- Cambiar forma de respuestas HTTP de list/detail (salvo que update ignore email).

## Decisions

### 1. Módulo `graphClient.js` (mismo patrón que Keycloak)

- **Elección**: Clase interna + `getGraphClient()` singleton + `isGraphConfigured()` exportado; `GraphClientError` para fallos de token/red/API.
- **Token**: `POST https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token` con `grant_type=client_credentials`, `client_id`, `client_secret`, `scope=https://graph.microsoft.com/.default`. Cache en memoria con `expires_in` y margen de 10 s (igual que Keycloak).
- **Rationale**: Consistencia con código existente; sin nuevas dependencias npm (native `fetch`).

### 2. `findUserByEmail` — query OData robusta

```
GET https://graph.microsoft.com/v1.0/users
  ?$filter=mail eq '{email}' or userPrincipalName eq '{email}' or otherMails/any(x:x eq '{email}')
  &$count=true
  &$select=id,displayName,mail,userPrincipalName
Headers:
  Authorization: Bearer {token}
  ConsistencyLevel: eventual
```

- Email normalizado con `normalizeAuthEmail` antes de interpolar en el filtro.
- Escapar comillas simples en el email para OData (`'` → `''`).
- Primer elemento de `value[]`; vacío → `null`.
- Retorno: `{ id: user.id, fullName: user.displayName?.trim() || email }` (mismo shape que Keycloak).
- **Rationale**: UPN ≠ mail es habitual en Entra; `otherMails` cubre alias; `$count` + `ConsistencyLevel: eventual` son obligatorios para filtros `any()`.

### 3. Configuración Graph

| Variable | local default (si env vacío) | dev/prod |
|----------|------------------------------|----------|
| `GRAPH_TENANT_ID` | `60322b4a-13bf-4f19-89ae-efe4a54ffed6` | solo `process.env` |
| `GRAPH_CLIENT_ID` | `dc734f4a-5f25-4e88-b728-aab4715f2122` | solo `process.env` |
| `GRAPH_CLIENT_SECRET` | sin default (requerido para operar) | solo `process.env` |

- `isGraphConfigured()` exige las tres variables truthy.
- `SET_VARS_AMBIENTE_LOCAL.cmd` ya define `GRAPH_*` para desarrollo local.

### 4. Cambios en `platformUsersAdminService.js`

**Create:**

- Reemplazar `getKeycloakAdminClient()` por `getGraphClient()`.
- `graphClient.findUserByEmail(email)` en lugar de `findUserIdByEmail`.
- Mantener códigos HTTP: 503 `ADMIN_CLIENT_UNAVAILABLE` si Graph no configurado o error de infraestructura; 422 `IDP_USER_NOT_FOUND` si null; 409 duplicados.
- Actualizar mensajes a Entra (es-CL), p. ej.: «El usuario con ese email no existe en el directorio de Microsoft Entra. Créalo primero en el tenant.»
- `user_id` = Graph `id` (oid GUID).

**Update:**

- Eliminar bloque `updateUserEmail` y dependencia de Keycloak en update.
- `validateUpdatePayload`: no aceptar `email` como campo editable (ignorar si viene en body, o validar y no persistir — preferir ignorar silenciosamente para no romper clientes legacy hasta etapa frontend).
- **Decisión**: ignorar `email` en update sin error si se envía (compatibilidad); no actualizar columna `email` en BD.

### 5. Manejo de errores

| Situación | Comportamiento |
|-----------|----------------|
| Graph no configurado | 503 `ADMIN_CLIENT_UNAVAILABLE` |
| Token/red/5xx Graph | 503, mensaje genérico de lookup fallido |
| `value[]` vacío | 422 `IDP_USER_NOT_FOUND` |
| Usuario encontrado | Crear `user_profile` como hoy |

- No confundir error de servicio con "no encontrado".

### 6. Tests

- `backend/test/graphClient.test.js`: mock de `fetch` — usuario encontrado, lista vacía → null, error de token/red → throw.
- Tests de `platformUsersAdminService` (nuevo archivo o extensión): mock `getGraphClient` / inyección.
- Actualizar test de API `platformUsersPlatformApi.test.js` si el mensaje 422 cambia de Keycloak a Entra.

- Exportar `resetGraphClientForTests()` análogo a Keycloak para aislar tests.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Filtro OData mal escapado | Escapar `'` en email; tests con emails edge case |
| Latencia Graph en cada alta | Token cacheado; lookup solo en create |
| `displayName` vacío | Fallback a email normalizado (igual que Keycloak sin nombre) |
| Clientes que envían email en PATCH | Ignorar sin error hasta cambio de frontend |
| Permiso solo lectura | No intentar PATCH; documentar en código |
| Secreto en repo | Sin default de `GRAPH_CLIENT_SECRET`; script local gitignored |

## Migration Plan

1. Desplegar backend con variables `GRAPH_*` configuradas en dev/prod.
2. Verificar `isGraphConfigured()` true en cada entorno antes de habilitar altas.
3. Rollback: revertir deploy; Keycloak client sigue en repo para scripts — re-apuntar servicio si fuera necesario (no se elimina en esta etapa).
4. Sin migración de BD.

## Open Questions

- Ninguna bloqueante: permiso `User.Read.All` ya consentido; tenant/clientId locales alineados con OIDC existente.
