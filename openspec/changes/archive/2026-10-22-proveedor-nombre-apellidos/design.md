## Context

Firme.cl pide el firmante en tres campos (nombres, apellido paterno, apellido materno). Hoy el proveedor persona natural guarda un solo `supplier_persona_natural.full_name` y la empresa un solo `supplier_empresa.nombre_rep_legal`. Las plantillas, el listado y los documentos leen esos dos textos. El diseño de firma (`docs/disenos/firma-firme.md`, «Quién firma por Firme») deja este recorte **antes** de `firme-flujo-a`: capturar las partes sin cambiar el nombre visible. David eligió la opción B (21-oct-2026). Base: `preprod` con `firme-cliente` fusionado.

`supplierService.validatePayload` arma `full_name` y `nombre_rep_legal`. `insertChildRow` / `updateChildRow` escriben la hija. `supplierJoinQuery` + `normalizeSupplier` arman el detalle. REST y MCP entran por el mismo servicio. El formulario vive en `SupplierFormSections.jsx` (la caja «Nombre completo» y «Nombre representante legal», también en solo lectura) y el payload en `SupplierUpsertPage.jsx`. `emptySupplierForm()` y `supplierToForm` siguen exponiendo `full_name`: la prueba existente de contacto arma el formulario con ese campo.

La migración de referencia es `backend/migrations/202609040003_supplier_document_identifier.js`: respalda la fila hija en `supplier_child_backup` (`child_kind`, `row_json`, `note`) y aborta si el valor visible no se conserva.

## Goals / Non-Goals

**Goals:**

- Tres cajas en persona natural y en el representante legal, con los mismos mensajes en el cliente y en el servidor.
- Columnas nuevas para las partes. `full_name` y `nombre_rep_legal` se componen y siguen siendo la fuente de plantillas, listados y documentos.
- Rellenar filas existentes con `splitFullName`, con respaldo previo, sin cambiar el nombre visible.
- API y MCP aceptan solo el nombre completo (y derivan las partes) o las partes (y recomponen el nombre). Si llegan las dos cosas, mandan las partes.
- El detalle suma las seis partes. El listado no cambia de forma.

**Non-Goals:**

- Enviar a Firme, el modal del firmante y cualquier texto de contrato (`firme-flujo-a`).
- Hacer la división «más inteligente» que la regla de partículas de este diseño.
- Renombrar `full_name` / `nombre_rep_legal` o dejar de leerlos en plantillas, contratos, listados o documentos.
- Cambiar pruebas existentes. Si una queda en rojo, se consulta a la mesa.
- Ejecutar la migración, tocar `config.js` / `knexfile.js` / `db/knex.js`, ni agregar dependencias o variables de entorno.
- Autenticar el MCP HTTP.

## Decisions

### D1 — Las partes se guardan y el nombre visible se compone (cerrada)

`supplier_persona_natural` gana `first_names`, `last_name`, `maternal_last_name`. `supplier_empresa` gana `rep_first_names`, `rep_last_name`, `rep_maternal_last_name`. Todas `text`, nullable. No se toca el tipo de `full_name` ni de `nombre_rep_legal`.

Una parte vacía se persiste como `NULL`. El detalle devuelve `null` si no hay valor. `composeFullName` trata `null` y `''` como ausentes.

Alternativa descartada: reemplazar `full_name` por las tres columnas. Obliga a reescribir plantillas y el listado en este recorte.

### D2 — Una sola función pura, sin segunda heurística (cerrada)

`backend/utils/personName.js` exporta `splitFullName` y `composeFullName`. La migración la importa; no copia la regla.

`splitFullName(text)`:

- Si `text` no es `string`, o queda vacío al recortar: las tres partes son `''`.
- Colapsa espacios repetidos, separa por espacios y conserva tildes y mayúsculas.
- Las partículas `de`, `del`, `la`, `las`, `los`, `y`, `e`, `san`, `santa`, `da`, `di`, `van`, `von` (sin importar mayúsculas) se pegan a la palabra siguiente y forman un solo grupo («de la Fuente»). Varias partículas seguidas se acumulan hasta la palabra que no es partícula. Una partícula al final, sin palabra siguiente, queda como grupo propio: no se descarta ningún token.
- Con los grupos: 1 → todo en `firstNames`; 2 → nombres y apellido paterno, materno `''`; 3 → uno por parte; 4 o más → materno = último, paterno = penúltimo, nombres = el resto unido por un espacio.

`composeFullName` recorta cada parte, omite las vacías y une el resto con un solo espacio.

Para cualquier caso de la tabla de pruebas, `composeFullName(splitFullName(x))` es igual a `x` con espacios normalizados (recortado y colapsado). Esa propiedad es el invariante del relleno: el nombre visible no cambia.

Alternativa descartada: un splitter distinto en el navegador o uno «más listo» para nombres compuestos. La caja queda editable precisamente porque la regla se equivoca a veces.

### D3 — Dos modos de entrada; en conflicto mandan las partes (cerrada)

Persona natural, claves `first_names`, `last_name`, `maternal_last_name` y `full_name`.

- **Modo partes.** Viene alguna de las tres. Se exigen `first_names` y `last_name` no vacíos («Los nombres son obligatorios.», «El apellido paterno es obligatorio.»). El materno es opcional. `full_name` se guarda con `composeFullName`. Si el body también trae `full_name`, se ignora.
- **Modo texto.** Solo `full_name`. Sigue vigente «El nombre completo es obligatorio.» si falta o está vacío. Se guarda el texto recortado, como hoy (sin colapsar espacios internos). Las partes se derivan con `splitFullName` de ese texto.

