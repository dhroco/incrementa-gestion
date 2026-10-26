## 1. Función pura de nombres

- [x] 1.1 Crear `backend/utils/personName.js` con `splitFullName` y `composeFullName` según D2: partículas, grupos 1/2/3/4+, tildes y mayúsculas, espacios colapsados, no-string y vacío → tres `''`. Ningún token se descarta.
- [x] 1.2 Crear `backend/test/personName.test.js` con la tabla del recorte («María José Pérez Soto», «Juan Pérez», «Ana de la Fuente Soto», «Juan de la Cruz Pérez Soto», «Madonna», «  Pedro   Soto  Ruiz  », vacío y no-string) y la propiedad `composeFullName(splitFullName(x))` igual a `x` normalizado. `composeFullName` omite vacíos y recorta.

## 2. Migración

- [x] 2.1 Crear `backend/migrations/202610210001_supplier_name_parts.js` (`up` y `down`). Columnas nullable: `first_names`, `last_name`, `maternal_last_name` en `supplier_persona_natural`; `rep_first_names`, `rep_last_name`, `rep_maternal_last_name` en `supplier_empresa`. Importar `splitFullName` y `composeFullName` desde `../utils/personName`; no copiar la regla.
- [x] 2.2 En `up`, respaldar en `supplier_child_backup` cada fila con texto en `full_name` o `nombre_rep_legal` y partes `NULL` (`child_kind` `persona_natural` o `empresa`, `row_json` la fila completa, `note` `supplier-name-parts`) antes de rellenar. Si el insert falla, lanzar sin actualizar partes. Rellenar solo esas filas. No reescribir `full_name` ni `nombre_rep_legal`. Verificar que la composición coincide tras normalizar espacios; si no, lanzar listando los `supplier_id`.
- [x] 2.3 `down`: quitar las seis columnas. No leer ni borrar `supplier_child_backup`. No ejecutar `knex` ni esta migración.
- [x] 2.4 Crear `backend/test/supplierNamePartsMigration.test.js` con un doble de knex y filas de ejemplo: exporta `up` y `down`; respalda antes de rellenar; rellena solo filas con partes `NULL`; aborta sin modificar partes si el respaldo falla; aborta si la recomposición no coincide con el nombre guardado y el error lista el `supplier_id`; `down` quita las seis columnas y no toca `supplier_child_backup` (escenario «Down drops only the new columns»).

## 3. Servicio de proveedores

- [x] 3.1 En `supplierService.js`, aceptar modo partes y modo texto para persona natural (`first_names`, `last_name`, `maternal_last_name`, `full_name`) y para el representante (`rep_first_names`, `rep_last_name`, `rep_maternal_last_name`, `nombre_rep_legal`). Mensajes: «Los nombres son obligatorios.», «El apellido paterno es obligatorio.», «El nombre completo es obligatorio.». Si vienen partes y nombre compuesto, mandan las partes y `full_name` / `nombre_rep_legal` salen de `composeFullName`. Modo texto guarda el texto recortado como hoy y deriva las partes. Parte vacía → `NULL`.
- [x] 3.2 Actualización parcial: lo omitido se conserva; mezclar con lo guardado y dejar partes y nombre compuesto alineados. Representante opcional: sin claves, las cuatro quedan `NULL` en el alta. Persistir las columnas en `insertChildRow` y `updateChildRow`.
- [x] 3.3 El detalle (`supplierJoinQuery` + `normalizeSupplier` de `GET /api/suppliers/:id`) suma las seis partes en `null` si no hay, para los dos tipos. El listado no agrega esas claves ni cambia búsqueda u orden. Mismos grants de siempre (`create` / `update` / `read` sobre `Supplier`); sin grants ni variables de entorno nuevos.
- [x] 3.4 Crear `backend/test/supplierService.nameParts.test.js` con los mismos dobles que las pruebas existentes de `supplierService`: alta persona natural en modo partes y en modo texto; partes incompletas; partes ganan sobre un `full_name` distinto; update parcial de solo `last_name` recompone `full_name`; empresa con representante en partes, sin representante y con representante incompleto; el detalle devuelve las seis partes (escenario «Detail includes all six parts»); el listado no trae las seis claves (escenario «List shape is unchanged»); alta de persona natural solo con `full_name` responde 201 y deriva las partes (escenario «Create persona natural with only the composed name»); empresa con solo `rep_first_names` y `rep_last_name` deja `rep_maternal_last_name` NULL. No modificar ningún archivo de prueba existente.

## 4. MCP

- [x] 4.1 En `mcpTools.mjs`, `crear_proveedor` y `actualizar_proveedor` aceptan las seis partes como opcionales y la descripción lo dice. Sin ellas se comportan como hoy. La validación sigue solo en `supplierService`.
- [x] 4.2 Crear `backend/test/mcpSupplierNameParts.test.js`: las herramientas aceptan las partes y siguen aceptando solo el nombre completo; cubrir los cuatro escenarios MCP: crear desde partes (`full_name` compuesto), crear solo con `full_name` (partes derivadas), `actualizar_proveedor` solo con `last_name` (recompone `full_name`) y partes incompletas (`ok: false`, «El apellido paterno es obligatorio.», sin insert).

## 5. Formulario

- [x] 5.1 En `SupplierFormSections.jsx`, reemplazar «Nombre completo» por **Nombres**, **Apellido paterno** y **Apellido materno** (obligatorios los dos primeros; asterisco con `clause-form-required`). En «Representante legal», las mismas tres cajas; el bloque sigue opcional. Solo lectura usa las mismas cajas. Clases `clause-form-*` existentes; sin librerías ni estilos nuevos.
- [x] 5.2 `emptySupplierForm()` y el mapeo al formulario conservan `full_name` y `nombre_rep_legal` y suman las seis claves. Al abrir un proveedor, llenar desde el detalle; si el detalle no trae partes, aplicar en el cliente la misma regla que `splitFullName`; sin texto, cajas vacías.
- [x] 5.3 En `SupplierUpsertPage.jsx`, validar con los mismos mensajes que el backend. El payload envía las partes y no envía `full_name` ni `nombre_rep_legal`. Representante con las tres cajas vacías: no enviar ninguna clave de nombre del representante. Si hay algún texto, exigir nombres y apellido paterno.
- [x] 5.4 Crear `frontend/src/pages/SupplierFormSections.nameParts.test.jsx`: tres cajas en persona natural y en representante legal; obligatoriedad (nombres y apellido paterno sí, materno no); el payload trae las partes y no `full_name`; un proveedor existente llena las cajas; el representante vacío no envía nada; representante con solo apellido materno falla con «Los nombres son obligatorios.» o «El apellido paterno es obligatorio.»; persona natural no muestra «Nombre completo».

## 6. Verificación

- [x] 6.1 Correr `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y `cd frontend && npm run lint`. Todas en verde. Si una prueba existente falla, no ajustarla: parar y consultar a la mesa.

## 7. Devolución de cierre

- [x] 7.1 El update parcial lee la fila hija dentro de `db.transaction` con `forUpdate()` y mezcla y escribe sobre esa fila bloqueada. Prueba nueva: dos actualizaciones concurrentes de partes distintas no se pisan y la lectura usa la transacción con `forUpdate`.
- [x] 7.2 El `buscar` de `nombre-completo-obligatorio` es el texto real de `supplierService.js` (una sola aparición). Una prueba nueva exige «El nombre completo es obligatorio.» en modo texto sin `full_name`.
