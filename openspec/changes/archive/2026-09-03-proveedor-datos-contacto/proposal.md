## Why

Sin email (ni teléfono) en el proveedor no hay a quién enviar el enlace de firma: es el hueco 1 de `docs/firma-electronica-arquitectura.html` (cap. 5). Los 22 proveedores actuales no tienen dato porque las columnas no existen. Este change cierra ese hueco **guardando** el contacto; no envía nada.

## What Changes

- Migración aditiva: `supplier.email` y `supplier.phone` (`text`, nullable). **No** van en los subtipos CTI.
- `supplierService`: validación y persistencia de ambos campos; exposición en listado, detalle y MCP.
- **BREAKING** en el alta: `POST /api/suppliers` y `crear_proveedor` exigen email con formato válido. El PUT y `actualizar_proveedor` no lo exigen (los 22 existentes siguen editables).
- Frontend: campos en alta/edición y detalle; el listado marca quién no tiene correo.
- MCP: las cuatro tools de proveedor aceptan o retornan `email` y `phone`; las descripciones lo documentan.
- Tests de validación, de no-regresión en generar/firmar con proveedor sin email, y ajuste de payloads de creación.

**No entra:** envío de correo, Adobe / Acrobat Sign, E.164, OTP, verificación de casilla, columna NOT NULL, backfill de los 22 (operativo; al cerrar se entrega la lista de los que siguen sin email).

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `suppliers-admin`: columnas de contacto en `supplier`; email obligatorio al crear y opcional al editar; teléfono opcional y laxo; listado identificable de quienes no tienen correo; campos en formulario y detalle.
- `backend-mcp-server`: `crear_proveedor` / `actualizar_proveedor` aceptan `email` y `phone`; `obtener_proveedor` / `listar_proveedores` los retornan; descripciones de tools actualizadas.

## Impact

**Backend:** migración knex sobre `supplier`; `supplierService` (`validatePayload`, `normalizeSupplier`, `supplierJoinQuery`, insert/update de la tabla base — hoy el PUT ignora campos que no sean de subtipo o redes); `mcpTools.mjs` (schema Zod `passthrough` ya deja pasar los campos; hay que actualizar descripciones). `isValidEmail` ya existe en `utils/validation.js`. Mensajes vía `http/responses.js`, en español.

**Frontend:** `SupplierFormSections.jsx`, `SupplierUpsertPage.jsx`, `SupplierViewPage.jsx`, `SupplierListPage.jsx`. Misma validación de formato de correo que el resto del sistema; teléfono no se reescribe.

**APIs:** mismos endpoints. GET/PUT aditivos. POST rechaza alta sin email.

**Datos:** 22 filas existentes quedan con `email`/`phone` NULL. Generar y firmar contratos con ellos **no** debe fallar.

**Desviación explícita de** `docs/firma-electronica-arquitectura.html` **(etapa 0):** ese texto ubica `email` y `phone` en persona natural y empresa. D1 los pone en la tabla base `supplier` (lo común vive en la base desde el refactor CTI).

## Consideraciones de seguridad

Email y teléfono de una influencer son **datos personales** (Ley 19.628). Hasta ahora el sistema guardaba RUT y domicilio; esto agrega contactabilidad directa.

- **No loguear** email ni teléfono: ni `console`, ni mensajes de error interpolados. Un 400 dice que el formato es inválido; no repite el valor.
- En la API REST se exponen solo a quien tiene `read Supplier`, por los canales que ya existen (`GET /api/suppliers`, `GET /api/suppliers/:id`). Crear/editar siguen exigiendo `create` / `update` Supplier. No hay grants nuevos.
- **Riesgo asumido — MCP HTTP de pre-prod sin autenticación.** El servidor MCP remoto (`mcp-http.mjs`) corre hoy **sin JWT, API key ni OIDC** (spec vigente: «Unauthenticated MCP request accepted»). Al agregar `email` y `phone` a `listar_proveedores`, `obtener_proveedor`, `crear_proveedor` y `actualizar_proveedor`, un endpoint abierto pasa a exponer y aceptar datos de contacto de personas reales, no solo nombres y RUT. **Este change amplía la superficie de exposición de datos personales de un endpoint público. No lo resuelve** — autenticar el MCP es otro change — pero queda registrado como riesgo aceptado y como argumento para priorizar esa autenticación **antes de producción**. En `ENVIRONMENT=prod` el proceso MCP HTTP ya se niega a arrancar; el hueco está en pre-prod (`dev`) y en cualquier stdio local.
- Un email mal escrito manda el contrato (cuando exista el envío) a un tercero. La validación de formato en backend (`isValidEmail`) es de **seguridad**, no de comodidad. También corre en MCP porque entra por el mismo `supplierService` (I3).
- Sin índice único sobre email (D3): una agencia puede gestionar varias influencers desde el mismo correo. No se valida duplicado.

**Validación (front y back, es-CL):**

| Campo | Alta (POST / `crear_proveedor`) | Edición (PUT / `actualizar_proveedor`) |
| --- | --- | --- |
| `email` | Obligatorio; trim; minúsculas; `isValidEmail` | Si viene, mismas reglas de formato; vacío → `NULL`; omitido → no se toca |
| `phone` | Opcional; `trimOrNull`; forma laxa | Igual |

Errores en español, sin el valor del campo, vía `sendError` / `{ ok: false, message }` del servicio.
