## Why

La migración fuera de Supabase Auth requiere un proveedor OIDC local reproducible antes de tocar backend o frontend. Keycloak en Docker Compose permite que cualquier desarrollador obtenga el mismo emisor JWT, realm y usuarios de prueba sin depender de Supabase, desbloqueando cambios posteriores de integración (ROPC, validación JWKS, alineación de seeds).

## What Changes

- Agregar `docker-compose.yml` en la raíz del proyecto con Keycloak 26 (`quay.io/keycloak/keycloak`), puerto **8080**, volumen nombrado para persistencia y **sin** ocupar los puertos 3000 ni 5173.
- Agregar carpeta `infra/keycloak/` con export JSON del realm **`incrementa`**, import automático al arranque, README operativo y variables de entorno documentadas (admin de Keycloak, client secret de `incrementa-backend`).
- Realm `incrementa` con **Resource Owner Password Credentials** (Direct Access Grants) habilitado para el cliente `incrementa-backend` (confidential) y usuarios de prueba con roles alineados a perfiles de la aplicación.
- Documentar la OIDC Discovery URL (`http://localhost:8080/realms/incrementa/.well-known/openid-configuration`) y los UUID (`sub`) que Keycloak asigne a los usuarios de prueba para cambios futuros de seeds.
- **Sin cambios** en archivos `.js`, `.jsx` ni configuración de backend/frontend; **sin modificar ni eliminar** archivos existentes del repositorio (solo adiciones).

## Capabilities

### New Capabilities

- `keycloak-local-oidc-infra`: Infraestructura Docker Compose de Keycloak 26 para desarrollo local, realm `incrementa` pre-importado, cliente OIDC `incrementa-backend`, ROPC/Direct Access Grants, usuarios y roles de prueba, persistencia, documentación y criterio de verificación vía discovery endpoint.

### Modified Capabilities

- _(Ninguno: no hay `openspec/specs/` previos; este cambio no altera requisitos de aplicación ya publicados.)_

## Impact

- **Nuevos archivos**: `docker-compose.yml`, `infra/keycloak/**` (realm JSON, README, `.env.example` o equivalente documentado).
- **Sin impacto inmediato** en backend, frontend, Knex, seeds ni despliegue GCP; los servicios en 3000/5173 siguen igual.
- **Dependencia de desarrollo**: Docker y Docker Compose en máquinas locales.
- **Cambios futuros** (fuera de este propose): `config.js`, `authSlice`, middleware JWT y seeds que referencien `sub` de Keycloak en lugar de UUIDs de Supabase.

## Consideraciones de seguridad

- Credenciales de usuarios de prueba y client secret son **solo para desarrollo local**; no deben reutilizarse en `dev`/`prod` ni commitearse secretos reales de producción.
- Keycloak arranca en modo desarrollo (`start-dev`), sin TLS; no exponer el puerto 8080 fuera del entorno local del desarrollador.
- Documentar rotación del client secret y del admin de Keycloak si se comparte el entorno entre varios desarrolladores.
- Los UUID de usuario (`sub`) en Keycloak difieren de los de Supabase; no alinear seeds en este cambio, solo documentar los valores asignados tras el primer import.
