## Context

- **Estado actual:** `generated_document` guarda PDF en `BYTEA`, referencia `standard_template_id`, `supplier_id`, `company_id` y opcionalmente `pdf_render_engine`. El Document Builder genera y descarga vía `documentBuilderService` leyendo `file_data` en PostgreSQL.
- **Infraestructura lista:** `gcsService` (`uploadBuffer`, `downloadBuffer`) y variables `GCS_BUCKET` / `GCS_KEY_FILE` ya definidas (`gcs-backend-service`).
- **Colisión de nombres:** Existe una tabla legacy `document` (modelo GFA: `template_id`, `company_id`, `document_type_id`, sin datos útiles tras retiro de empleados). El nuevo diseño reutiliza el nombre `document` con esquema distinto orientado a contratos en GCS.
- **Identidad:** `req.auth.userId` es el UUID de Keycloak; columnas `created_by` / `uploaded_by` apuntan a `user_profile.id`.

## Goals / Non-Goals

**Goals:**

- Crear `draft_document` y persistir borradores PDF en GCS con metadatos relacionales.
- Crear tabla `document` (registro de contratos generados/subidos) para flujos posteriores.
- Eliminar `generated_document`.
- Sembrar perfil técnico `MCP_SERVICE` para integraciones.
- Actualizar `generateAndPersist` y `getGeneratedDocumentForDownload` para GCS + `draft_document`.
- Inyectar dependencias en `app.js`.

**Non-Goals:**

- Promover `draft_document` → `document` (firma, archivo, vigencia).
- Migrar bytes históricos de `generated_document` a GCS.
- Cambios de UI del Document Builder (p. ej. quitar `pdfRenderEngine` en pantalla).
- Endpoints nuevos fuera del comportamiento actual de generate/download.

## Decisions

### 1. Numeración y orden de migraciones

Archivos sugeridos (timestamp tras `202605290015`):

| # | Archivo | Acción |
|---|---------|--------|
| 016 | `202605300016_create_draft_document.js` | `CREATE draft_document` |
| 017 | `202605300017_create_document_table.js` | `DROP` legacy `document` si existe → `CREATE document` (nuevo esquema) |
| 018 | `202605300018_drop_generated_document.js` | `DROP generated_document` (down vacío o no-op) |
| 019 | `202605300019_mcp_service_profile.js` | Inserts MCP + down inverso |

**Rationale:** `draft_document` antes de `document` porque `document.draft_document_id` referencia borradores. `DROP generated_document` después de que el código deje de usarla (misma release). Legacy `document` debe caer en 017 antes del `CREATE`.

**Alternativa descartada:** Renombrar legacy a `document_legacy` — añade deuda; la tabla está vacía y sin consumidores activos.

### 2. Ruta GCS para borradores generados

```
contratos/{companyId}/{supplierId}/{templateCode}/{year}/{month}/{docId}_{fileName}
```

- `templateCode` desde `t.code` en `getTemplateRow` (añadir al SELECT).
- `year` / `month` desde `created_at` en zona `America/Santiago` (o UTC del servidor si no hay helper; documentar en implementación).
- `docId` = `crypto.randomUUID()` generado **antes** del upload; mismo id como PK de `draft_document`.
- `fileName` = nombre ya sanitizado existente (`{templateName}_{rutPart}.pdf`).

**Alternativa descartada:** Prefijo `drafts/` separado — el brief fija `contratos/`.

### 3. Flujo transaccional en `generateAndPersist`

1. Validaciones existentes (empresa, plantilla, proveedor, placeholders).
2. `createdBy = await getUserProfileIdByUserId(userId)` — si `null`, `{ ok: false, status: 404, ... }`.
3. Generar PDF en memoria (sin cambio de motor).
4. `docId = randomUUID()`, construir `gcsPath`, `gcsService.uploadBuffer`.
5. En transacción Knex: `INSERT draft_document` con `template_id`, `supplier_id`, `company_id`, `gcs_path`, `file_name`, `status: 'draft'`, `created_by`, `created_at` (default).
6. Retornar `{ id, file_name, gcs_path, status }` en `data.documents[0]`.

**Orden upload vs insert:** Subir a GCS antes del INSERT. Si el INSERT falla, queda objeto huérfano — aceptable en POC; mitigación futura: insert primero + upload + update path, o compensación con `deleteFile`.

**Columnas no migradas:** `pdf_render_engine` no va a `draft_document` (solo metadatos de almacenamiento en este cambio).

### 4. Descarga

- `getGeneratedDocumentForDownload`: `SELECT` desde `draft_document` por `id` + validación `company_id`.
- `gcsService.downloadBuffer({ gcsPath: row.gcs_path })`.
- Misma respuesta al controller: `{ file_name, buffer }`.

El endpoint sigue llamándose “downloads” pero apunta a borradores; renombrar ruta queda fuera de alcance.

### 5. Factory del servicio

```javascript
createDocumentBuilderService({
  db,
  supplierService,
  gcsService,
  getUserProfileIdByUserId
})
```

En `app.js`:

```javascript
const { gcsService } = require('./services/gcsService')
// getUserProfileIdByUserId ya importado
createDocumentBuilderService({ db, gcsService, getUserProfileIdByUserId: userProfileIdResolver })
```

### 6. Perfil MCP_SERVICE

- `profile`: `code='MCP_SERVICE'`, `label='Servicio MCP'`.
- `user_profile`: `user_id='00000000-0000-0000-0000-000000000001'`, `email='mcp@incrementa.la'`, `is_active=true`, FK al perfil.
- `role_permissions`: `action='manage'`, `subject='all'`, `inverted=false`, `role_id` = perfil insertado.
- **Down:** borrar `role_permissions` → `user_profile` → `profile` (por `code` / `user_id` fijos).

Idempotencia en `up`: comprobar existencia por `code` / `user_id` antes de insertar (patrón de seeds).

### 7. Tabla `document` (017)

Esquema según brief; `draft_document_id` nullable `ON DELETE SET NULL`. `source` CHECK o validación en app: `'generated' | 'uploaded'`. Sin servicio en este cambio — solo DDL.

FK `template_id` → `template` (no `template_standard`); alineado con `draft_document.template_id`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Objeto GCS huérfano si falla INSERT tras upload | Logs; job de limpieza futuro; documentar en operaciones |
| GCS no configurado en local | Documentar `SET_VARS_AMBIENTE_LOCAL.cmd`; tests mockean `gcsService` |
| Pérdida de PDFs en `generated_document` | Aceptado (POC); comunicar antes de migrar en prod |
| Conflicto tabla `document` legacy | `dropTableIfExists` en 017 antes de crear |
| Frontend espera `pdfRenderEngine` | Cambio API documentado; UI en cambio aparte |
| `user_id` MCP fijo no existe en Keycloak | Solo para autorización CASL en procesos que usen ese perfil; no sustituye JWT real sin configurar IdP |

## Migration Plan

1. Desplegar migraciones 016 → 019 en orden.
2. Desplegar backend con servicio actualizado (misma ventana que 018 o justo después de 016 si no hay tráfico legacy).
3. Verificar generate + download en ambiente con bucket y credenciales.
4. **Rollback:** down 019 → recrear `generated_document` manualmente solo si se revierte código; down 018 no restaura datos; down 017/016 destructivos para nuevo esquema.

## Open Questions

- ¿Definir `expires_at` en borradores al crear (TTL)? Brief lo deja NULL — sin cambio.
- ¿Timezone explícita para segmentos `{year}/{month}` en path? Recomendado: `America/Santiago` vía `Intl` o librería ya usada en el proyecto.