Empresa, igual, con `rep_first_names`, `rep_last_name`, `rep_maternal_last_name` y `nombre_rep_legal`. El representante es opcional. En el alta, si no viene ninguna de esas claves, las cuatro quedan `NULL`. Si viene alguna parte, se exigen nombres y apellido paterno del representante. Si solo viene `nombre_rep_legal`, es modo texto.

Actualización parcial: lo omitido se conserva. Se mezclan las claves presentes con lo guardado y se vuelve a aplicar el modo que corresponda, de modo que partes y nombre compuesto queden alineados. Un cambio de solo `last_name` recompone `full_name`. Un cambio de solo `full_name` rederiva las partes.

El listado sigue saliendo de `display_name` / `full_name` / `razon_social` y no incluye las seis claves. El detalle (`GET /api/suppliers/:id` y `obtener_proveedor`) sí las incluye, en `null` cuando no hay valor, para los dos tipos.

### D4 — El formulario envía partes y no el nombre compuesto (cerrada)

En `SupplierFormSections`, la caja «Nombre completo» pasa a ser **Nombres** (obligatorio), **Apellido paterno** (obligatorio) y **Apellido materno** (opcional). En «Representante legal», las mismas tres etiquetas; el bloque sigue siendo opcional. Solo lectura usa las mismas cajas. Clases de formulario ya existentes (`clause-form-*`); sin librerías ni estilos nuevos. Asterisco de obligatorio con `clause-form-required`, igual que el resto del formulario.

`emptySupplierForm()` y el mapeo de un proveedor al formulario **conservan** `full_name` y `nombre_rep_legal` y suman las seis claves, para no romper la prueba de contacto que construye el formulario con `full_name`.

El payload de alta y edición envía las partes y **no** envía `full_name` ni `nombre_rep_legal`. Si las tres cajas del representante están vacías, no se envía ninguna clave del representante. Si alguna tiene texto, se envían las tres (el materno puede ir vacío) y el cliente exige nombres y apellido paterno con los mismos mensajes que el backend.

Al abrir un proveedor, las cajas salen del detalle. Si el detalle no trae las partes (backend antiguo) y hay `full_name` o `nombre_rep_legal`, el cliente aplica la misma regla que `splitFullName` (copia local, no un import del backend). Sin texto, las cajas quedan vacías.

Consecuencia aceptada: en una edición, vaciar las tres cajas del representante omite las claves, y el update parcial conserva el valor guardado. Borrar un representante ya persistido no entra en este recorte.

### D5 — Respaldo antes de rellenar; la migración no se ejecuta aquí (cerrada)

Un solo archivo, `backend/migrations/202610210001_supplier_name_parts.js`, con `up` y `down`. Nadie la corre en esta corrida.

`up`, en este orden:

1. Agrega las seis columnas nullable.
2. Toma las filas con texto en `full_name` o `nombre_rep_legal` y partes en `NULL`.
3. Inserta en `supplier_child_backup` una fila por cada una: `child_kind` `persona_natural` o `empresa`, `row_json` la fila completa, `note` `supplier-name-parts`. Si ese insert falla, lanza y **no** actualiza partes. En PostgreSQL la migración va en una transacción: el fallo también revierte el `ALTER`.
4. Rellena solo esas filas con `splitFullName`. No reescribe `full_name` ni `nombre_rep_legal`.
5. Comprueba que `composeFullName` de las partes coincide con el nombre guardado tras normalizar espacios. Si alguna fila no coincide, lanza un error que lista los `supplier_id` y no deja el relleno a medias.

`down` quita las seis columnas. No lee ni borra `supplier_child_backup`.

### D6 — MCP declara las partes y no valida por su cuenta (cerrada)

`crear_proveedor` y `actualizar_proveedor` aceptan las seis claves como opcionales y lo dicen en la descripción. Sin ellas, el comportamiento es el de hoy. La validación sigue siendo solo la de `supplierService`.

## Risks / Trade-offs

- [La división parte mal un nombre compuesto o un apellido de una palabra] → Las cajas son editables y el relleno respalda la fila antes de escribir. No se afina la regla.
- [Un `full_name` con espacios internos dobles no es idéntico, carácter a carácter, a `composeFullName(splitFullName(...))`] → La comprobación normaliza espacios. El relleno no reescribe la columna visible, así que plantillas y pantallas siguen viendo el texto guardado.
- [El modo texto guarda el `full_name` recortado tal como hoy, y las partes salen del splitter] → Pueden diferir por espacios internos. El modo partes, que es el del formulario, deja el nombre compuesto igual a la unión de las partes.
- [Vaciar el representante en una edición no lo borra] → Omisión = conservar (D4). Fuera de alcance.
- [El detalle nuevo y un backend viejo conviven un momento] → El cliente divide el nombre solo si faltan las partes.
- [MCP HTTP de pre-prod sigue sin autenticación] → Las partes viajan en el mismo detalle que ya expone `full_name`. No se autentica aquí.
- [`supplier_child_backup` copia identificador y nombre] → Mismo respaldo que la migración de documento. Si el insert falla, no hay update.

## Migration Plan

1. Este change entrega el archivo de migración y el código que lee las columnas. No corre `knex`.
2. El arquitecto aplica la migración en pre-prod **antes** del deploy del código que selecciona las columnas (mismo procedimiento que el resto de migraciones de Container Apps).
3. Rollback de esquema: `down` quita las columnas. Los nombres visibles no se restauran desde el backup porque el `up` no los modifica. El backup queda.
4. Deploy de aplicación después: el formulario nuevo habla en partes; un cliente viejo que solo manda `full_name` sigue siendo válido.

## Open Questions

Ninguna. El recorte fija la regla de división, los mensajes, el orden del respaldo y el hecho de que las partes ganan sobre el nombre compuesto. Si una prueba existente falla al implementar, no se ajusta: se consulta a la mesa.
