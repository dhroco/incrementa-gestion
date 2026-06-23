## Context

El backend completó la migración de autenticación a Keycloak/OIDC (`requireOidcAuth`, `oidcAuthService`, endpoints `/api/auth/*`). El frontend ya no importa Supabase (Change 5). Permanecen vestigios de configuración y dependencias:

| Artefacto | Estado actual |
|-----------|---------------|
| `backend/lib/supabaseAdminClient.js` | Sin importadores (grep confirmado) |
| `@supabase/supabase-js` | En `package.json` / lockfile |
| `config.js` | `SUPABASE_*` en `local`, `dev`, `prod`; `dev` con defaults Supabase y secretos hardcodeados |
| `SET_VARS_AMBIENTE_LOCAL.cmd` | Variables Supabase + ecos de verificación |
| `middleware/requireSupabaseAuth.js` | Código muerto (no montado en rutas) — **eliminar** |

La base de datos operativa es PostgreSQL en GCP (`35.199.66.217`). El script local ya usa esa URL en `DATABASE_URL`.

## Goals / Non-Goals

**Goals:**

- Eliminar dependencia npm `@supabase/supabase-js`, el cliente admin huérfano y el middleware `requireSupabaseAuth.js`.
- Quitar todas las claves `SUPABASE_*` de `backend/config.js` en los tres ambientes.
- Alinear el default de `DATABASE_URL` en `local` con GCP Postgres.
- Limpiar `SET_VARS_AMBIENTE_LOCAL.cmd` de variables y ecos Supabase.
- Verificar que el backend arranca y `POST /api/auth/login` sigue operativo.

**Non-Goals:**

- Cambios en frontend, controllers o servicios.
- Editar comentarios históricos en migraciones/seeds que mencionen Supabase (no son código ejecutable).
- Nuevos endpoints, migraciones de BD o cambios de comportamiento auth.

## Decisions

### 1. Alcance de archivos tocados

**Decisión:** Cliente admin, middleware `requireSupabaseAuth.js`, dependencia npm, `config.js` y `SET_VARS_AMBIENTE_LOCAL.cmd`. Sin tocar controllers ni servicios.

**Rationale:** Todo es código/config huérfano o legacy; ninguna ruta importa `requireSupabaseAuth` (grep confirmado).

**Alternativa descartada:** Conservar el middleware “por si acaso” — rechazada; OIDC (`requireOidcAuth`) es el único path activo.

### 2. Default `DATABASE_URL` en `local`

**Decisión:** Reemplazar el default Supabase pooler por:

`postgresql://postgres:Incrementa2026!@35.199.66.217:5432/incrementa`

**Rationale:** Coherencia con GCP y con `SET_VARS_AMBIENTE_LOCAL.cmd` ya actualizado.

**Alternativa:** Mantener `postgresql://localhost:5432/...` — descartada; el equipo ya opera contra GCP en local.

### 3. Ambientes `dev` y `prod`

**Decisión:** Eliminar claves `SUPABASE_*` sin reemplazo; `DATABASE_URL` en `dev`/`prod` sigue viniendo de variables de entorno en despliegue.

**Rationale:** OIDC y Keycloak ya cubren auth; no hay código que lea `config.SUPABASE_*` tras eliminar el admin client.

### 4. Desinstalación de paquete

**Decisión:** Editar `package.json` y ejecutar `npm uninstall @supabase/supabase-js` en `backend/` para regenerar lockfile.

**Rationale:** Garantiza eliminación de transitivas en `package-lock.json`.

### 5. Criterio grep de verificación

**Decisión:** Grep sobre `backend/` excluyendo `node_modules`, en `*.js`, `*.json`, `*.cmd`; aceptar coincidencias solo en comentarios de migraciones/seeds y en `package-lock.json` durante refresh del lockfile.

**Rationale:** Comentarios históricos no son ejecutables; el middleware eliminado ya no generará matches en `middleware/`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Despliegue `dev` aún define `SUPABASE_*` en el host | Variables ignoradas tras cleanup; documentar en checklist de infra que pueden eliminarse |
| Grep encuentra "supabase" en comentarios de migraciones/seeds o `knexfile.js` | Esperado y aceptado; no bloquea arranque ni runtime |
| Default `DATABASE_URL` con credencial en repo | Ya existía patrón similar en `dev`; preferir `SET_VARS_AMBIENTE_LOCAL.cmd` (gitignored) en desarrollo |
| `npm uninstall` falla por red | Reintentar; verificar `package-lock.json` manualmente si hace falta |

## Migration Plan

1. Eliminar `supabaseAdminClient.js` y `middleware/requireSupabaseAuth.js`.
2. Actualizar `config.js` (quitar `SUPABASE_*`, nuevo default `DATABASE_URL` en `local`).
3. Actualizar `SET_VARS_AMBIENTE_LOCAL.cmd`.
4. `npm uninstall @supabase/supabase-js` en `backend/`.
5. Grep de verificación.
6. `node index.js` — confirmar listen.
7. Smoke: `POST /api/auth/login` con credenciales Keycloak local.

**Rollback:** Revertir commit; reinstalar paquete y restaurar variables si algún entorno legacy aún las requiere (no esperado).

## Open Questions

- Ninguna bloqueante.
