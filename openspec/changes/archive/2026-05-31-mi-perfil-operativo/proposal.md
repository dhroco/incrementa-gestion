## Why

La pantalla "Mi Perfil" hoy solo muestra nombre, correo de login y rol en modo lectura. Los usuarios no pueden personalizar su experiencia (avatar, email de contacto distinto al de Keycloak, ni qué widgets ven en el Dashboard). Esto limita la identidad visible en la app y la configurabilidad del inicio sin tocar el IdP.

## What Changes

- Migración `202606020001_add_profile_extras_to_user_profile.js`: columnas `avatar_gcs_path`, `contact_email` y `widget_preferences` (JSONB) en `user_profile`.
- `userSessionMetaService.loadSessionMetaForUser`: incluir los nuevos campos en el SELECT y retornarlos en el objeto de meta de sesión.
- `sessionResponses.buildEnrichedSessionSuccessBody` y `enrichedSessionPayload` en `app.js`: exponer `contact_email`, `widget_preferences` y `avatar_url` (URL firmada GCS 24h cuando hay avatar).
- Nuevos endpoints autenticados (sin CASL adicional):
  - `PUT /api/me/profile` — actualizar `contact_email` y/o `widget_preferences`
  - `POST /api/me/avatar` — upload multipart (multer memoryStorage, solo en este endpoint) → GCS → actualizar `avatar_gcs_path`; eliminar avatar anterior si existía
- Extensión de `meController.js` con `putProfile` y `postAvatar`; inyectar `gcsService` y `db`.
- Dependencia `multer` en backend (solo endpoint de avatar).
- Frontend `authSlice.js`: campos `avatarUrl`, `contactEmail`, `widgetPreferences`; selectores y action `updateProfileData`.
- Frontend `MyProfilePage.jsx`: tres secciones (avatar editable, datos personales con email de contacto, checkboxes de widgets con debounce 800ms).
- Frontend `DashboardPage.jsx`: respetar `widgetPreferences` además de CASL (default todos activos si null).
- Nuevo `frontend/src/api/meApi.js` con `updateMyProfile` y `uploadMyAvatar`.

**No se incluye**: avatar en el header de la app; modificación de email de login en Keycloak; permisos MCP adicionales.

## Capabilities

### New Capabilities

- `my-profile`: CRUD de preferencias personales del usuario autenticado — avatar en GCS, email de contacto, preferencias de widgets del Dashboard; migración BD, endpoints `/api/me/profile` y `/api/me/avatar`, UI en Mi Perfil.

### Modified Capabilities

- `backend-auth-session-endpoints`: La sesión enriquecida SHALL incluir `contact_email`, `widget_preferences` y `avatar_url` (signed URL) cuando existan en `user_profile`.
- `frontend-backend-auth-session`: El auth slice SHALL almacenar y exponer `avatarUrl`, `contactEmail` y `widgetPreferences` desde la sesión enriquecida, con action `updateProfileData` para actualizaciones locales sin re-login.
- `dashboard-live-widgets`: La visibilidad de cada widget SHALL respetar las preferencias del usuario (`widget_preferences`) además de los permisos CASL; si `widget_preferences` es null, todos los widgets permitidos por CASL se muestran.

## Impact

- **Base de datos**: tres columnas nuevas en `user_profile`.
- **API**: dos endpoints nuevos bajo `/api/me/*`; ampliación del payload de `GET /api/me/session`.
- **GCS**: rutas `avatars/{userProfileId}/{uuid}.{ext}`; uso de `uploadBuffer`, `deleteFile`, `getSignedUrl` existentes.
- **Frontend**: `MyProfilePage`, `DashboardPage`, `authSlice`, nuevo `meApi.js`.
- **Dependencias**: `multer` en backend.
- **Tests**: `meProfileApi.test.js` (integración avatar/profile), ampliación de `sessionResponses.test.js`, `meSessionApi.test.js`, tests frontend de auth slice si aplica.

## Consideraciones de seguridad

- Avatar y preferencias son datos del propio usuario: endpoints exigen JWT válido; no se requiere permiso CASL adicional más allá de autenticación.
- El `contact_email` es independiente del email de login (Keycloak); no se modifica Keycloak.
- Upload de avatar: validar MIME (`image/jpeg`, `image/png`, `image/webp`) y tamaño máximo 2 MB en backend; el frontend limita `accept` en el input.
- URLs de avatar son firmadas server-side (24h); el frontend no accede a GCS directamente.
- Al reemplazar avatar, eliminar el archivo anterior en GCS (try/catch si no existe) para evitar objetos huérfanos.
- Validación de `widget_preferences`: solo keys booleanas `suppliers`, `contracts`, `templates`; rechazar payload inválido con 400 en español.
- Las preferencias de widget no elevan privilegios: un widget oculto por CASL nunca se muestra aunque la preferencia esté activa.
