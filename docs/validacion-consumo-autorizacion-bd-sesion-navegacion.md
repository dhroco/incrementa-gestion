# Validación: consumo de autorización (sesión + menú)

Incremento `consumo-autorizacion-bd-sesion-navegacion`: el backend incluye `navigation` (árbol + `routes`) en `GET /api/me/session`; el frontend construye menú, títulos y redirecciones desde ese payload.

## Comprobaciones rápidas

1. Con backend y BD con seeds de navegación, iniciar sesión.
2. En red (DevTools), verificar que `GET /api/me/session` devuelve `profile` y `navigation.tree` / `navigation.routes`.
3. Comprobar que el sidebar coincide con las rutas concedidas en base de datos para el perfil del usuario.
4. Repetir con el otro perfil (`ADMINISTRADOR_PLATAFORMA` vs `USUARIO_EMPRESA_ADMINISTRADOR`) y verificar que el menú difiere según los grants.
5. Confirmar que **no** se aplica 403 por permisos en endpoints de negocio (solo autenticación como antes).
6. Caso sin rutas en la respuesta: pantalla de “sin opciones de menú” con posibilidad de reintentar o salir.

## Manual (tarea 5.2)

La validación cruzada con dos usuarios reales y perfiles asignados en BD debe ejecutarse en el entorno donde existan Supabase Auth y datos sembrados.
