## Context

Las tablas `supplier`, `supplier_persona_natural` y `supplier_empresa` no tienen email ni teléfono. El formulario y las tools MCP tampoco. Hay 22 proveedores (17 persona natural, 5 empresa) sin dato porque la columna no existe.

El refactor CTI dejó lo común en `supplier` y lo específico en los subtipos. `supplierService` concentra validación (`validatePayload`), JOIN explícito (`supplierJoinQuery`), contrato de salida (`normalizeSupplier`) y el split a tablas hijas (`splitChildFields`). El MCP llama el mismo servicio. `isValidEmail` ya vive en `backend/utils/validation.js`.

Este diseño **no reabre** D1–D5 del brief. El doc `docs/firma-electronica-arquitectura.html` (etapa 0) ubica `email`/`phone` en los subtipos; D1 los pone en la tabla base.

## Goals / Non-Goals

**Goals:**

- Persistir email (obligatorio al crear) y teléfono (opcional) en `supplier`.
- Validar en backend para REST y MCP por el mismo camino.
- Mostrar y editar los campos en el admin de proveedores.
- Que el listado identifique quién no tiene correo (backfill operativo de los 22).
- Que generar y firmar contratos con proveedores sin email siga funcionando (I1).

**Non-Goals:**

- Enviar correo al proveedor, Adobe / Acrobat Sign, portal de firma remota.
- Normalización E.164, OTP, verificación de casilla.
- Columna NOT NULL o índice único sobre email.
- Backfill de los 22 (tarea operativa; al cerrar se entrega la lista).
- Variables de plantilla `proveedor_email` / `proveedor_telefono`.
- Autenticar el MCP HTTP (riesgo asumido; otro change).

## Decisions

### D1 — Columnas en la tabla base `supplier` (cerrada)

`email` y `phone` son comunes a persona natural y empresa. Duplicarlos en ambos subtipos obliga a resolver cuál gana en cada JOIN.

**Descartado:** columnas en `supplier_persona_natural` y `supplier_empresa` (como sugiere el doc de arquitectura, etapa 0).

Migración knex aditiva, siguiente a `202609030004`: `table.text('email').nullable()`, `table.text('phone').nullable()`. Sin UNIQUE, sin índice de unicidad (D3). Un índice no único no se agrega: el volumen es irrelevante y el listado no pagina.

### D2 — Nullable en BD, obligatorio solo en el alta (cerrada)

NOT NULL rompe la migración con 22 filas. El servicio exige email cuando `partial === false` (`createSupplier`, `crear_proveedor`). En `partial === true` (`updateSupplier`, `actualizar_proveedor`):

| Payload | Efecto |
| --- | --- |
| `email` omitido | no se toca la columna |
| `email` `""` / solo espacios | `NULL` |
| `email` con valor | trim, minúsculas, `isValidEmail`; si falla → 400 |
| `phone` igual | `trimOrNull`; si hay valor, forma laxa |

Un PUT que no manda contacto sobre un proveedor viejo sin email **debe** persistir el resto de cambios (I2).

### D3 — Sin unicidad de email (cerrada)

Una agencia puede gestionar varias influencers con el mismo correo. Ni UNIQUE ni validación de duplicados.

### D4 — Teléfono como se escribe (cerrada)

Hay plantillas mexicanas (CONTRATO_0016, CONTRATO_0017). Guardar y validar forma, no E.164:

- Caracteres: dígitos, espacios, `+`, `-`, `(`, `)`.
- Largo total ≤ 32.
- Entre 7 y 15 dígitos (tras quitar no-dígitos). Vacío → `NULL`.
- Se persiste el string recortado, sin reordenar ni agregar código de país.

**Descartado:** normalizar a `+56…`. Se difiere a cuando exista SMS/OTP.

### D5 — Listado: columna Correo (cerrada)

Nueva columna **Correo** (entre RUT y Redes sociales). Si hay email, se muestra. Si es `NULL`/vacío, texto **Sin correo** en color subdued `#5a6370` (token de texto secundario; no badge de color, no ícono extra). El operador ve de un vistazo los 22 pendientes. El teléfono no va al listado (densidad; D5 pide email).

La búsqueda del listado también filtra por `s.email` (`ILIKE`); no por teléfono.

### D-svc — Email y phone son campos de la tabla base, no del hijo

Hoy `createSupplier` inserta en `supplier` solo `supplier_type` + auditoría, y `updateSupplier` **sale temprano** si no hay campos de subtipo ni `social_networks`:

```
if (!hasChildUpdate && !hasSocialUpdate) return getSupplierById(id)
```

Sin cambiar eso, un PUT que solo manda `email` no persiste nada.

- `validatePayload` escribe `out.email` / `out.phone` (comunes, independientes del tipo).
- `splitChildFields` **no** los mete en el hijo (`PERSONA_FIELDS` / `EMPRESA_FIELDS` no se tocan).
- `createSupplier`: el INSERT de `supplier` incluye `email` y `phone`.
- `updateSupplier`: arma `baseFields` con las claves presentes; el UPDATE de `supplier` las mezcla con `updated_by` / `updated_at`; el early-return también considera `baseFields`.

