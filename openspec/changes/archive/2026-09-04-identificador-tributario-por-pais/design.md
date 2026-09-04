## Context

El modelo de proveedor nació chileno: `supplier_persona_natural` y `supplier_empresa` guardan `rut_body` + `rut_dv` NOT NULL, y `parseRut` exige 7–8 dígitos con módulo 11. Un RFC mexicano (`LEGF870121MGA`) se reduce a 6 dígitos al quitarle las letras y cae con «El RUT ingresado no es válido». El esquema ni siquiera puede persistirlo: un RFC no se parte en cuerpo + DV.

Hay 22 proveedores, todos chilenos. Las plantillas CONTRATO_0016 y CONTRATO_0017 son de jurisdicción mexicana (`supplier_type` `persona_natural`) y todavía dicen «cédula de identidad {{proveedor_rut}}».

`supplierService` concentra validación (`validatePayload`), JOIN explícito (`supplierJoinQuery`), contrato de salida (`normalizeSupplier`) y el split a hijas (`splitChildFields` / `PERSONA_FIELDS` / `EMPRESA_FIELDS`). REST y MCP entran por el mismo servicio. `documentBuilderVariableContext.buildSubstitutionMap` lee `rut_display` / `rut_empresa_display` / `rut_rep_legal_display`. `contractSigningService` formatea el RUT de **company**, no del proveedor — fuera de alcance, pero hay que confirmarlo al implementar.

Este diseño **no reabre** D1–D6 del brief.

## Goals / Non-Goals

**Goals:**

- País en `supplier` y un catálogo de tipos de documento (RUT/CL, RFC/MX) para que un país nuevo con validación por patrón sea un INSERT.
- Un solo mecanismo de identificador en los subtipos y en el representante legal; migrar los 22 y borrar `rut_*` del proveedor.
- Validar por tipo en backend (REST y MCP, mismo camino). Chile sigue en módulo 11 vía `parseRut` sin reescribirlo.
- `{{proveedor_rut}}` resuelve el identificador del país con su formato de despliegue.
- Rechazar generación (y dry-run) si el país del proveedor no coincide con el de la plantilla.
- Corregir «cédula de identidad» → «RFC» en CONTRATO_0016 y CONTRATO_0017, con backup.
- UI: selector de país; Chile sigue en `RutInput` + `XX.XXX.XXX-X`.
- I1: los 22 conservan el mismo RUT visible.

**Non-Goals:**

- Identificadores de `company` y de sus representantes (Incrementa es chilena).
- Moneda / locale de `precio_numero` (fuga conocida; otro change).
- Renombrar `proveedor_rut` / `proveedor_rep_legal_rut` (deuda explícita).
- Traducir el resto del contenido de las plantillas mexicanas.
- Autenticar el MCP HTTP (riesgo acumulado; otro change).
- Filtrar el selector de plantillas por país (solo se rechaza al generar).
- Tabla de países aparte; el catálogo de documentos es la fuente de países conocidos.

## Decisions

### D1 — `country_code` en `supplier` (cerrada)

Discriminador común a persona natural y empresa, mismo criterio que `email` y `phone`.

Migración: columna nullable → backfill `'CL'` en las 22 filas → `NOT NULL`. Sin `DEFAULT`.

Tipo SQL: D1 pide `CHAR(2)`. En PostgreSQL `char(n)` rellena con espacios y rompe comparaciones con `'CL'`. Se implementa como `varchar(2)` con `CHECK (country_code ~ '^[A-Z]{2}$')` — mismo contrato ISO-3166-1 alfa-2, sin padding. Se guarda en mayúsculas.

**Descartado:** default `'CL'` (esconde altas futuras sin país). **Descartado:** columna en cada subtipo.

### D2 — Catálogo `identity_document_type` (cerrada)

Misma idea que `social_network_catalog`: agregar un país es cargar un dato.

| Columna | Notas |
| --- | --- |
| `id` | UUID PK |
| `code` | TEXT UNIQUE (`RUT`, `RFC`) |
| `country_code` | `varchar(2)` + mismo CHECK |
| `label` | `'RUT'`, `'RFC'` |
| `label_long` | `'Rol Único Tributario'`, `'Registro Federal de Contribuyentes'` |
| `validator_key` | `'rut_cl'` \| `'pattern'` |
| `pattern` | TEXT nullable; ver D4 |
| `format_example` | placeholder de UI |

FK de los subtipos: `document_type_code` → `identity_document_type(code)` `ON DELETE RESTRICT`. Borrar un tipo en uso se impide.

**Descartado:** una tabla por país.

