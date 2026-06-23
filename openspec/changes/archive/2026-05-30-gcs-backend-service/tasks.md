## 1. Dependencia

- [x] 1.1 En `backend/`, ejecutar `npm install @google-cloud/storage` y verificar `package.json` / `package-lock.json`

## 2. Configuración

- [x] 2.1 En `backend/config.js`, agregar `GCS_BUCKET` y `GCS_KEY_FILE` después de `KEYCLOAK_REALM` en `local`, `dev` y `prod`

## 3. Variables locales

- [x] 3.1 En `backend/SET_VARS_AMBIENTE_LOCAL.cmd`, agregar bloque GCS después de `KEYCLOAK_REALM` (`GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`)
- [x] 3.2 Agregar líneas `echo` de diagnóstico para `GCS_BUCKET` y `GOOGLE_APPLICATION_CREDENTIALS` (credencial como `[set]`, sin ruta)
- [x] 3.3 Propagar `GCS_BUCKET` y `GOOGLE_APPLICATION_CREDENTIALS` en el bloque `endlocal & (...)`

## 4. Servicio GCS

- [x] 4.1 Crear `backend/services/gcsService.js` con `createGcsService`, `uploadBuffer`, `downloadBuffer`, `deleteFile` y export `gcsService` según especificación

## 5. Verificación

- [x] 5.1 Confirmar que `node -e "require('./services/gcsService')"` carga sin error desde `backend/` (con variables locales cargadas o credenciales presentes)
