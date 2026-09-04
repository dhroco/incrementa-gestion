## 1. Migración de esquema y datos

- [x] 1.1 Snapshot **antes** de mutar: query de los 22 proveedores con el RUT visible actual (`formatRutDisplay(body, dv)` equivalente en SQL o en el `up`). Guardar `(id, visible)` en memoria. Si el conteo no es 22, abortar.
- [x] 1.2 `supplier.country_code`: `varchar(2)` nullable + CHECK `^[A-Z]{2}$` → backfill `'CL'` → NOT NULL. Sin DEFAULT. Down: drop column.
- [x] 1.3 Tabla `identity_document_type` (UUID PK, `code` unique, columnas de D2) + seed RUT/CL (`validator_key` `rut_cl`, `pattern` null, `format_example` `12.345.678-5`) y RFC/MX (`validator_key` `pattern`, JSON de patrones 13/12, `format_example` `LEGF870121MGA`).
- [x] 1.4 Agregar `document_type_code` + `document_number` en ambos subtipos y `rep_document_*` en empresa (nullable primero). Backfill desde `rut_*` al canónico `cuerpo-DV`. FK a `identity_document_type(code)` ON DELETE RESTRICT. Luego NOT NULL en los campos del proveedor (el representante sigue nullable).
- [x] 1.5 Verificar **después** del backfill y **antes** del DROP: para cada id del snapshot, el display derivado de `document_number` es **idéntico** al `visible` anterior (mismo dígito verificador). Si uno difiere, `throw` y no dropear.
- [x] 1.5b Antes del DROP: volcar las filas **completas** de `supplier_persona_natural` y `supplier_empresa` a `supplier_child_backup` (mismo patrón que `template_content_backup`: `row_json` jsonb + `note` identificable `identificador-tributario-por-pais`). Recién entonces DROP de `rut_body`/`rut_dv`/`rut_empresa_*`/`rut_rep_legal_*`. El `down` restaura `rut_*` desde ese respaldo (valores exactos), no partiendo `document_number` por el guión.
- [x] 1.6 `template.country_code` nullable + CHECK. Seed `'MX'` en CONTRATO_0016 y CONTRATO_0017, `'CL'` en el resto.
- [x] 1.7 Backup de `content_json` de CONTRATO_0016 y CONTRATO_0017 en `template_content_backup`. Reemplazar «cédula de identidad» → «RFC» recorriendo nodos de texto Tiptap. No tocar `variableId`. Aplicar `migrate:latest` contra la BD de dev (proxy local).
- [x] 1.8 Migración `202609040005_document_type_normalizer.js`: actualizar la fila RFC de `identity_document_type` de `validator_key` `pattern` a `pattern_compact`. Ya aplicada en dev. El `down` revierte a `pattern`.

## 2. Validadores y supplierService

- [x] 2.1 Módulo `backend/utils/identityDocument.js`: registro `{ rut_cl, pattern, pattern_compact }`. `rut_cl` **solo** llama a `parseRut` de `utils/rut.js` (no reescribir). La normalización es del **tipo** (`validator_key`), no de `pattern`: `pattern` preserva puntuación (trim + mayúsculas); `pattern_compact` además borra espacios, puntos y guiones (RFC). El `pattern` del catálogo se escribe contra el identificador real del país. Display: RUT con puntos; RFC = canónico compacto. Mensajes es-CL **sin** interpolar el valor.
- [x] 2.2 Representante legal: validar siempre como `persona_natural` (RFC de 13 en empresa MX). Tipo del proveedor: patrón según `supplier_type`.
- [x] 2.3 `validatePayload`: `country_code` obligatorio en alta, campo de la base (`splitBaseFields`). `document_number` obligatorio; alias de entrada `rut` / `rut_empresa` / `rut_rep_legal`. Inferir `document_type_code` si el país tiene un solo tipo. Coherencia país–tipo. `PERSONA_FIELDS` / `EMPRESA_FIELDS` ya no contienen `rut_*`.
- [x] 2.4 `supplierJoinQuery` + `normalizeSupplier`: proyectar y exponer `country_code`, `document_*`, `rep_document_*`, `document_display`, alias `rut` = `document_display`. **Dejar de** exponer `rut_body`/`rut_dv` y equivalentes. `createSupplier` / `updateSupplier` / `insertChildRow` / `updateChildRow` persisten las columnas nuevas; un PUT que solo cambia `country_code` no puede tragárselo el early-return.
- [x] 2.5 `listSuppliers`: reapuntar la búsqueda de `spn.rut_body` / `se.rut_empresa_body` (y el extra por dígitos) a `document_number` + término compacto (sin puntos/guiones/espacios). Seguir filtrando nombre y email.
- [x] 2.6 Recorrer lecturas de `rut_body`/`rut_dv` **del proveedor** fuera de `supplierService`: `documentBuilderVariableContext`, `documentBuilderService` (nombre de archivo PDF), tests. `contractSigningService` hoy formatea RUT de **company** — confirmar que no lee identificador de proveedor; no tocarlo si es así. I6: al cerrar, ningún `rut_body` de proveedor vivo en código de producto (company y migraciones históricas sí).

## 3. Document Builder

