## Why

Tras aprovisionar el bucket GCS y las credenciales locales (`gcs-local-setup-infra`), el backend aún no puede leer ni escribir objetos en Cloud Storage. Se necesita un cliente reutilizable, configuración por ambiente y variables locales para que el document builder y futuros flujos de contratos persistan PDFs en GCS.

## What Changes

- Instalar `@google-cloud/storage` en `backend/package.json`.
- Agregar `GCS_BUCKET` y `GCS_KEY_FILE` en `backend/config.js` para `local`, `dev` y `prod` (inmediatamente después de `KEYCLOAK_REALM`).
- Actualizar `backend/SET_VARS_AMBIENTE_LOCAL.cmd`: variables `GCS_BUCKET` y `GOOGLE_APPLICATION_CREDENTIALS`, echos de diagnóstico y propagación en `endlocal`.
- Crear `backend/services/gcsService.js` con factory `createGcsService` y singleton `gcsService` (`uploadBuffer`, `downloadBuffer`, `deleteFile`).

## Capabilities

### New Capabilities

- `gcs-backend-service`: Cliente GCS en el backend, configuración multi-ambiente y carga de credenciales en desarrollo local.

### Modified Capabilities

- _(Ninguno.)_

## Impact

- **Dependencia nueva:** `@google-cloud/storage` en backend.
- **Archivos:** `backend/config.js`, `backend/services/gcsService.js`, `backend/package.json` / `package-lock.json`, `backend/SET_VARS_AMBIENTE_LOCAL.cmd` (no versionado, cambio local del desarrollador).
- **Sin endpoints REST nuevos** en este cambio; consumidores (p. ej. document builder) se integrarán después.
- **Entornos `dev`/`prod`:** deben definir `GCS_BUCKET` y credenciales vía `GOOGLE_APPLICATION_CREDENTIALS` o ADC en el runtime GCP.

## Consideraciones de seguridad

- `GCS_KEY_FILE` mapea `GOOGLE_APPLICATION_CREDENTIALS`; la ruta al JSON no debe commitearse (ya cubierto por `backend/secrets/` en `.gitignore`).
- `SET_VARS_AMBIENTE_LOCAL.cmd` contiene ruta absoluta de ejemplo; cada desarrollador ajusta su máquina; el archivo no se versiona.
- Operaciones GCS deben invocarse solo desde código backend autenticado en capas superiores (fuera de alcance de este cambio, pero el servicio no expone rutas por sí solo).
