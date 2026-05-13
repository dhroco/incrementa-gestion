# Validación: autorización en base de datos (fuente única de verdad)

Incremento descrito en `openspec/changes/modelo-autorizacion-bd-fuente-unica-verdad/`. Este documento permite comprobar migraciones, semillas y el endpoint técnico sin depender de un entorno concreto.

## Prerrequisitos

- `DATABASE_URL` apuntando a la base Supabase/PostgreSQL del proyecto (mismo esquema donde existen `profile` y `user_profile`).
- Variables de Supabase para el backend (`SUPABASE_URL` y validación JWT) según `backend/config.js` y `backend/SET_VARS_AMBIENTE_LOCAL.cmd` si aplica.
- Usuarios de prueba en Supabase Auth con filas en `user_profile` asociadas a cada perfil (`ADMINISTRADOR_PLATAFORMA` y `USUARIO_EMPRESA_ADMINISTRADOR`).

## 1. Migraciones

Desde `backend/`:

```bash
npm run migrate:latest
```

Comprobar en Supabase (SQL o editor de tablas) que existen:

- `navigation_node` (columnas incl. `parent_id`, `code`, `route_path`, `sort_order`, `show_in_main_menu`, …).
- `profile_navigation_grant` (FKs a `profile` y `navigation_node`).

## 2. Semillas

```bash
npm run seed:run
```

La semilla `002_navigation_authorization_seed.js` es idempotente respecto a los códigos `NAV_*` definidos allí.

### Comprobación SQL (conteos por perfil)

Número de concesiones por código de perfil (debe coincidir con la política: administrador 8 rutas con link; empresa 6 sin `NAV_USUARIOS` ni `NAV_REPORTES`):

```sql
SELECT p.code, COUNT(*) AS grants
FROM profile_navigation_grant g
JOIN profile p ON p.id = g.profile_id
JOIN navigation_node n ON n.id = g.navigation_node_id
WHERE n.route_path IS NOT NULL
GROUP BY p.code
ORDER BY p.code;
```

Listar rutas concedidas por perfil:

```sql
SELECT p.code AS profile_code, n.code AS nav_code, n.route_path
FROM profile_navigation_grant g
JOIN profile p ON p.id = g.profile_id
JOIN navigation_node n ON n.id = g.navigation_node_id
WHERE n.route_path IS NOT NULL
ORDER BY p.code, n.sort_order;
```

Para `USUARIO_EMPRESA_ADMINISTRADOR` no deben aparecer `NAV_USUARIOS` ni `NAV_REPORTES`. El grupo `NAV_GROUP_ADMINISTRACION` solo debería materializarse en el árbol del API para perfiles que tengan al menos un hijo concedido.

## 3. Endpoint técnico

Con el backend en ejecución (`npm run dev` o equivalente), obtener un JWT de sesión (login en la app o flujo Supabase) y llamar:

```http
GET /api/me/authorization/current
Authorization: Bearer <access_token>
```

Respuesta esperada (forma general):

- `userId`, `email`
- `profile`: `code`, `label`
- `navigation.tree`: árbol ordenado con `children` donde corresponda (p. ej. `Administración` con `Usuarios` y `Reportes` solo para administrador de plataforma).
- `navigation.routes`: lista plana de ítems con `routePath` para comprobar rutas efectivas.

Sin perfil asignado: mismo contrato que `/api/me/session` — `404` con cuerpo `PROFILE_NOT_ASSIGNED` y mensaje en español.

Sin token o token inválido: `401` con mensaje en español.

Repetir con un usuario por cada perfil interno y verificar que las rutas y la presencia del grupo **Administración** cambian según la semilla.

## Checklist de aceptación (resumen)

1. Existen estructuras en BD para definir accesos por perfil (`navigation_node`, `profile_navigation_grant`).
2. La definición oficial de accesos para esta etapa está en BD (semilla alineada con la configuración transitoria del frontend en `navigationConfig.js`).
3. Los perfiles `ADMINISTRADOR_PLATAFORMA` y `USUARIO_EMPRESA_ADMINISTRADOR` tienen concesiones iniciales explícitas.
4. El backend puede consultar accesos efectivos vía servicio y CTE recursivo sobre concesiones y ancestros.
5. Existe `GET /api/me/authorization/current` protegido por JWT que devuelve perfil y navegación permitida.
6. Este incremento no aplica bloqueo 403 por permisos en rutas de negocio; solo lectura de política.

## Nota sobre verificación local

Si `npm run migrate:latest` falla por `ECONNREFUSED`, levantar PostgreSQL local o usar la URL de Supabase; el SQL de migración está en `backend/migrations/202604160001_create_navigation_authorization.js`.
