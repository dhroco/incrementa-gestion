## Context

El servidor MCP (`backend/mcp.mjs`) ya expone `generar_contrato`, que persiste el PDF en GCS y crea un registro en `draft_document` con `gcs_path`. La respuesta incluye el `id` del borrador en `data.documents[0].id`. Sin embargo, los objetos en GCS no son públicos; el usuario en Claude Desktop no puede abrir el PDF sin un enlace firmado.

`gcsService.js` actualmente expone `uploadBuffer`, `downloadBuffer` y `deleteFile`. El proceso MCP ya instancia `gcsService` con credenciales vía `GOOGLE_APPLICATION_CREDENTIALS` (mismo patrón que Express). El SDK `@google-cloud/storage` puede generar URLs firmadas v4 usando la clave privada del service account JSON — no requiere el permiso IAM `iam.serviceAccounts.signBlob`.

Restricciones del cambio:
- No modificar `uploadBuffer`, `downloadBuffer` ni `deleteFile`.
- Solo consultar `draft_document` (no `document`).
- Vigencia fija de 60 minutos para URLs firmadas.
- Sin cambios en Express, frontend ni migraciones.

## Goals / Non-Goals

**Goals:**
- Permitir que Claude entregue al usuario una URL temporal para abrir el PDF de un borrador generado vía MCP.
- Extender `gcsService` con `getSignedUrl({ gcsPath, expiresInMinutes })`.
- Registrar herramienta MCP `obtener_url_contrato` con descripción que indique cuándo usarla (inmediatamente tras `generar_contrato` o bajo demanda).
- Retornar errores claros en español si el `documentId` no existe o carece de `gcs_path`.
- Cubrir con tests unitarios el método GCS, el handler MCP y casos de error.

**Non-Goals:**
- URLs firmadas para documentos firmados (`document` table).
- Endpoint HTTP REST para descarga o signed URLs.
- Configuración de expiración variable desde el cliente MCP (60 min fijos en la herramienta).
- Cambios en `generar_contrato` (ya retorna el id del borrador).
- Bucket policies ni hacer objetos públicos.

## Decisions

### 1. Firma v4 con clave privada del service account

**Decisión:** implementar `getSignedUrl` usando `file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + expiresInMinutes * 60 * 1000 })` sobre `bucket.file(gcsPath)`.

**Rationale:** el Storage client ya carga credenciales desde `GCS_KEY_FILE` / `GOOGLE_APPLICATION_CREDENTIALS`; la firma ocurre localmente con la clave privada del JSON.

**Alternativa descartada:** `iam.serviceAccounts.signBlob` vía API IAM — requiere permiso adicional y no aporta valor si ya hay clave privada.

### 2. Query directa a `draft_document` en el handler MCP

**Decisión:** el handler de `obtener_url_contrato` consulta Knex directamente:

```javascript
const row = await db('draft_document')
  .select('id', 'file_name', 'gcs_path')
  .where({ id: documentId })
  .first()
```

No reutilizar `documentBuilderService.getGeneratedDocumentForDownload` porque ese método exige resolución de `companyId` vía CASL/actor humano y descarga el buffer — fuera de alcance.

**Alternativa descartada:** nuevo método en `documentBuilderService` — añade capa innecesaria para una lectura simple de una fila.

### 3. Parámetro único `documentId` (UUID)

**Decisión:** schema Zod `documentId: z.string().uuid()`. Claude obtiene el id de la respuesta de `generar_contrato` (`data.documents[0].id`) sin pedirlo al usuario.

**Alternativa descartada:** buscar por supplier + template + mes — más frágil y redundante con el id ya disponible.

### 4. Respuesta de éxito enriquecida

**Decisión:** retornar JSON con:

```json
{
  "ok": true,
  "data": {
    "documentId": "...",
    "file_name": "...",
    "signedUrl": "https://storage.googleapis.com/...",
    "expiresInMinutes": 60,
    "expiresAt": "2026-05-30T15:30:00.000Z"
  }
}
```

`expiresAt` en ISO 8601 (UTC) ayuda a Claude a informar al usuario la vigencia.

### 5. Inyección de `gcsService` en `registerMcpTools`

**Decisión:** ampliar la firma de `registerMcpTools(server, deps)` con `gcsService` y pasarlo desde `mcp.mjs` (instancia ya existente).

**Alternativa descartada:** importar `gcsService` dentro de `mcpTools.mjs` — rompe el patrón de inyección usado en tests con mocks.

### 6. Expiración fija 60 minutos en la herramienta

**Decisión:** la herramienta llama `getSignedUrl({ gcsPath, expiresInMinutes: 60 })` sin exponer el parámetro al cliente MCP.

**Rationale:** equilibrio entre contexto conversacional y minimizar ventana de acceso con enlace compartido.

### 7. Códigos de error

| Condición | code | message (es-CL) |
|-----------|------|-----------------|
| UUID no encontrado en `draft_document` | `NOT_FOUND` | Borrador no encontrado. |
| Fila sin `gcs_path` | `GCS_PATH_MISSING` | El borrador no tiene archivo asociado en almacenamiento. |
| Fallo al firmar URL | `SIGNED_URL_FAILED` | No se pudo generar la URL de acceso al PDF. |

## Risks / Trade-offs

- **[Enlace compartible]** Cualquiera con la URL puede leer el PDF durante 60 min → Mitigación: expiración corta; no incluir datos sensibles extra en la respuesta; MCP restringido a entorno de confianza.
- **[Credenciales inválidas]** Si `GOOGLE_APPLICATION_CREDENTIALS` falta o es inválido, `getSignedUrl` fallará → Mitigación: capturar error, retornar `SIGNED_URL_FAILED` sin stack trace; mismo requisito que ya aplica a `generar_contrato`.
- **[Objeto eliminado en GCS]** URL firmada válida pero objeto borrado → Mitigación: fuera de alcance; GCS retornará 404 al abrir; no pre-validar existencia del objeto (evita round-trip extra).
- **[Actor MCP sin scope por empresa]** Query directa no filtra por `company_id` → Mitigación: aceptable en contexto MCP con actor `manage/all`; documentos firmados usan flujo distinto.

## Migration Plan

1. Implementar `getSignedUrl` en `gcsService.js`.
2. Registrar herramienta y pasar dependencia en `mcp.mjs`.
3. Agregar tests; ejecutar `npm test` en backend.
4. Reiniciar Claude Desktop (no cambia config JSON existente).
5. Smoke: `generar_contrato` → `obtener_url_contrato` con id retornado → abrir URL en navegador.

**Rollback:** revertir commits; herramienta nueva no afecta datos ni esquema.

## Open Questions

_(ninguna — alcance acotado y decisiones cerradas)_
