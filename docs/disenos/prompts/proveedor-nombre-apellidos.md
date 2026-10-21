# Recorte · proveedor-nombre-apellidos

> Encargo de Ignacio (arquitecto), 21-oct-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/firma-firme.md` (sección «Quién firma por Firme»). **Base: `preprod` con `firme-cliente`
> fusionado.** Va **antes** de `firme-flujo-a`.

## 1. Objetivo

Firme.cl exige el nombre del firmante en tres partes: nombres, apellido paterno y apellido materno. Hoy
el proveedor guarda un solo texto: `supplier_persona_natural.full_name` y, en las empresas,
`supplier_empresa.nombre_rep_legal`. David decidió **capturar las tres partes por separado** en el
formulario del proveedor y ordenar los que ya existen. Al terminar:

- El formulario de proveedor persona natural pide **Nombres**, **Apellido paterno** y **Apellido materno**
  (en vez de «Nombre completo»). El de empresa pide lo mismo para el **representante legal**.
- La base guarda las partes en columnas nuevas, y `full_name` y `nombre_rep_legal` **siguen existiendo y
  siguen siendo lo que usan las plantillas y las pantallas**: se componen a partir de las partes.
- Los proveedores que ya existen reciben las partes por una división automática, con respaldo previo.
- La API y las herramientas MCP **siguen aceptando solo `full_name`** (o `nombre_rep_legal`) como hoy; en
  ese caso las partes se derivan.

No cambia ningún texto de contrato: el nombre que sale en los documentos es el mismo `full_name`.

## 2. Función pura de nombres

Archivo nuevo `backend/utils/personName.js`:

- `splitFullName(text)` → `{ firstNames, lastName, maternalLastName }` (todos `string`, `''` si no hay).
  Regla: separa por espacios; las **partículas** `de`, `del`, `la`, `las`, `los`, `y`, `e`, `san`, `santa`,
  `da`, `di`, `van`, `von` (sin importar mayúsculas) se pegan a la palabra siguiente formando un solo
  grupo («de la Fuente»). Con los grupos resultantes:
  - 1 grupo → `firstNames` = ese grupo, apellidos `''`;
  - 2 grupos → `firstNames` = 1.º, `lastName` = 2.º, `maternalLastName` = `''`;
  - 3 grupos → 1.º, 2.º y 3.º respectivamente;
  - 4 o más → `maternalLastName` = último, `lastName` = penúltimo, `firstNames` = el resto unido por espacio.
  Conserva tildes y mayúsculas; colapsa espacios repetidos; texto vacío o no `string` → todo `''`.
- `composeFullName({ firstNames, lastName, maternalLastName })` → las partes no vacías (recortadas) unidas
  por un espacio.

## 3. Datos (migración)

**Un archivo nuevo**, `backend/migrations/202610210001_supplier_name_parts.js` (`up` y `down`). **No la
ejecutes.** Sigue el patrón de `202609040003_supplier_document_identifier.js`:

- `supplier_persona_natural`: agrega `first_names`, `last_name`, `maternal_last_name` (text, nullable).
- `supplier_empresa`: agrega `rep_first_names`, `rep_last_name`, `rep_maternal_last_name` (text, nullable).
- **Relleno** de las filas existentes con `splitFullName` aplicado a `full_name` / `nombre_rep_legal`
  (solo donde la fuente tenga texto y las partes estén en `NULL`). El relleno es una **función pura**
  que la migración importa de `backend/utils/personName.js` (no copies la lógica).
- **Antes** de rellenar, respalda cada fila afectada en `supplier_child_backup` (`child_kind` =
  `persona_natural` o `empresa`, `row_json` = la fila completa, `note` = `supplier-name-parts`), como la
  migración de referencia. Si el respaldo falla, **aborta** sin modificar nada.
- **Verifica** antes de terminar que para todo proveedor rellenado `composeFullName(partes)` es igual a
  `full_name` (o `nombre_rep_legal`) tras normalizar espacios; si alguno no coincide, aborta con un mensaje
  que liste los ids. Así el relleno nunca cambia el nombre visible.
- `down`: quita las columnas nuevas (no toca `supplier_child_backup`).

## 4. Servicio y API

En `backend/services/supplierService.js` (la validación que arma `out.full_name` y `out.nombre_rep_legal`,
`insertChildRow`, `updateChildRow`, la consulta de detalle y el mapeo de la respuesta):

**Persona natural.**
- Entradas aceptadas: `first_names`, `last_name`, `maternal_last_name` y/o `full_name`.
- **Modo partes** (viene alguna de las tres): se exigen `first_names` y `last_name` no vacíos
  (errores en español: «Los nombres son obligatorios.», «El apellido paterno es obligatorio.»);
  `maternal_last_name` es opcional; `full_name` **se recompone** con `composeFullName` (si además viene
  `full_name`, **mandan las partes**).
- **Modo texto** (solo `full_name`): como hoy («El nombre completo es obligatorio.» si falta o está
  vacío), y las partes **se derivan** con `splitFullName` y se guardan.
- En una **actualización parcial**, lo que no viene se conserva; las partes y `full_name` se recomponen con
  la mezcla de lo nuevo y lo guardado, y siempre quedan consistentes entre sí.

**Empresa (representante legal).** Igual, con `rep_first_names`, `rep_last_name`, `rep_maternal_last_name`
y `nombre_rep_legal`. El representante es **opcional**: si no viene nada, todo queda en `NULL` como hoy; si
viene alguna parte, se exigen `rep_first_names` y `rep_last_name`.

**Respuesta.** El detalle del proveedor suma `first_names`, `last_name`, `maternal_last_name`,
`rep_first_names`, `rep_last_name`, `rep_maternal_last_name` (`null` si no hay). No cambian los campos
actuales ni el listado.

**MCP** (`mcpTools.mjs`): las herramientas de crear y actualizar proveedor aceptan además, como opcionales,
las seis partes; su descripción lo dice. Sin ellas se comportan como hoy.

## 5. Interfaz

`frontend/src/pages/SupplierFormSections.jsx` y `SupplierUpsertPage.jsx` (y la vista de solo lectura):

- Persona natural: en lugar de la caja «Nombre completo», tres cajas **Nombres \***, **Apellido paterno \***
  y **Apellido materno** (opcional). Empresa, sección «Representante legal»: lo mismo (el representante sigue
  siendo opcional: si no se escribe nada, no se envía nada; si se escribe algo, nombres y apellido paterno son
  obligatorios).
- El payload envía las partes; **no** envía `full_name` ni `nombre_rep_legal` (el backend los compone).
- Al abrir un proveedor existente, las cajas vienen llenas con lo que devuelve el detalle; si el detalle no
  trae partes (backend antiguo), se rellenan con una división simple del `full_name` en el navegador (solo
  como respaldo) o quedan vacías si no hay texto.
- Validación del lado del cliente con los mismos mensajes que el backend. Mensajes en español, estilos del
  sistema de diseño (`openspec/config.yaml`), sin librerías nuevas.
- `emptySupplierForm()` y el mapeo de un proveedor al formulario suman los seis campos nuevos; los campos
  actuales se conservan (la prueba existente construye el formulario con `full_name`).

## 6. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`. No agregues
  variables de entorno ni dependencias.
