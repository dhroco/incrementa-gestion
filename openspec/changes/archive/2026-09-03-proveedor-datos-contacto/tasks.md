## 1. Migración

- [x] 1.1 Migración knex aditiva sobre `supplier`: `email` text nullable, `phone` text nullable. Sin UNIQUE ni índice único. Sin tocar `supplier_persona_natural` ni `supplier_empresa`. Down: `dropColumn` de ambas.
- [x] 1.2 Aplicar `migrate:latest` contra la BD de dev (proxy local). Confirmar que las 22 filas existentes siguen leyéndose con `email`/`phone` NULL.

## 2. supplierService

- [x] 2.1 `validatePayload`: `email` y `phone` como campos de la tabla base (no van a `PERSONA_FIELDS` / `EMPRESA_FIELDS`). Alta (`partial === false`): email obligatorio, trim, minúsculas, `isValidEmail`. Edición: omitido no se toca; vacío → `NULL`; valor inválido → error. Teléfono: `trimOrNull` + forma laxa (D4). Mensajes en es-CL **sin** interpolar el valor.
- [x] 2.2 `supplierJoinQuery`: agregar `s.email` y `s.phone` al SELECT explícito. `normalizeSupplier`: exponerlos (`null` si faltan).
- [x] 2.3 `createSupplier`: INSERT en `supplier` incluye `email` y `phone`. `updateSupplier`: persistir `baseFields` en el UPDATE de `supplier`; el early-return actual (`!hasChildUpdate && !hasSocialUpdate`) **no** puede tragarse un PUT que solo cambia contacto. `listSuppliers`: el `search` también filtra por `s.email` (ILIKE).
- [x] 2.4 Recorrer consultas a `supplier` fuera de `supplierJoinQuery` (`contractsQueryService`, `contractSigningService`, `documentBuilderService`, listado de documentos). Si alguna hace SELECT explícito de columnas de `s` y debe devolver contacto, incluirlas; si solo pide id/nombre/tipo, no tocar.

## 3. Tests de backend

- [x] 3.1 Tests de `validatePayload` / `createSupplier` / `updateSupplier` (archivo nuevo si hace falta): alta sin email → 400; email inválido → 400 sin eco del valor; alta con `Ana.Gomez@Agencia.CL` persiste minúsculas; dos altas con el mismo email → ambas OK; PUT omitiendo email sobre fila con email NULL → OK y sigue NULL; PUT `{ email: "nuevo@x.cl" }` solo → persiste; teléfono `+52 55 1234 5678` se guarda tal cual; teléfono con letras → 400.
- [x] 3.2 Ajustar payloads de **creación** que queden incompletos al exigir email (`supplierApi.test.js`, `mcpServer.test.js` y cualquier otro que construya un alta real). No relajar la regla: agregar `email` válido o mockear el servicio como ya hace el API test.
- [x] 3.3 No-regresión I1: `documentBuilderService` generate (con y sin dryRun) y `signContract` con un proveedor **sin** email siguen OK. Reusar fixtures actuales que no tienen contacto; no agregar email a esos fixtures.

## 4. MCP

- [x] 4.1 Descripciones de `crear_proveedor`, `actualizar_proveedor`, `obtener_proveedor` y `listar_proveedores`: documentar `email` (obligatorio al crear, opcional al editar) y `phone` (opcional, como se escribe). El schema Zod puede seguir en `passthrough`; la validación es la del servicio.
- [x] 4.2 Tests MCP: descripciones mencionan email/phone; `crear_proveedor` sin email → `ok: false` y mensaje en español; `actualizar_proveedor` sin `email` sobre proveedor legado no falla. No autenticar el MCP HTTP en este change.

## 5. Frontend

- [x] 5.1 `SupplierFormSections`: sección Contacto (Correo + Teléfono, `clause-form-row--two-col`) en Datos básicos para ambos tipos. `emptySupplierForm` / `supplierToForm` / `SUPPLIER_FIELD_ERROR_TAB`. En vista, vacío = `—`.
- [x] 5.2 `SupplierUpsertPage`: validar correo obligatorio solo en alta (mismo regex que backend); teléfono nunca obligatorio; incluir ambos en `buildPayload`. Asterisco de required solo en create. Mensajes es-CL sin eco del valor.
- [x] 5.3 `SupplierListPage`: columna Correo entre RUT y Redes sociales. Si no hay email, texto `Sin correo` en `#5a6370`. `colSpan` del empty state actualizado.
- [x] 5.4 Verificar en el navegador: alta con correo; alta sin correo bloqueada; edición de un proveedor sin correo (cambiar otro campo y guardar); listado muestra `Sin correo` en los existentes; detalle muestra Correo/Teléfono. Desktop y viewport angosto (la fila two-col).

## 6. Cierre

- [x] 6.1 `npm test` en `backend/` y `frontend/` en verde.
- [x] 6.2 No implementar envío de correo, Adobe/Acrobat Sign, E.164, OTP, NOT NULL, ni índice único. No loguear email ni teléfono.
- [x] 6.3 Entregar la lista operativa de proveedores con `email IS NULL` (id, tipo, nombre/razón social, RUT). No backfillear por código.
