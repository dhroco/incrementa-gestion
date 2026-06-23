## Context

La tabla `supplier_social_network` (migración `202605290003`) almacena redes por proveedor con `network_name` (texto libre), `account_name` y `sort_order`. El servicio `supplierService.js` valida, inserta y mapea esas filas sin catálogo centralizado.

El objetivo es reemplazar `network_name` por una FK a `social_network_catalog`, exponer el catálogo vía API y actualizar validación/lectura en backend. Entorno de desarrollo sin datos productivos: la migración puede truncar `supplier_social_network` antes del cambio estructural.

Restricciones del brief:
- Catálogo gestionado solo vía migraciones (sin CRUD admin).
- Íconos mapeados en frontend por `code` — no persistir en BD.
- `sort_order` en `supplier_social_network` se mantiene para ordenar redes del proveedor.
- Alcance: BD y backend únicamente.

## Goals / Non-Goals

**Goals:**
- Crear tabla `social_network_catalog` con seed de 8 redes en orden fijo.
- Refactorizar `supplier_social_network`: FK `catalog_id`, eliminar `network_name`.
- Actualizar `supplierService` (validación, JOIN, insert, mapeo).
- Exponer `listSocialNetworkCatalog()` y `GET /api/social-networks/catalog`.
- Cubrir con tests migración, servicio y API.

**Non-Goals:**
- UI de formularios de proveedor (selector de red, íconos).
- Cambios en MCP tools (ajuste posterior consumirá catálogo).
- CRUD de administración del catálogo.
- Migración de datos legacy (truncate aceptado en dev).

## Decisions

### 1. Esquema de `social_network_catalog`

**Decisión:** tabla singular `social_network_catalog` con:

| Columna     | Tipo      | Notas                          |
|-------------|-----------|--------------------------------|
| `id`        | UUID PK   | `gen_random_uuid()`            |
| `code`      | text      | UNIQUE NOT NULL, ej. `instagram` |
| `name`      | text      | NOT NULL, ej. `Instagram`      |
| `sort_order`| integer   | NOT NULL, orden de catálogo    |

**Alternativa descartada:** enum PostgreSQL de códigos — menos extensible; nuevas redes requieren migración de todos modos, pero UUID + code permite referencias estables en API.

### 2. Seed inicial (sort_order 1–8)

| sort_order | code               | name                |
|------------|--------------------|---------------------|
| 1          | instagram          | Instagram           |
| 2          | facebook           | Facebook            |
| 3          | linkedin           | LinkedIn            |
| 4          | x                  | X                   |
| 5          | tiktok             | TikTok              |
| 6          | youtube            | YouTube             |
| 7          | whatsapp_business  | WhatsApp Business   |
| 8          | pinterest          | Pinterest           |

Insertar con UUIDs fijos en migración (opcional) o generados — preferir **UUIDs generados en runtime** salvo necesidad de referencias hardcodeadas en seeds; el frontend/MCP usarán `id` obtenido del endpoint de catálogo.

### 3. Orden de operaciones en migración `202605300021_social_network_catalog.js`

Secuencia en `up`:

1. Crear tabla `social_network_catalog`.
2. Insertar 8 registros del catálogo.
3. `DELETE FROM supplier_social_network` (limpieza dev).
4. Agregar columna `catalog_id` UUID nullable temporalmente.
5. Eliminar columna `network_name`.
6. `ALTER COLUMN catalog_id SET NOT NULL`.
7. Agregar FK `catalog_id` → `social_network_catalog(id)` con `ON DELETE RESTRICT` (evita borrar catálogo en uso).

**Rationale:** RESTRICT protege integridad; catálogo solo se modifica vía migraciones controladas.

**Alternativa descartada:** backfill heurístico de `network_name` → `catalog_id` — innecesario en dev sin datos productivos.

### 4. Ubicación de `listSocialNetworkCatalog()`

**Decisión:** añadir en `supplierService.js` junto a la lógica de redes sociales existente. Exportar en el mismo módulo.

**Alternativa descartada:** `socialNetworkCatalogService.js` separado — solo una query simple; YAGNI hasta que crezca el dominio.

### 5. Validación de `catalog_id` en payload

**Decisión:** `validateSocialNetworks` acepta `catalog_id` (UUID) y `account_name` por fila. Opcionalmente `sort_order`. Ignorar filas vacías (sin `catalog_id` ni `account_name`).

Validación async en create/update: cargar IDs válidos del catálogo (`SELECT id FROM social_network_catalog`) y rechazar IDs inexistentes con mensaje en español.

**Alternativa descartada:** validar solo formato UUID — permitiría referencias a IDs no catalogados.

### 6. Queries con JOIN

**Decisión:** refactorizar `loadSocialNetworksBySupplierIds` y `getSupplierById` para JOIN:

```sql
supplier_social_network ssn
JOIN social_network_catalog snc ON snc.id = ssn.catalog_id
```

Orden: `supplier_id`, `ssn.sort_order`, `snc.name` (reemplaza orden por `network_name`).

`mapSocialNetworkRow` retorna:

```javascript
{
  id,           // supplier_social_network.id
  catalog_id,
  code,         // de social_network_catalog
  name,         // de social_network_catalog
  account_name,
  sort_order
}
```

### 7. Endpoint de catálogo

**Decisión:** `GET /api/social-networks/catalog` en `app.js` con `authorize('read', 'Supplier')`. Handler en `supplierController.getSocialNetworkCatalog` delegando a `listSocialNetworkCatalog()`.

Respuesta:

```json
{
  "items": [
    { "id": "...", "code": "instagram", "name": "Instagram", "sort_order": 1 }
  ]
}
```

**Alternativa descartada:** endpoint público sin auth — el brief indica OIDC global + permiso read Supplier, coherente con módulo proveedores.

### 8. Breaking change en API de proveedor

Create/update: payload `social_networks: [{ catalog_id, account_name, sort_order? }]`.

List/detail: cada red incluye `catalog_id`, `code`, `name`, `account_name`, `sort_order`, `id`. Campo `network_name` eliminado.

## Risks / Trade-offs

- **[Riesgo] Breaking change para frontend/MCP no actualizados** → Mitigación: alcance explícito backend-only; ajustes frontend/MCP en cambios separados documentados.
- **[Riesgo] Pérdida de redes sociales existentes en dev al truncar** → Mitigación: aceptado; entorno sin datos productivos.
- **[Riesgo] Validación async de catalog_id añade query extra en create/update** → Mitigación: catálogo pequeño (8 filas); cache en memoria opcional si perfil lo requiere — no necesario inicialmente.
- **[Trade-off] Sin CRUD admin del catálogo** → Aceptado; nuevas redes requieren migración — comportamiento deseado.

## Migration Plan

1. Desplegar migración `202605300021_social_network_catalog.js` vía `knex migrate:latest`.
2. Desplegar backend con `supplierService`, controlador y ruta actualizados.
3. Verificar `GET /api/social-networks/catalog` retorna 8 items ordenados.
4. Verificar create/update proveedor con `catalog_id` válido/inválido.
5. Verificar list/detail incluyen `code` y `name` en redes sociales.

**Rollback (`down`):** eliminar FK y `catalog_id`, restaurar `network_name`, eliminar tabla catálogo. No restaura filas truncadas de `supplier_social_network`.

## Open Questions

- Ninguna bloqueante: el brief fija esquema, seed, endpoint y alcance. Confirmar en implementación el número exacto de migración si `202605300021` ya existe en la rama.
