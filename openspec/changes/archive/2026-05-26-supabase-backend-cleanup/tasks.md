## 1. Eliminar código y dependencia Supabase

- [x] 1.1 Confirmar con grep que `supabaseAdminClient` y `requireSupabaseAuth` no tienen importadores en `backend/` (fuera de sus propios archivos)
- [x] 1.2 Eliminar `backend/lib/supabaseAdminClient.js`
- [x] 1.3 Eliminar `backend/middleware/requireSupabaseAuth.js`
- [x] 1.4 Quitar `@supabase/supabase-js` de `backend/package.json`
- [x] 1.5 Ejecutar `npm uninstall @supabase/supabase-js` en `backend/` y verificar actualización de `package-lock.json`

## 2. Limpiar configuración por ambiente

- [x] 2.1 En `backend/config.js`, eliminar `SUPABASE_URL`, `SUPABASE_JWT_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` de `local`, `dev` y `prod`
- [x] 2.2 En `backend/config.js` ambiente `local`, reemplazar default de `DATABASE_URL` por `postgresql://postgres:Incrementa2026!@35.199.66.217:5432/incrementa`
- [x] 2.3 En `backend/config.js` ambiente `dev`, eliminar defaults hardcodeados que apunten a `supabase.com` (mantener `DATABASE_URL` vía env sin default Supabase si aplica)

## 3. Script de variables locales

- [x] 3.1 En `backend/SET_VARS_AMBIENTE_LOCAL.cmd`, eliminar `set "SUPABASE_URL=..."`, `set "SUPABASE_JWT_SECRET=..."` y `set "SUPABASE_SERVICE_ROLE_KEY=..."`
- [x] 3.2 Eliminar ecos de verificación (`if "%SUPABASE_..."`) y propagación en bloques `endlocal` para variables Supabase
- [x] 3.3 Actualizar comentarios del script que mencionen Supabase Postgres/SSL si ya no aplican

## 4. Verificación

- [x] 4.1 Ejecutar grep `supabase` en `backend/` (`*.js`, `*.json`, `*.cmd`), excluyendo `node_modules`; confirmar cero coincidencias en código ejecutable (`config.js`, `package.json`, `lib/`, `middleware/`); comentarios en `migrations/` y `seeds/` pueden quedar
- [x] 4.2 Arrancar backend: `cd backend`, cargar vars (`call SET_VARS_AMBIENTE_LOCAL.cmd`), `node index.js` — sin errores de arranque
- [x] 4.3 Smoke test: `POST /api/auth/login` con credenciales Keycloak local — respuesta 2xx con tokens
