# Incremento 3 — Perfiles y asignación a usuario

## Requisitos de configuración

El backend necesita conectarse a la base de datos Supabase y validar JWT emitidos por Supabase Auth.

Variables requeridas:

- `ENVIRONMENT`: `local` | `dev` | `prod`
- `DATABASE_URL`: cadena de conexión PostgreSQL (idealmente del proyecto Supabase)
- `SUPABASE_URL`: URL del proyecto Supabase (Project Settings → API → Project URL)
- `SUPABASE_JWT_SECRET`: Legacy JWT secret (si no usas JWKS), en Supabase: Project Settings → API → JWT Settings → Legacy JWT secret

> No usar service role ni secretos del servidor en el frontend. Este documento aplica al backend.

## Ejecutar migraciones y seeds

Desde `backend/`:

```bash
npm run migrate:latest
npm run seed:run
```

Verifica en Supabase:

- Tabla `profile` con `ADMINISTRADOR_PLATAFORMA` y `USUARIO_EMPRESA_ADMINISTRADOR`
- Tabla `user_profile`

## Asignar un usuario Auth a un perfil (manual)

1. Identifica el UUID del usuario en Supabase Auth (tabla `auth.users`, columna `id`).
2. Obtén el `id` del perfil desde `profile` (por `code`).
3. Inserta en `user_profile` (ejemplo SQL):

```sql
insert into public.user_profile (user_id, profile_id)
select
  '<USER_UUID>'::uuid as user_id,
  p.id as profile_id
from public.profile p
where p.code = 'ADMINISTRADOR_PLATAFORMA'
on conflict (user_id) do update set profile_id = excluded.profile_id, updated_at = now();
```

## Endpoint técnico de validación

Con un JWT válido de Supabase (obtenido desde el login en frontend), llama:

```bash
curl -H "Authorization: Bearer <JWT>" http://localhost:3000/api/me/profile
```

Respuestas esperadas:

- `200`: devuelve `{ user: { id }, profile: { code, label } }`
- `401`: token ausente/ inválido
- `404`: usuario autenticado pero sin perfil asignado

