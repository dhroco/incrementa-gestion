## Why

Cuando Claude genera un contrato vía MCP (`generar_contrato`), el PDF queda almacenado en GCS sin URL pública. El usuario no puede abrirlo desde el chat porque no existe un mecanismo para obtener un enlace temporal de acceso. Se necesita una herramienta MCP que genere una URL firmada de corta duración para visualizar el borrador inmediatamente después de la generación o bajo demanda.

## What Changes

- Agregar `getSignedUrl({ gcsPath, expiresInMinutes })` a `backend/services/gcsService.js` usando el SDK `@google-cloud/storage` con la clave privada del service account (sin permisos IAM adicionales).
- Nueva herramienta MCP `obtener_url_contrato` en `backend/mcpTools.mjs`: recibe `documentId` (UUID de `draft_document`), consulta `gcs_path` en BD, firma la URL con vigencia de **60 minutos** y retorna el enlace para abrir en el navegador.
- Pasar `gcsService` como dependencia adicional a `registerMcpTools` desde `backend/mcp.mjs` (las credenciales ya están inyectadas en el proceso MCP).
- Tests unitarios para `getSignedUrl`, la herramienta MCP y casos de error (`documentId` inexistente o sin `gcs_path`).

**Restricciones explícitas:** no modificar `uploadBuffer`, `downloadBuffer` ni `deleteFile` en `gcsService.js`. Solo consultar tabla `draft_document` (documentos firmados en `document` tienen flujo propio). `generar_contrato` ya retorna el `id` del borrador creado — Claude puede pasarlo directamente a `obtener_url_contrato`.

## Capabilities

### New Capabilities

_(ninguna — extensión de capacidades existentes)_

### Modified Capabilities

- `backend-mcp-server`: nueva herramienta `obtener_url_contrato` con descripción orientada a Claude (usar inmediatamente tras `generar_contrato` o cuando el usuario pida ver un contrato ya generado).
- `gcs-backend-service`: nuevo método `getSignedUrl` en el módulo `gcsService` para URLs firmadas temporales.

## Impact

- **Backend**: `backend/services/gcsService.js` (método nuevo), `backend/mcpTools.mjs` (herramienta nueva), `backend/mcp.mjs` (inyección de dependencia), tests en `backend/test/`.
- **Express / frontend**: sin cambios.
- **Base de datos**: sin migraciones; lectura de `draft_document.gcs_path` por `id`.
- **Infra / credenciales**: reutiliza `GOOGLE_APPLICATION_CREDENTIALS` ya configurado para MCP; no requiere IAM adicional (`iam.serviceAccounts.signBlob` no es necesario con firma vía clave privada del JSON).
- **Seguridad**: URLs firmadas expiran a los 60 minutos; solo accesibles quien tenga el enlace durante ese periodo. El actor MCP mantiene permisos amplios — el servidor MCP debe seguir restringido a entornos de confianza.

## Consideraciones de seguridad

- La URL firmada otorga acceso de lectura al PDF durante 60 minutos a cualquier persona con el enlace; no incluir en respuestas información adicional sensible más allá de la URL y metadatos mínimos (`file_name`, `expiresAt`).
- Si `documentId` no existe o el registro no tiene `gcs_path`, retornar error claro en español (`NOT_FOUND` / `GCS_PATH_MISSING`) sin filtrar detalles internos de GCS.
- No exponer esta herramienta para tabla `document` (contratos firmados); el alcance es exclusivamente borradores (`draft_document`).
- Validación de entrada: `documentId` MUST ser UUID válido (schema Zod).
