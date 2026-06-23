## Context

- Infra local: `infra/gcp/setup-gcs.ps1` genera `backend/secrets/gcs-service-account.json` y bucket `incrementa-contratos-dev`.
- `backend/config.js` sigue el patrón de variables `process.env` con defaults solo donde aplica (p. ej. Keycloak en local).
- Servicios existentes usan `require('../config')` y exportan factories o singletons.

## Goals / Non-Goals

**Goals:**

- Dependencia oficial `@google-cloud/storage` instalada y bloqueada en lockfile.
- Configuración `GCS_BUCKET` / `GCS_KEY_FILE` homogénea en los tres ambientes.
- Script local documentado para cargar bucket y credenciales antes de `npm run dev`.
- Módulo `gcsService` con operaciones buffer: subir, descargar y borrar por `gcsPath`.

**Non-Goals:**

- Endpoints HTTP, migraciones de BD ni cambios en document builder.
- Tests automatizados contra GCS real (opcional en cambio futuro).
- Abstracción de URLs firmadas, metadatos custom o listado de prefijos.

## Decisions

### Config: `GCS_KEY_FILE` desde `GOOGLE_APPLICATION_CREDENTIALS`

**Decisión:** En cada ambiente:

```javascript
GCS_BUCKET: process.env.GCS_BUCKET || 'incrementa-contratos-dev',
GCS_KEY_FILE: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
```

**Rationale:** Alineado con la convención del SDK de Google; en GCP desplegado `GOOGLE_APPLICATION_CREDENTIALS` puede omitirse y usarse ADC (Application Default Credentials) cuando `keyFilename` es `null`.

**Alternativa:** Variable propia `GCS_KEY_FILE` en `.cmd` — descartada; el usuario pidió `GOOGLE_APPLICATION_CREDENTIALS` en el script local.

### Default bucket `incrementa-contratos-dev`

Mismo nombre que el script de infra para desarrollo; `dev`/`prod` deben setear `GCS_BUCKET` en el entorno de despliegue.

### `gcsService.js` — factory + default export

**Decisión:** `createGcsService({ bucketName, keyFilename })` con defaults desde `config`; `storageOptions = keyFilename ? { keyFilename } : {}`; `resumable: false` en uploads de buffer.

**Rationale:** Permite tests con bucket mock; patrón consistente con inyección opcional.

### `SET_VARS_AMBIENTE_LOCAL.cmd`

- `GCS_BUCKET=incrementa-contratos-dev`
- `GOOGLE_APPLICATION_CREDENTIALS` con ruta absoluta de ejemplo (workspace del repo en la máquina del usuario).
- Echo: mostrar bucket; credenciales como `[set]` sin imprimir la ruta.
- Propagar ambas variables en el bloque `endlocal & (...)` junto a Keycloak/OIDC.

### Instalación

Ejecutar en `backend/`: `npm install @google-cloud/storage` (actualiza `package.json` y `package-lock.json`).

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Ruta absoluta en `.cmd` no portable | Archivo gitignored; cada dev ajusta su path |
| `keyFilename: null` en local sin `.cmd` | Fallo al usar GCS hasta cargar variables |
| Bucket prod distinto sin env var | Documentar `GCS_BUCKET` en despliegue |

## Migration Plan

1. Merge + `npm install` en CI/local.
2. Desarrollador: `call SET_VARS_AMBIENTE_LOCAL.cmd` (o ajustar path de credenciales).
3. Verificar que existe `backend/secrets/gcs-service-account.json` (script infra previo).
4. Consumidores importan `{ gcsService }` en cambios posteriores.

## Open Questions

- ¿Bucket y credenciales distintos para `prod` en Cloud Run / GCE?
- ¿Tests unitarios con mock de `@google-cloud/storage` en un PR siguiente?
