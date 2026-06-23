## Context

La pantalla `MyProfilePage.jsx` actual muestra nombre, correo de login (Keycloak) y rol en campos read-only. No hay persistencia de avatar ni preferencias de usuario en `user_profile`. El Dashboard (`DashboardPage.jsx`) muestra widgets según CASL únicamente (`read Supplier`, `use DocumentBuilder`, `read Template`).

El backend ya expone `GET /api/me/session` con perfil, permisos CASL y meta de sesión; `gcsService` está instanciado en `app.js` con `uploadBuffer`, `deleteFile` (ignoreNotFound) y `getSignedUrl`. `meController.js` maneja cambio de contraseña vía Keycloak Admin. `userSessionMetaService.loadSessionMetaForUser` consulta `user_profile` por `user_id` (sub de Keycloak).

## Goals / Non-Goals

**Goals:**

- Persistir avatar (`avatar_gcs_path`), email de contacto (`contact_email`) y preferencias de widgets (`widget_preferences` JSONB) en `user_profile`.
- Exponer esos datos en la sesión enriquecida (`avatar_url` firmada 24h server-side).
- Endpoints `PUT /api/me/profile` y `POST /api/me/avatar` para el usuario autenticado.
- UI operativa en Mi Perfil: avatar, email de contacto editable, checkboxes de widgets con debounce.
- Dashboard respeta preferencias además de CASL (default: todos activos si null).

**Non-Goals:**

- Avatar en el header de la app.
- Modificar email de login en Keycloak.
- Permisos MCP adicionales.
- Migración/backfill de avatares existentes.

## Decisions

### 1. Columnas en `user_profile` (migración `202606020001`)

**Decisión:** `avatar_gcs_path TEXT NULL`, `contact_email TEXT NULL`, `widget_preferences JSONB NULL`.

**Rationale:** Datos personales del usuario interno; JSONB flexible para `{ suppliers, contracts, templates }` booleanos.

**Alternativa descartada:** Tabla `user_preferences` separada — innecesaria para tres campos.

### 2. Separación contact_email vs email de login

**Decisión:** `contact_email` vive solo en `user_profile`; el email de sesión sigue siendo el claim de Keycloak. En UI, el campo editable es "Email de contacto"; nombre y rol permanecen read-only.

**Rationale:** No tocar Keycloak; permite email operativo distinto al de autenticación.

### 3. Avatar en GCS con path `avatars/{userProfileId}/{uuid}.{ext}`

**Decisión:** Al subir, resolver `user_profile.id` (UUID interno, distinto de `user_id` Keycloak). Subir con `gcsService.uploadBuffer`. Antes de subir, si `avatar_gcs_path` previo existe, llamar `deleteFile` en try/catch. Retornar signed URL 1440 min en respuesta y en sesión.

**Rationale:** Evita colisiones; limpia huérfanos; patrón ya usado en documentos.

**Alternativa descartada:** Base64 en BD — no escala.

### 4. multer solo en `POST /api/me/avatar`

**Decisión:** Instalar `multer`; configurar `memoryStorage()` en middleware de ruta, no global. Límites: 2 MB, MIME `image/jpeg`, `image/png`, `image/webp`.

**Rationale:** Aísla multipart del resto de la API JSON.

### 5. Sesión enriquecida: campos opcionales

**Decisión:** `loadSessionMetaForUser` retorna `avatarGcsPath`, `contactEmail`, `widgetPreferences`. `enrichedSessionPayload` genera `avatar_url` vía `gcsService.getSignedUrl({ gcsPath, expiresInMinutes: 1440 })` solo si hay path. `buildEnrichedSessionSuccessBody` incluye `contact_email`, `widget_preferences`, `avatar_url` cuando existen.

**Rationale:** Frontend obtiene URL lista; no expone paths GCS crudos.

### 6. Endpoints sin CASL adicional

**Decisión:** `PUT /api/me/profile` y `POST /api/me/avatar` requieren solo OIDC auth (`req.auth.userId`). Validación en controller: email formato válido; `widget_preferences` objeto con keys booleanas `suppliers`, `contracts`, `templates`.

**Rationale:** Operaciones sobre datos propios; mismo patrón que cambio de contraseña.

### 7. Redux: campos en auth slice + `updateProfileData`

**Decisión:** Tras `fetchEnrichedSessionThunk`, hidratar `avatarUrl`, `contactEmail`, `widgetPreferences` en state (no dentro de `session` tokens). Action `updateProfileData` actualiza localmente tras PUT/POST sin re-fetch completo.

**Rationale:** Evita re-login; mantiene tokens separados de datos de perfil.

### 8. Dashboard: preferencias AND CASL

**Decisión:**

```javascript
const prefs = widgetPreferences ?? { suppliers: true, contracts: true, templates: true }
const showSuppliers = prefs.suppliers !== false && ability.can('read', 'Supplier')
const showContracts = prefs.contracts !== false && ability.can('use', 'DocumentBuilder')
const showTemplates = prefs.templates !== false && ability.can('read', 'Template')
```

**Rationale:** Preferencias no elevan privilegios; ocultar widget permitido por CASL es opt-out del usuario.

### 9. UI Mi Perfil

**Decisión:** Tres secciones en card blanca (`ph-card` / estilos existentes): (1) avatar circular 80×80 con fallback ícono, input file oculto; (2) nombre/rol read-only + email contacto con botón Guardar inline; (3) checkboxes widgets con debounce 800ms en PUT. Estilos en `shared-form.css` / clases existentes; sin gradientes.

**Rationale:** Coherencia ERP compacta; reutiliza patrones de formulario del sistema.

## Risks / Trade-offs

- **[Signed URL expira en 24h]** → Tras expiración, avatar en Mi Perfil puede fallar hasta re-login o re-upload; aceptable para v1; sesión re-fetch en login renueva URL.
- **[Avatar grande en memoria con multer]** → Límite 2 MB mitiga; memoryStorage adecuado para avatares pequeños.
- **[Preferencias null vs explícitas]** → Default `{ all: true }` en frontend evita migración de datos existentes.
- **[DELETE GCS falla silenciosamente]** → `deleteFile` ya usa `ignoreNotFound`; try/catch adicional en controller por seguridad.

## Migration Plan

1. Ejecutar migración Knex en dev/prod.
2. Desplegar backend (nuevos endpoints + sesión ampliada).
3. Desplegar frontend (Mi Perfil + Dashboard + authSlice).
4. Rollback: revertir deploy; columnas nullable no rompen código anterior; avatares en GCS pueden quedar huérfanos (limpieza manual opcional).

## Open Questions

Ninguna — el brief del usuario es completo para implementación.