- **No ejecutes** `knex`, migraciones ni seeds. Ninguna prueba ni comando se conecta a la base de datos real.
- **No cambies** cómo se muestra o usa el nombre en plantillas, contratos, listados ni documentos:
  siguen leyendo `full_name` y `nombre_rep_legal`.
- Mensajes en español. Documentación y commits en español.

## 7. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente.** Las de
`supplierService`, `supplierApi`, `mcpServer`, `documentBuilder*` y `SupplierFormSections.contact` deben
seguir en verde sin tocarlas: crear un proveedor con solo `full_name` sigue funcionando. Si cualquier
prueba existente falla, **no la ajustes: consulta a la mesa.**

## 8. Pruebas nuevas

**Todas en archivos nuevos.**

- `backend/test/personName.test.js`, tabla de casos (entrada → partes):
  «María José Pérez Soto» → `María José` / `Pérez` / `Soto`; «Juan Pérez» → `Juan` / `Pérez` / ``;
  «Ana de la Fuente Soto» → `Ana` / `de la Fuente` / `Soto`; «Juan de la Cruz Pérez Soto» →
  `Juan de la Cruz` / `Pérez` / `Soto`; «Madonna» → `Madonna` / `` / ``; «  Pedro   Soto  Ruiz  » →
  espacios colapsados; vacío y no-`string` → todo vacío. `composeFullName` omite vacíos y recorta.
  Propiedad: para los casos de la tabla, `composeFullName(splitFullName(x))` es igual a `x` normalizado.
- `backend/test/supplierService.nameParts.test.js` (mismos dobles que las pruebas existentes de
  `supplierService`): crear persona natural en modo partes (se guarda `full_name` compuesto); en modo texto
  (se derivan las partes); partes incompletas (errores); si vienen partes y `full_name` distinto, mandan las
  partes; actualización parcial (cambia solo `last_name` y `full_name` se recompone); empresa con
  representante en partes, sin representante y con representante incompleto; el detalle devuelve las seis
  partes.
- `backend/test/supplierNamePartsMigration.test.js`: la migración exporta `up` y `down`; con un doble de
  `knex` y filas de ejemplo, respalda antes de rellenar, rellena solo filas con partes `NULL`, **aborta sin
  modificar nada** si el respaldo falla y aborta si la recomposición no coincide con el nombre guardado.
- `backend/test/mcpSupplierNameParts.test.js`: las herramientas de proveedor aceptan las partes y siguen
  aceptando solo el nombre completo.
- `frontend/src/pages/SupplierFormSections.nameParts.test.jsx`: las tres cajas en persona natural y en
  representante legal; obligatoriedad (nombres y apellido paterno sí, materno no); el payload trae las partes y
  no `full_name`; un proveedor existente llena las cajas; el representante vacío no envía nada.

## 9. Puntos de atención

- `full_name` y `nombre_rep_legal` son la fuente de lo que ven las plantillas: que el relleno y la
  composición los dejen **idénticos** al texto actual es el requisito central.
- La división automática se equivoca a veces (nombres compuestos, apellidos de una sola palabra): por eso
  las cajas son editables y por eso el relleno respalda antes de escribir. No intentes hacerla más
  «inteligente» que la regla de la sección 2.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test` y
  `cd frontend && npm run lint`. Todas en verde.