Países del selector = `DISTINCT country_code` del catálogo. Etiquetas en UI/mensajes: mapa pequeño `{ CL: 'Chile', MX: 'México' }` con fallback al código. Un país nuevo aparece en el selector por el catálogo; el gentilicio queda como código hasta que alguien agregue la etiqueta (aceptable: I3 exige validación sin código, no copy de UI).

### D3 — Un identificador, se borran `rut_*` del proveedor (cerrada)

`supplier_persona_natural`: `document_type_code` + `document_number` (ambos NOT NULL tras el backfill).
`supplier_empresa`: igual para la empresa; `rep_document_type_code` + `rep_document_number` (nullable, como hoy el RUT del representante).

`document_number` se guarda **normalizado, formato canónico del tipo**:

| Tipo | Canónico | Despliegue (derivado, no se guarda) |
| --- | --- | --- |
| RUT/CL | `12345678-5` (sin puntos, con guión) | `12.345.678-5` |
| RFC/MX | mayúsculas, sin espacios ni guiones (`LEGF870121MGA`) | igual al canónico |

Backfill de los 22: `document_type_code = 'RUT'`, `document_number = rut_body \|\| '-' \|\| upper(rut_dv)`. Representantes empresa igual desde `rut_rep_legal_*` cuando no son null.

Después del backfill, `DROP` de `rut_body`, `rut_dv`, `rut_empresa_body`, `rut_empresa_dv`, `rut_rep_legal_body`, `rut_rep_legal_dv`. I6: al cerrar, `rg rut_body\|rut_dv` sobre código de proveedor no debe devolver hits (migraciones históricas y `company` sí pueden seguir).

**Descartado:** dejar `rut_*` «para Chile» y campos genéricos «para el resto».

### D4 — Registro de validadores (cerrada)

Módulo nuevo `backend/utils/identityDocument.js` (nombre tentativo). No reescribe `parseRut`.

```
VALIDATORS = {
  rut_cl: validateRutCl,   // llama parseRut de utils/rut.js
  pattern: validatePattern // usa identity_document_type.pattern
}
```

Un `validator_key` desconocido → 400 «El tipo de documento no es válido.» sin interpolar el valor.

`pattern` es TEXT:

- Regex crudo (`^…$`) → se aplica a todos los usos.
- JSON `{"persona_natural":"^…$","empresa":"^…$"}` → se elige la clave según el **rol del identificador**, no siempre según `supplier_type` (ver D-rep).

Seed RFC:

- persona física (13): `^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$`
- persona moral (12): `^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$`

Normalización **antes** de validar: RFC → `toUpperCase()`, quitar espacios/puntos/guiones; RUT → lo que ya hace `parseRut` (puntos y guión irrelevantes).

Mensajes (es-CL, sin eco del valor):

- RUT: los de `parseRut` (`El RUT es obligatorio.`, `El RUT ingresado no es válido.`).
- Otros: `El {label} ingresado no es válido.` / `El {label} es obligatorio.` usando `identity_document_type.label`.
- País ausente o no catalogado: `Debe indicar el país del proveedor.` / `El país del proveedor no es válido.`

I3: un test inserta un tipo (`CUIT`/`AR`, `validator_key = 'pattern'`, `pattern = '^\d{11}$'`) y valida contra él **sin** agregar funciones al registro.

### D-rep — El representante legal se valida como persona natural

El RFC de una empresa mexicana es persona moral (12). El del representante es persona física (13). Si el patrón se eligiera siempre por `supplier_type`, el RFC del representante de una `empresa` se validaría con el patrón de 12 y fallaría.

Regla:

- Identificador del proveedor: patrón / validador según `supplier_type`.
- Identificador del representante (`rep_document_*`): siempre como `persona_natural`.

`rep_document_type_code` se infiere del país (el único tipo del catálogo para ese `country_code`, igual que el de la empresa). Hoy CL y MX tienen un tipo cada uno; RUT y RFC cubren a ambos roles.

Esto no reabre D4: «según el tipo de proveedor» aplica al identificador del proveedor.

### D5 — No se renombra `proveedor_rut` (cerrada)

`buildSubstitutionMap`:

- `proveedor_rut` ← `supplier.document_display`
- `proveedor_rep_legal_rut` ← `supplier.rep_document_display` (vacío si persona natural o si no hay representante)

Deuda: follow-up `proveedor_identificador` / `proveedor_rep_legal_identificador`.

### D6 — Coherencia país–plantilla (cerrada)

`template.country_code` nullable, mismo `varchar(2)` + CHECK. Seed: CONTRATO_0016 y CONTRATO_0017 → `'MX'`; el resto de filas en `template` → `'CL'`.

En `generateAndPersist` (incluye `dryRun: true`), después de cargar proveedor y plantilla, antes de sustituir:

