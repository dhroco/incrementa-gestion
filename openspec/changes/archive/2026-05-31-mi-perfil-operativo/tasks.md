## 1. Base de datos

- [x] 1.1 Crear migración `backend/migrations/202606020001_add_profile_extras_to_user_profile.js` con columnas `avatar_gcs_path`, `contact_email`, `widget_preferences` y `down` reversible

## 2. Backend — sesión enriquecida

- [x] 2.1 Extender `loadSessionMetaForUser` en `userSessionMetaService.js`: SELECT `avatar_gcs_path`, `contact_email`, `widget_preferences`; retornar `avatarGcsPath`, `contactEmail`, `widgetPreferences`
- [x] 2.2 Extender `buildEnrichedSessionSuccessBody` en `sessionResponses.js` para incluir `contact_email`, `widget_preferences` y `avatar_url` cuando existan
- [x] 2.3 Actualizar `enrichedSessionPayload` en `app.js`: pasar nuevos campos de sessionMeta; generar `avatar_url` con `gcsService.getSignedUrl({ gcsPath, expiresInMinutes: 1440 })` si hay `avatarGcsPath`
- [x] 2.4 Ampliar tests en `sessionResponses.test.js` y `meSessionApi.test.js` para campos de perfil extras

## 3. Backend — endpoints Mi Perfil

- [x] 3.1 Instalar `multer` en backend (`npm install multer`)
- [x] 3.2 Extender `createMeController` con `putProfile` y `postAvatar`; inyectar `gcsService`, `db` y factory de multer
- [x] 3.3 Implementar `putProfile`: validar email y `widget_preferences`; UPDATE `user_profile` por `user_id`; retornar `{ ok: true }`
- [x] 3.4 Implementar `postAvatar`: multer memoryStorage solo en ruta; validar MIME y 2MB; path `avatars/{userProfileId}/{uuid}.{ext}`; delete previo GCS; upload; UPDATE; retornar `{ ok: true, avatar_url }`
- [x] 3.5 Registrar rutas en `app.js`: `PUT /api/me/profile`, `POST /api/me/avatar` (multer middleware en avatar); pasar `gcsService` al controller
- [x] 3.6 Crear `backend/test/meProfileApi.test.js` con casos: auth 401, validación email, validación widget_preferences, upload exitoso, tipo/tamaño inválido

## 4. Frontend — Redux y API

- [x] 4.1 Crear `frontend/src/api/meApi.js` con `updateMyProfile` y `uploadMyAvatar`
- [x] 4.2 Extender `authSlice.js`: state `avatarUrl`, `contactEmail`, `widgetPreferences`; hidratar en `fetchEnrichedSessionThunk`; action `updateProfileData`; selectores `selectAvatarUrl`, `selectContactEmail`, `selectWidgetPreferences`; limpiar en sign-out

## 5. Frontend — Mi Perfil

- [x] 5.1 Reescribir `MyProfilePage.jsx` con sección Avatar (80×80, preview, upload con spinner/errores)
- [x] 5.2 Sección datos personales: nombre y rol read-only; email de contacto editable con Guardar inline
- [x] 5.3 Sección widgets: checkboxes Proveedores/Contratos/Plantillas; debounce 800ms PUT; defaults todos activos si null
- [x] 5.4 Estilos mínimos para avatar circular y layout de secciones (reutilizar `shared-form.css` / clases existentes)

## 6. Frontend — Dashboard

- [x] 6.1 Actualizar `DashboardPage.jsx`: leer `selectWidgetPreferences`; combinar preferencias con CASL según design (`prefs.suppliers !== false && ability.can(...)`)

## 7. Verificación

- [x] 7.1 Ejecutar tests backend (`meProfileApi`, `sessionResponses`, `meSessionApi`)
- [ ] 7.2 Verificación manual: subir avatar, guardar email contacto, togglear widgets, confirmar Dashboard respeta preferencias y CASL