- [x] 3.1 `buildSubstitutionMap`: `proveedor_rut` ← `document_display`; `proveedor_rep_legal_rut` ← `rep_document_display`. No renombrar las claves. `company_rut*` sigue en `rut_body`/`rut_dv` de company.
- [x] 3.2 `generateAndPersist` (generate y `dryRun`): si `template.country_code` está set y ≠ `supplier.country_code`, 400 `VALIDATION_ERROR` con mensaje en español que nombre ambos países, sin el identificador. REST y MCP.
- [x] 3.3 Nombre de archivo PDF: usar `document_display` en lugar de `rut_display` / `rut_empresa_display`.

## 4. API de catálogo y MCP

- [x] 4.1 `GET /api/identity-document-types` con `authorize('read', 'Supplier')`. Controller + método de listado en `supplierService` (o módulo del catálogo). Registrar la ruta cerca de `/api/social-networks/catalog`.
- [x] 4.2 MCP: descripciones de `listar_proveedores`, `obtener_proveedor`, `crear_proveedor`, `actualizar_proveedor` en español — `country_code`, `document_number` (y alias `rut`/`rut_empresa`), RFC vs RUT. El schema Zod puede seguir en `passthrough`; la validación es la del servicio. No autenticar el MCP HTTP.

## 5. Tests de backend

- [x] 5.1 Validación: alta sin país → 400; RUT chileno inválido → mismo mensaje de hoy, sin eco; RFC persona `LEGF870121MGA` persiste mayúsculas; RFC de 12 en persona natural → 400; empresa MX RFC 12 + representante 13 → 201; alias `rut` `12.345.678-5` guarda `12345678-5`; I3: INSERT de un tipo `pattern` nuevo (p. ej. CUIT/AR) y validar contra el identificador real **sin** cambiar el registro.
- [x] 5.2 Búsqueda: `listSuppliers` encuentra por RUT con puntos, por fragmento de dígitos y por fragmento de RFC.
- [x] 5.3 Generate/dry-run: Chile+plantilla CL sigue OK (I1); MX+CONTRATO_0016 OK; MX+plantilla CL → 400 nombrando países; CL+CONTRATO_0016 → 400. `{{proveedor_rut}}` rinde `12.345.678-5` y `LEGF870121MGA` según el caso. `signContract` con proveedor chileno sigue OK.
- [x] 5.4 Ajustar fixtures/payloads de creación que aún manden solo `rut` sin `country_code` (`supplierApi.test.js`, `mcpServer.test.js`, document builder). No relajar reglas: agregar país o usar el alias documentado.
- [x] 5.5 MCP: descripciones mencionan país/documento; `crear_proveedor` con RFC válido; identificador inválido → `ok: false` sin eco del valor.
- [x] 5.6 I3 con puntuación: CUIT `pattern` `^[0-9]{2}-[0-9]{8}-[0-9]$` acepta y persiste `20-12345678-9`; el mismo país con `20123456789` se rechaza. RFC `pattern_compact` con `LEGF-870121-MGA` se guarda `LEGF870121MGA`.

## 6. Frontend

- [x] 6.1 Cargar `GET /api/identity-document-types` en el formulario. Selector de país (`<select class="clause-input">`) obligatorio en alta, sin preselección. País editable en edición. `emptySupplierForm` / `supplierToForm` / `buildPayload` / `SUPPLIER_FIELD_ERROR_TAB`.
- [x] 6.2 Campo de documento: si `validator_key === 'rut_cl'`, **seguir usando** `RutInput` + `formatRut` / `formatRutDisplay` canónicos (CLAUDE.md). Si no, input de texto con `label` y `format_example` del catálogo. Representante legal igual. Validación cliente en español sin eco; no sustituye al backend.
- [x] 6.3 `SupplierListPage` y `DocumentBuilderPage`: mostrar `document_display` (o alias `rut` ya formateado). **No** pasar un RFC por `formatRutDisplay`. Encabezado de listado: «Identificador». Detalle muestra país e identificador; vacío = `—`.
- [x] 6.4 Verificar en el navegador: alta chilena con `RutInput` (formato `XX.XXX.XXX-X`); alta mexicana con RFC `LEGF870121MGA`; alta MX rechazada por el RUT-validator viejo ya no ocurre; listado muestra ambos formatos; Document Builder muestra el RFC sin corromperlo; generar CONTRATO_0016 con proveedor MX; intentar plantilla CL con proveedor MX muestra el error de países. Viewport desktop y angosto.

## 7. Cierre

- [x] 7.1 `rg` de `rut_body|rut_dv` en código de **proveedor** (service, controllers, frontend de proveedores, MCP, variable context, tests de proveedor): cero hits. Excepciones permitidas: `company`, `utils/rut.js`, `RutInput`, migraciones históricas.
- [x] 7.2 `npm test` en `backend/` y `frontend/` en verde.
- [x] 7.3 No implementar moneda/`precio_numero`, no renombrar `proveedor_rut`, no tocar `company.rut_*`, no autenticar MCP, no loguear identificadores.
- [x] 7.4 Entregar listado SQL de proveedores: `id`, tipo, nombre/razón social, `country_code`, `document_type_code`, `document_number`, display. Agrupado por país y tipo de documento.