- Si `template.country_code` está set y `!== supplier.country_code` → 400 `VALIDATION_ERROR`, mensaje que nombra ambos países en español: `No se puede generar el contrato: el proveedor es de {paísProveedor} y la plantilla es de {paísPlantilla}.`
- Si `template.country_code` es NULL → no se rechaza por esta regla (columna nullable). El seed cubre las plantillas actuales.

No se filtra el listado de plantillas por país en este change.

### D-api — Payload y respuesta

**Entrada (create/update):**

- `country_code` obligatorio en alta.
- `document_number` obligatorio en alta. Alias de entrada, si `document_number` viene vacío: `rut` (persona natural) o `rut_empresa` (empresa). Alias `rut_rep_legal` → `rep_document_number`. Un solo almacenamiento.
- `document_type_code` opcional; si se omite y el país tiene exactamente un tipo en el catálogo, se infiere. Si hay más de uno y no viene, 400.
- Coherencia: el tipo debe tener `country_code` igual al del proveedor.

**Salida (`normalizeSupplier`):**

- `country_code`, `document_type_code`, `document_number` (canónico), `document_display` (formateado).
- `rep_document_type_code`, `rep_document_number`, `rep_document_display` (null si no aplica).
- `rut` se mantiene como **alias de `document_display`** para el listado y el Document Builder que hoy leen `row.rut`.
- **Dejan de exponerse** `rut_body`, `rut_dv`, `rut_empresa_body`, `rut_empresa_dv`, `rut_rep_legal_body`, `rut_rep_legal_dv`. `rut_display` / `rut_empresa_display` / `rut_rep_legal_display` se reemplazan por `document_display` / `rep_document_display` en los consumidores internos (`documentBuilderVariableContext`, nombre de archivo PDF en `documentBuilderService`).

Búsqueda `listSuppliers`: ILIKE sobre `spn.document_number` y `se.document_number` (y nombre/email como hoy). Además, término compacto sin puntos/guiones/espacios, para que `12.345.678-5` y `LEGF 870121` sigan encontrando. Ya no se busca por `rut_body` con solo dígitos.

`GET /api/identity-document-types` (CASL `read` Supplier), análogo a `GET /api/social-networks/catalog`. El frontend arma el selector. MCP no necesita tool extra: las descripciones listan `country_code` y `document_number`.

`splitBaseFields` incluye `country_code`. `PERSONA_FIELDS` / `EMPRESA_FIELDS` pasan a `document_type_code` + `document_number` (+ `rep_*` en empresa). El INSERT/UPDATE de hijas y el SELECT de `supplierJoinQuery` se alinean. El early-return de `updateSupplier` debe persistir un PUT que solo cambia `country_code` (campo de la base).

### D-ui — País y documento en Datos básicos

Selector de país (`<select class="clause-input">`, `font-family: inherit`) en Identificación / Datos empresa, **antes** del campo de documento. Obligatorio en alta (asterisco). Opciones = países del catálogo. Sin preselección de Chile: un default en UI esconde el mismo error que un DEFAULT en BD. En edición el país es editable (revalida el documento); el tipo de proveedor sigue bloqueado.

Campo de documento:

- `validator_key === 'rut_cl'`: `RutInput` + `formatRut` / `formatRutDisplay` canónicos. Label «RUT» / «RUT empresa» / «RUT representante legal». Placeholder `12.345.678-5`.
- resto: `<input>` de texto. Label = `label` del catálogo (RFC). Placeholder = `format_example`. El valor se muestra en mayúsculas para RFC.

Validación cliente: Chile con `parseRut`; otros, el `pattern` del catálogo si viene. No sustituye al backend (I4). Mensajes en español, sin eco.

Listado y Document Builder: pintan `document_display` (o `rut` alias). **No** pasar un RFC por `formatRutDisplay` — hoy `SupplierListPage` y `DocumentBuilderPage` lo hacen con `row.rut` y destrozarían un RFC. Encabezado de columna: «Identificador».

Clases existentes (`.clause-input`, `.clause-form-label`, `.clause-form-required`, `.clause-field-error`). Sin MUI de componentes. Sin sombra ni color extra.

### D-tpl — Redacción mexicana

Antes de mutar `content_json`, insertar en `template_content_backup` las filas de CONTRATO_0016 y CONTRATO_0017 (`note` que identifique este change). Reemplazar el texto «cédula de identidad» por «RFC» en los nodos de texto Tiptap (recorrido JSON, no regex ciego sobre el jsonb entero que podría tocar un `variableId`). No se traduce el resto.

### D-log — No loguear el identificador

Prohibido `console.log`/`error` de `document_number` / RFC / RUT, y prohibido meterlos en `message`. Los tests de error no deben exigir que el body contenga el valor enviado.

