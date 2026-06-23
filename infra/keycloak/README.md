# Keycloak local (desarrollo)

Servidor OIDC local que reemplaza **temporalmente** Supabase Auth. Keycloak corre como **aplicación Java standalone** en Windows (no Docker).

## Requisitos

- JDK 21 (p. ej. Microsoft OpenJDK en `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`)
- Keycloak 26 instalado en `C:\Tools\keycloak-26.2.5`
- Puerto **8080** libre en el host (no usa 3000 ni 5173)

## Inicio rápido (Windows / PowerShell)

1. Copiar el realm de import al directorio de datos de Keycloak (solo la primera vez o tras reset):

   ```powershell
   New-Item -ItemType Directory -Force -Path "C:\Tools\keycloak-26.2.5\data\import"
   Copy-Item -Force ".\infra\keycloak\import\incrementa-realm.json" "C:\Tools\keycloak-26.2.5\data\import\"
   ```

2. Desde la raíz del repositorio, arrancar Keycloak:

   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
   $env:KEYCLOAK_ADMIN = "admin"
   $env:KEYCLOAK_ADMIN_PASSWORD = "admin"
   & "C:\Tools\keycloak-26.2.5\bin\kc.bat" start-dev --import-realm
   ```

   El realm **`incrementa`** se importa al arrancar si aún no existe en la base de datos interna de Keycloak.

3. Contraseñas de usuarios de prueba: configurarlas en **Admin Console** (Users → Credentials) o vía Admin REST API. No van en `import/incrementa-realm.json`.

## URLs

| Recurso | URL |
|---------|-----|
| Admin Console | http://localhost:8080/admin |
| OIDC Discovery | http://localhost:8080/realms/incrementa/.well-known/openid-configuration |
| JWKS | (campo `jwks_uri` del documento de discovery) |

## Credenciales (solo desarrollo local)

Valores por defecto en `infra/keycloak/.env.example`:

| Variable | Uso |
|----------|-----|
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | Admin de Keycloak (realm `master`) |
| `KEYCLOAK_CLIENT_SECRET` | Secret del cliente `incrementa-backend` |

### Admin Console

- Usuario: `admin` (o el valor de `KEYCLOAK_ADMIN`)
- Contraseña: `admin` (o `KEYCLOAK_ADMIN_PASSWORD`)

### Cliente OIDC `incrementa-backend`

- Tipo: **confidential**
- **Direct Access Grants** habilitado (ROPC para el formulario de login propio en cambios futuros)
- Client secret: `dev-incrementa-backend-secret` (variable `KEYCLOAK_CLIENT_SECRET`)

### Usuarios de prueba (realm `incrementa`)

| Email | Rol realm |
|-------|-----------|
| `admin@incrementa.la` | `ADMIN_GLOBAL` |
| `contador@incrementa.la` | `CONTADOR` |
| `empresa@incrementa.la` | `USUARIO_EMPRESA_ADMINISTRADOR` |

**ROPC** (`grant_type=password`) es solo para desarrollo local; no usar en producción.

## Backend local

En `backend/SET_VARS_AMBIENTE_LOCAL.cmd`:

```
OIDC_ISSUER_URL=http://localhost:8080/realms/incrementa
OIDC_AUDIENCE=incrementa-backend
```

## Mapeo de roles (integración futura)

| Rol Keycloak | `profile.code` en BD (app) |
|--------------|----------------------------|
| `ADMIN_GLOBAL` | `ADMINISTRADOR_PLATAFORMA` |
| `CONTADOR` | `CONTADOR` |
| `USUARIO_EMPRESA_ADMINISTRADOR` | `USUARIO_EMPRESA_ADMINISTRADOR` |

## UUIDs de usuarios de prueba (`sub`)

Keycloak genera UUID distintos a Supabase. Obtén los `sub` con:

```bash
# Git Bash / WSL / Linux (Keycloak en localhost:8080)
sh infra/keycloak/scripts/print-test-user-ids.sh
```

O en Admin Console: realm **incrementa** → Users → abrir usuario → copiar **ID**.

Usa estos valores al alinear seeds de BD en cambios posteriores.

## Verificación

Discovery (debe devolver JSON con `jwks_uri`):

```powershell
Invoke-RestMethod "http://localhost:8080/realms/incrementa/.well-known/openid-configuration"
```

Token ROPC (opcional):

```powershell
$body = @{
  grant_type    = "password"
  client_id     = "incrementa-backend"
  client_secret = "dev-incrementa-backend-secret"
  username      = "admin@incrementa.la"
  password      = "Admin1234!"
}
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8080/realms/incrementa/protocol/openid-connect/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body $body
```

## Estructura

```
infra/keycloak/
  import/incrementa-realm.json   # realm, roles, cliente, usuarios (sin contraseñas)
  scripts/print-test-user-ids.sh
  .env.example
  README.md
```
