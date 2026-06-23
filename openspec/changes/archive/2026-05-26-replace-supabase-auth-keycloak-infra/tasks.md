## 1. Estructura y configuración base

- [x] 1.1 Crear directorio `infra/keycloak/import/` y `infra/keycloak/.env.example` con `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_CLIENT_SECRET` (valores de desarrollo documentados)
- [x] 1.2 Añadir `docker-compose.yml` en la raíz: servicio Keycloak 26, `start-dev --import-realm`, puerto `8080:8080`, volumen nombrado `keycloak_data`, montaje de `./infra/keycloak/import` → `/opt/keycloak/data/import`

## 2. Realm export

- [x] 2.1 Crear `infra/keycloak/import/incrementa-realm.json` con realm `incrementa`, roles `ADMIN_GLOBAL`, `CONTADOR`, `USUARIO_EMPRESA_ADMINISTRADOR`
- [x] 2.2 Configurar cliente `incrementa-backend` (confidential, `directAccessGrantsEnabled: true`, client secret coherente con `.env.example`)
- [x] 2.3 Definir usuarios de prueba: `admin@incrementa.la`, `contador@incrementa.la`, `empresa@incrementa.la` con contraseñas y roles indicados en el propose

## 3. Documentación

- [x] 3.1 Escribir `infra/keycloak/README.md`: comandos `docker compose up/down`, Admin Console (`http://localhost:8080`), credenciales admin, discovery URL, client secret, nota ROPC solo dev
- [x] 3.2 Incluir sección **UUIDs de usuarios de prueba** con instrucciones para obtener `sub` (Admin Console o API) y placeholders para los tres usuarios
- [x] 3.3 Documentar mapeo `ADMIN_GLOBAL` (Keycloak) vs `ADMINISTRADOR_PLATAFORMA` (BD app) para cambios posteriores
- [x] 3.4 Documentar reset limpio: `docker compose down -v` cuando se necesite reimportar el realm

## 4. Verificación

- [ ] 4.1 Ejecutar `docker compose up -d` y esperar que Keycloak esté listo
- [ ] 4.2 Verificar `GET http://localhost:8080/realms/incrementa/.well-known/openid-configuration` → JSON 200 con `jwks_uri`
- [ ] 4.3 Obtener y registrar en README los UUID (`sub`) de los tres usuarios de prueba
- [ ] 4.4 (Opcional) Probar token ROPC contra `incrementa-backend` con `admin@incrementa.la` para confirmar Direct Access Grants

## 5. Cierre de alcance

- [x] 5.1 Confirmar que no se modificó ningún archivo `.js`/`.jsx` ni config existente de backend/frontend
- [x] 5.2 Confirmar que compose no publica puertos 3000 ni 5173