`supplierJoinQuery` hace SELECT explícito de columnas de `s`: hay que agregar `s.email` y `s.phone`. Otras consultas que solo piden `s.id` / `supplier_type` / nombre (contratos, firma, documentos) **no** necesitan las columnas nuevas. `buildSubstitutionMap` mapea claves fijas: no va a volcar el email al PDF.

### D-val — Formato de email es control de seguridad

Reusar `isValidEmail` (`backend/utils/validation.js`): trim + `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, luego `toLowerCase()` al persistir. Mensajes (sin interpolar el valor):

- Alta sin email: `El correo es obligatorio.`
- Formato inválido: `El correo no tiene un formato válido.`
- Teléfono inválido: `El teléfono no tiene un formato válido.`

HTTP 400, `code: 'VALIDATION_ERROR'`, `sendError`. El MCP recibe el mismo `{ ok: false, message }` (I3, I4).

Frontend: misma regla en `SupplierUpsertPage` / `SupplierFormSections` (asterisco de obligatorio **solo en alta**). No basta con `type="email"` del browser.

### D-ui — Contacto en Datos básicos, ambos tipos

Sección **Contacto** dentro de `SupplierBasicDataSection`, visible para persona natural y empresa, debajo de identificación (nombre/RUT) y antes de dirección / datos de empresa. Fila de dos columnas (`clause-form-row--two-col`): Correo (`type="email"`, `autoComplete="off"`) y Teléfono (`type="tel"`). En vista (`readOnly`) el vacío se muestra como `—` (detalle) salvo que el listado use «Sin correo».

`emptySupplierForm` / `supplierToForm` / `buildPayload` incluyen `email` y `phone`. `SUPPLIER_FIELD_ERROR_TAB.email` y `.phone` → `datos_basicos`. En create, el `*` de correo sigue la regla de los demás obligatorios.

Clases existentes: `.clause-input`, `.clause-form-label`, `.clause-form-required`, `.clause-field-error`. Sin componentes MUI. Sin sombra ni color de acento extra.

### D-mcp — Mismo payload, descripciones al día

El schema Zod de `crear_proveedor` / `actualizar_proveedor` ya es `.passthrough()`: los campos llegan al servicio. Hay que actualizar las **descripciones** (español) para que el agente sepa que `email` es obligatorio al crear, `phone` opcional, y que listar/obtener los devuelven. No autenticar el MCP en este change.

### D-log — No loguear contacto

Prohibido `console.log`/`error` del email o teléfono, y prohibido meterlos en `message`. Los tests de error no deben exigir que el body contenga la casilla enviada.

## Risks / Trade-offs

- **[I1] Generar/firmar con los 22 sin email se rompe** → `documentBuilderVariableContext` no usa esas claves; tests de generate y `signContract` con fixture sin email deben seguir verdes. No hacer el email NOT NULL.
- **[I2] PUT de un proveedor viejo falla por email vacío** → `partial: true` no exige email; el formulario de edición no marca el campo como required.
- **[PUT que solo cambia email no persiste]** → D-svc: `baseFields` en el UPDATE de `supplier`.
- **[SELECT explícito omite las columnas]** → revisar `supplierJoinQuery`; el resto de joins a `supplier` no proyectan `s.*`.
- **[Tests de creación sin email]** → `supplierApi.test.js` y `mcpServer.test.js` mockean el servicio (el POST de API no pasa por `validatePayload`). Hay que agregar tests **del servicio** (no relajar la regla). Ajustar cualquier payload real de creación.
- **[MCP HTTP pre-prod sin auth]** → al retornar email/phone, un endpoint público expone datos personales. Queda documentado; no se mitiga aquí. `ENVIRONMENT=prod` ya impide arrancar `mcp-http.mjs`.
- **[Email mal escrito → contrato a un tercero]** → validación de formato en backend (D-val). No hay verificación de casilla en este change.
- **[Agencia con un correo para varias influencers]** → D3, aceptado.
- **[Teléfono extranjero rechazado]** → D4 laxo; no E.164 chileno.

**Trade-off D2:** se puede crear bien y después borrar el email en un PUT. Es el precio de no bloquear la edición de los 22. El listado «Sin correo» vuelve a marcarlos.

## Migration Plan

1. Aplicar la migración aditiva (dev/local vía proxy; Cloud SQL de `incrementa-gestion-dev`).
2. Desplegar backend (validación + JOIN) y frontend (formulario/listado) juntos: un front nuevo contra un back viejo mandaría `email` que se ignora; un back nuevo contra un front viejo rechazaría altas. En pre-prod el orden de deploy de 5 pasos ya actualiza ambos.
3. Entregar la lista SQL de proveedores con `email IS NULL` (los 22 actuales, más cualquiera que se cree mal por MCP antes del front). El backfill es operativo.
4. Rollback: `dropColumn` de `email` y `phone`. Las filas de proveedor y los contratos no se tocan.

## Open Questions

Ninguna. D1–D5 están cerradas. D-svc / D-val / D-ui / D-mcp / D-log son consecuencias de implementación, no reaperturas.
