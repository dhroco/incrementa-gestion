## Context

Incrementa-gestion usa hoy Supabase Auth (JWT, JWKS, usuarios en `auth.users`). La migración a GCP PostgreSQL y un IdP propio requiere un emisor OIDC local idéntico para todos los desarrolladores antes de modificar `backend/config.js`, `frontend/config.js`, `authSlice` o middleware JWT. Este cambio entrega solo la capa Docker + realm exportado; backend y frontend en puertos 3000 y 5173 no se tocan.

## Goals / Non-Goals

**Goals:**

- Keycloak 26 en `docker-compose.yml` (raíz), puerto **8080**, modo desarrollo (`start-dev`), sin TLS.
- Realm `incrementa` importado automáticamente desde `infra/keycloak/realm-incrementa.json` al primer arranque.
- Cliente OIDC `incrementa-backend`: confidential, Direct Access Grants (ROPC), secret documentado en `infra/keycloak/.env.example`.
- Tres usuarios de prueba con contraseñas fijas y roles de realm alineados a perfiles de negocio (ver tabla abajo).
- Volumen Docker nombrado `keycloak_data` para persistir H2/DB interna de Keycloak entre reinicios.
- README en `infra/keycloak/` con comandos, admin console, discovery URL y placeholder para UUIDs `sub`.
- Verificación: `GET` a discovery URL devuelve JSON con `jwks_uri`.

**Non-Goals:**

- Modificar `.js`, `.jsx`, `config.js` de backend/frontend ni archivos existentes del repo.
- Integrar login de la app con Keycloak (cambio posterior).
- Keycloak en producción, TLS, SMTP, temas custom o federación externa.
- Alinear seeds Knex con UUIDs de Keycloak (solo documentar tras primer boot).

## Decisions

### 1. Imagen y comando de arranque

- **Elección**: `quay.io/keycloak/keycloak:26` con `command: start-dev --import-realm`.
- **Rationale**: `start-dev` cumple restricción de no modo producción; `--import-realm` importa JSON desde `/opt/keycloak/data/import/` (montaje read-only del repo).
- **Alternativa descartada**: `start` + `KC_FEATURES` de producción — innecesario para local y más lento de configurar.

### 2. Ubicación de archivos

| Artefacto | Ruta |
|-----------|------|
| Compose | `docker-compose.yml` (raíz) |
| Realm export | `infra/keycloak/realm-incrementa.json` |
| Variables ejemplo | `infra/keycloak/.env.example` |
| Documentación | `infra/keycloak/README.md` |

No se altera `infra/cloudformation/` ni scripts AWS existentes.

### 3. Import del realm

- Montar `./infra/keycloak/import` → `/opt/keycloak/data/import` con el JSON nombrado para que Keycloak lo detecte (p. ej. `incrementa-realm.json`).
- Variable `KC_HEALTH_ENABLED=true` opcional para healthcheck en compose.
- Admin de Keycloak vía env: `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` (valores de desarrollo documentados en README, no secretos de prod).

### 4. Cliente `incrementa-backend`

| Atributo | Valor |
|----------|--------|
| Client ID | `incrementa-backend` |
| Access type | confidential (`clientAuthenticatorType`: client-secret) |
| Direct Access Grants | enabled (`directAccessGrantsEnabled`: true) |
| Standard flow | puede quedar enabled para pruebas futuras; ROPC es el requisito crítico |
| Secret | generado en export o fijo de dev documentado en `.env.example` como `KEYCLOAK_CLIENT_SECRET` |

### 5. Usuarios y roles de realm

Roles de realm (nombres solicitados para claims futuros):

| Usuario | Contraseña | Rol realm |
|---------|------------|-----------|
| `admin@incrementa.la` | `Admin1234!` | `ADMIN_GLOBAL` |
| `contador@incrementa.la` | `Contador1234!` | `CONTADOR` |
| `empresa@incrementa.la` | `Empresa1234!` | `USUARIO_EMPRESA_ADMINISTRADOR` |

**Nota de alineación**: En la base de datos de la app el perfil de plataforma se llama `ADMINISTRADOR_PLATAFORMA`, no `ADMIN_GLOBAL`. El rol Keycloak `ADMIN_GLOBAL` es el nombre acordado para este entorno local; un cambio posterior de integración deberá mapear rol → `profile.code` en BD. Los otros dos códigos coinciden con `profile.code` existentes.

Los UUID (`sub`) **no** se fijan en el JSON export (Keycloak los genera). Tras el primer `docker compose up`, el README incluirá una sección **"UUIDs de usuarios de prueba"** con instrucciones para obtenerlos (Admin Console o Admin REST API) y espacio para pegar los tres valores.

### 6. Red y puertos

- Publicar solo `8080:8080` en el servicio `keycloak`.
- No definir servicios que mapeen 3000 ni 5173.
- Red bridge por defecto de Compose; sin dependencia de otros contenedores del proyecto.

### 7. Persistencia

- Volumen nombrado `keycloak_data` en `/opt/keycloak/data` (datos de instancia).
- El import de realm corre en arranque; si el realm ya existe en el volumen, Keycloak no sobrescribe — documentar `docker compose down -v` para reset limpio.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| ROPC desaconsejado en OIDC moderno | Solo desarrollo local; documentar que prod usará flujos más seguros más adelante. |
| UUIDs distintos a Supabase rompen seeds si se integran antes de tiempo | No tocar seeds en este cambio; documentar `sub` en README. |
| Re-import no actualiza realm existente | README explica borrar volumen para reimportar. |
| Contraseñas débiles en repo | Aceptado para dev; `.env.example` sin secretos de prod; advertencia en README. |
| `ADMIN_GLOBAL` vs `ADMINISTRADOR_PLATAFORMA` | Documentado en design y README para el cambio de integración. |

## Migration Plan

1. Añadir archivos nuevos (compose, `infra/keycloak/*`).
2. `docker compose up -d` desde la raíz.
3. Esperar readiness (~30–90 s en primer boot).
4. Verificar: `curl -s http://localhost:8080/realms/incrementa/.well-known/openid-configuration | jq .jwks_uri`
5. Registrar UUIDs de usuarios en README (tarea manual post-primer-boot o script documentado).

**Rollback**: `docker compose down`; eliminar archivos añadidos si se revierte el cambio en git. Sin impacto en app Node.

## Open Questions

- Ninguna bloqueante para infra local. El mapeo `ADMIN_GLOBAL` → `ADMINISTRADOR_PLATAFORMA` en JWT/claims se resolverá en el change de integración backend/frontend.
