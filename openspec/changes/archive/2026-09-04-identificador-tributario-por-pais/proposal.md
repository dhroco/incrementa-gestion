## Why

Una proveedora mexicana no puede cargarse ni contratar: el sistema trata todo identificador como RUT chileno (cuerpo + DV, módulo 11) y las plantillas mexicanas siguen diciendo «cédula de identidad». Hay que modelar país y tipo de documento en el proveedor ahora, con 22 filas, antes de que el parche chileno-céntrico se vuelva irreversible.

## What Changes

- `supplier.country_code` (ISO-3166-1 alfa-2). Backfill `'CL'` en las 22 filas existentes y luego NOT NULL, sin DEFAULT.
- Catálogo `identity_document_type` (mismo patrón que `social_network_catalog`), sembrado con RUT/CL y RFC/MX.
- En `supplier_persona_natural` y `supplier_empresa`: `document_type_code` + `document_number` (normalizado, formato canónico del tipo). Se migran los RUT actuales y **se eliminan** `rut_body`/`rut_dv` / `rut_empresa_body`/`rut_empresa_dv`. Igual para el representante legal (`rep_document_type_code` + `rep_document_number`).
- Validación por `validator_key` del catálogo: registro `{ rut_cl, pattern }`. Reusa `parseRut`; no lo reescribe.
- `template.country_code` (nullable; `'MX'` en CONTRATO_0016 y CONTRATO_0017, `'CL'` en el resto). Al generar o en dry-run, si el país del proveedor no coincide con el de la plantilla, se rechaza.
- `{{proveedor_rut}}` (y `{{proveedor_rep_legal_rut}}`) resuelven el identificador del país con su formato de despliegue. **No se renombran en este change.**
- Texto de CONTRATO_0016 y CONTRATO_0017: «cédula de identidad» → «RFC», con respaldo en `template_content_backup`.
- Frontend: selector de país; el campo de documento adapta etiqueta, placeholder y validación. Chile sigue usando `RutInput` y `XX.XXX.XXX-X`.
- MCP: las tools de proveedor aceptan país y documento; descripciones al día.
- **BREAKING (API/MCP de alta):** el payload deja de persistir `rut`/`rut_empresa` como cuerpo+DV. Pasa a `country_code` + `document_number` (con alias de entrada `rut` / `rut_empresa` / `rut_rep_legal` para no romper clientes chilenos de un día para otro). Las columnas `rut_*` del proveedor desaparecen; las respuestas ya no las exponen.

**No entra:** identificadores de `company` (Incrementa es siempre chilena); moneda / locale de `precio_numero`; renombrar `proveedor_rut`; traducir el resto de las plantillas mexicanas.

### Deuda explícita — follow-up

`proveedor_rut` queda mal llamado: es el identificador tributario del país, no un RUT. Está incrustado como `variableId` en las 17 plantillas activas; renombrarlo es otra migración de contenido. Follow-up: renombrar a `proveedor_identificador`. Lo mismo para `proveedor_rep_legal_rut` → `proveedor_rep_legal_identificador`.

### Riesgo conocido — no implementar

CONTRATO_0016 está en USD y `precio_numero` se formatea con separador chileno y signo `$`. Es la misma fuga de locale por otro lado. Change propio; aquí no se toca.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `suppliers-admin`: país en `supplier`; catálogo de tipos de documento; identificador genérico en ambos subtipos y en el representante legal; validación por tipo; búsqueda por `document_number`; UI de país/documento; eliminación de `rut_*` del proveedor.
- `document-builder-supplier-context`: `proveedor_rut` / `proveedor_rep_legal_rut` resuelven el identificador formateado del país; coherencia país–plantilla al generar y en dry-run; `template.country_code`; corrección de redacción en CONTRATO_0016 y CONTRATO_0017.
- `backend-mcp-server`: tools de proveedor aceptan `country_code` y documento; descripciones actualizadas (ya no asumen RUT chileno).

## Impact

**Backend:** migraciones knex (país, catálogo, columnas de documento, `template.country_code`, seed de plantillas MX, reemplazo de texto, drop de `rut_*` del proveedor). `supplierService` (`validatePayload`, `supplierJoinQuery`, `normalizeSupplier`, `listSuppliers`, insert/update de hijos). Nuevo registro de validadores (reusa `backend/utils/rut.js` `parseRut`). `documentBuilderVariableContext.js`, `documentBuilderService.js` (`generateAndPersist` y nombre de archivo PDF). Revisar `contractSigningService` (hoy solo lee RUT de `company`, fuera de alcance). MCP: descripciones en `mcpTools.mjs`. Tests de servicio, generación, dry-run, MCP y el invariante I3 (tipo nuevo por dato).

**Frontend:** `SupplierFormSections`, `SupplierUpsertPage`, `SupplierViewPage`, `SupplierListPage`, Document Builder (selector y chip). Chile: `RutInput` / `formatRut` / `formatRutDisplay` sin reescribir. El listado no puede pasar un RFC por `formatRutDisplay`.

**APIs:** mismos endpoints de CRUD. GET aditivo (`country_code`, `document_*`). POST/PUT validan por tipo. Nuevo `GET` de catálogo de tipos de documento (análogo a redes sociales). Generate/dry-run pueden devolver 400 por país incompatible.

**Datos:** 22 proveedores chilenos migrados a `document_number` canónico `cuerpo-DV` sin perder el dígito verificador. Verificar antes y después que el RUT visible es idéntico; si uno cambia, abortar.

## Consideraciones de seguridad

El RFC es más sensible que un RUT: lleva embebidos el nombre y la **fecha de nacimiento** del titular. Junto con correo y domicilio, el perfil de una influencer es considerable (Ley 19.628).

- **No loguear** el identificador ni interpolarlo en mensajes de error. Un 400 dice que el documento no es válido; no repite el valor.
- En REST se expone solo a quien tiene `read Supplier` (`GET /api/suppliers`, `GET /api/suppliers/:id`). Crear/editar siguen exigiendo `create` / `update` Supplier. Sin grants nuevos.
- **Riesgo asumido — MCP HTTP de pre-prod sin autenticación.** El servidor MCP remoto (`mcp-http.mjs`) corre **sin JWT, API key ni OIDC** (spec vigente: «Unauthenticated MCP request accepted»). Este change vuelve a ampliar lo que ese endpoint abierto expone: ahora RFC (dato de nacimiento) además de RUT, correo y domicilio. **No se resuelve aquí** — autenticar el MCP es otro change — pero queda como argumento acumulado para priorizar esa autenticación **antes de producción**. En `ENVIRONMENT=prod` el proceso MCP HTTP ya se niega a arrancar; el hueco está en pre-prod (`dev`) y en stdio local.

**Validación (front y back, es-CL):**

| Campo | Alta | Edición |
| --- | --- | --- |
| `country_code` | Obligatorio; ISO-3166-1 alfa-2 presente en el catálogo | Si viene, mismas reglas; omitido no se toca |
| `document_number` (o alias `rut` / `rut_empresa`) | Obligatorio; validador del tipo del país; se guarda normalizado | Si viene, se revalida; vacío → error (sigue siendo obligatorio) |
| `rep_document_number` (o alias `rut_rep_legal`) | Opcional; si viene, validador del tipo como persona natural | Igual |

Errores en español, sin el valor rechazado, vía `sendError` / `{ ok: false, message }` del servicio. REST y MCP por el mismo `supplierService` (I4).
