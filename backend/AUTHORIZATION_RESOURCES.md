# Autorización efectiva — mapeo recurso ↔ grant (etapa inicial)

Este backend usa como fuente de verdad la **autorización efectiva** resuelta desde PostgreSQL (mismo modelo que alimenta `GET /api/me/session`).

## Convención

- Para endpoints de módulos iniciales, cada ruta declara un `navigationCode` (p. ej. `NAV_CONTRATOS`).
- El middleware `requireNavigationGrant({ navigationCode })` permite/deniega según la presencia de ese código en los rows efectivos del perfil del usuario.

## Rutas con enforcement (backend)

| Endpoint | navigationCode requerido | Nota |
|----------|--------------------------|------|
| `GET /api/modules/dashboard` | `NAV_DASHBOARD` | Placeholder inicial |
| `GET /api/modules/contratos` | `NAV_CONTRATOS` | Placeholder inicial |
| `GET /api/modules/proveedores` | `NAV_PROVEEDORES` | Placeholder inicial |
| `GET /api/modules/configuracion` | `NAV_CONFIGURACION` | Placeholder inicial |
| `GET /api/modules/usuarios` | `NAV_USUARIOS` | Perfil empresa no lo tiene |
| `GET /api/modules/reportes` | `NAV_REPORTES` | Perfil empresa no lo tiene |

## Rutas sin enforcement de grants (solo autenticación)

| Endpoint | Motivo |
|----------|--------|
| `GET /api/me/session` | Bootstrap de UI + autorización |
| `GET /api/me/authorization/current` | Alias legacy del bootstrap |
| `GET /api/me/profile` | Endpoint técnico legacy |