## Risks / Trade-offs

- **[I1] La migración altera un RUT de los 22** → Antes: snapshot `(id, visible)` con el formateo actual (`formatRutDisplay(body, dv)`). Después: `document_display` debe ser **idéntico** fila a fila. Si uno difiere, la migración hace `throw` y no dropea columnas. Tarea de cierre: listado por país y tipo.
- **[I2] Se reescribe `parseRut` o se deja de usar** → El validador `rut_cl` **solo** llama a `parseRut`. Tests de RUT inválido conservan el mensaje actual.
- **[I6] Queda un `rut_body` de proveedor vivo** → Grep de cierre en `supplierService`, `documentBuilder*`, frontend de proveedores, MCP, tests. Excepciones permitidas: `company`, migraciones históricas, `utils/rut.js`.
- **[`listSuppliers` deja de encontrar por RUT]** → Reapuntar a `document_number` + forma compacta. Tests de búsqueda con `12.345.678-5`, `12345678` y un RFC.
- **[Frontend formatea RFC como RUT]** → Listado y builder usan `document_display` sin `formatRutDisplay`. Chile en el **formulario** sí sigue con `RutInput`.
- **[RFC del representante validado como persona moral]** → D-rep. Test: empresa MX con RFC de 12 y representante de 13.
- **[Plantilla chilena + proveedor MX genera contrato absurdo]** → D6 en generate y dry-run, REST y MCP.
- **[PDF filename usa `rut_*_display` y queda vacío]** → `documentBuilderService` usa `document_display`.
- **[MCP HTTP pre-prod sin auth]** → al exponer RFC (fecha de nacimiento) se agrava la superficie. Documentado; no se mitiga aquí.
- **[Alias `rut` en el payload]** → dos nombres de entrada, un almacenamiento. Se documenta en MCP. No se persisten columnas paralelas.
- **[`char(2)` vs `varchar(2)`]** → se elige varchar+CHECK para evitar padding; el contrato sigue siendo alfa-2.
- **[Fuga USD / `$` en CONTRATO_0016]** → no se toca; anotada en el proposal.

**Trade-off D5:** el contrato mexicano dirá el RFC correcto bajo el nombre de variable `proveedor_rut`. Es feo y queda como follow-up; mezclar el rename con este change era peor.

**Trade-off selector sin default:** un click extra en cada alta chilena. Es el precio de no volver a esconder un país omitido.

## Migration Plan

Orden (knex, siguiente a `202609030005`; contra Cloud SQL de `incrementa-gestion-dev` vía proxy):

1. Snapshot de verificación de los 22 (query en `up`, guardar en memoria).
2. `supplier.country_code` nullable → backfill `'CL'` → NOT NULL + CHECK. Sin DEFAULT.
3. Crear `identity_document_type` + seed RUT/CL y RFC/MX.
4. Agregar `document_*` / `rep_document_*` nullable; backfill desde `rut_*`; NOT NULL donde corresponde; FKs.
5. Comparar snapshot vs `document_number` formateado a display. Si hay diff, `throw`.
6. Volcar filas completas de `supplier_persona_natural` y `supplier_empresa` a `supplier_child_backup` (`row_json` jsonb + `note` `identificador-tributario-por-pais`). Recién entonces DROP de `rut_*`.
7. `template.country_code` + seed MX/CL.
8. Backup Tiptap + reemplazo «cédula de identidad» → «RFC» en 0016/0017.

Puede ser una migración o varias en este orden; el aborto de I1 y el respaldo de filas deben ocurrir **antes** del DROP.

Deploy: backend (migración + API) y frontend juntos. Un front viejo mandaría `rut` (el alias lo cubre) pero no `country_code` → las altas nuevas fallarían a propósito. Un front nuevo contra un back viejo no tendría catálogo ni columnas. El orden de 5 pasos de pre-prod actualiza ambos.

Rollback: `down` restaura `rut_*` **desde `supplier_child_backup.row_json`** (valores exactos; no partir `document_number` por el guión), borra `country_code` / catálogo / `template.country_code`, y puede reponer `content_json` desde `template_content_backup`. Los 22 vuelven al estado previo, no a uno equivalente. Contratos ya generados no se reescriben.

Cierre operativo: listado SQL de proveedores con `country_code`, `document_type_code`, `document_display`, tipo y nombre.

## Open Questions

Ninguna. D1–D6 están cerradas. D-rep, D-api, D-ui, D-tpl y D-log son consecuencias de implementación, no reaperturas. El `varchar(2)` vs `CHAR(2)` es nota de implementación por el padding de PostgreSQL, no un cambio de contrato.
