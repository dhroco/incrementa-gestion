## Why

Firme.cl pide el nombre del firmante en tres partes (nombres, apellido paterno y apellido materno), y el proveedor guarda un solo texto (`full_name` o `nombre_rep_legal`). David decidió capturar las partes por separado ahora, antes de `firme-flujo-a`, para poder enviar a firma sin cambiar el nombre que ya ven las plantillas.

## What Changes

- El formulario de persona natural pide **Nombres**, **Apellido paterno** y **Apellido materno** en lugar de «Nombre completo». El de empresa pide lo mismo para el representante legal (sigue siendo opcional).
- La base guarda las partes en columnas nuevas. `full_name` y `nombre_rep_legal` siguen existiendo y siguen siendo lo que usan plantillas, listados y documentos: se componen a partir de las partes.
- Los proveedores que ya existen reciben las partes por una división automática, con respaldo previo. Si la recomposición no coincide con el nombre guardado, la migración aborta.
- La API y las herramientas MCP siguen aceptando solo `full_name` (o `nombre_rep_legal`); en ese caso las partes se derivan. Si vienen partes, mandan las partes y el nombre compuesto se recalcula.
- El detalle del proveedor suma las seis partes. El listado no cambia.

No cambia ningún texto de contrato: el nombre que sale en los documentos es el mismo `full_name` / `nombre_rep_legal`.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `suppliers-admin`: columnas de partes en persona natural y en el representante legal; alta y edición en modo partes o modo texto; el detalle devuelve las partes; el formulario pide las tres cajas y envía las partes.
- `backend-mcp-server`: `crear_proveedor` y `actualizar_proveedor` aceptan las seis partes como opcionales y lo dicen en la descripción; sin ellas se comportan como hoy.

## Impact

**Backend:** migración nueva `202610210001_supplier_name_parts.js` (no se ejecuta en esta corrida): columnas, respaldo en `supplier_child_backup` y relleno con `splitFullName`. Función pura nueva `backend/utils/personName.js`. `supplierService.js` (validación, insert/update de hijos, detalle y mapeo). `mcpTools.mjs` (parámetros y descripciones). Plantillas, contratos, listados y documentos siguen leyendo `full_name` y `nombre_rep_legal`.

**Frontend:** `SupplierFormSections.jsx`, `SupplierUpsertPage.jsx` y la vista de solo lectura. `emptySupplierForm()` y el mapeo al formulario suman los seis campos. El payload envía las partes y no envía `full_name` ni `nombre_rep_legal`.

**APIs:** `POST` y `PUT /api/suppliers` aceptan las partes además del nombre completo. `GET /api/suppliers/:id` es aditivo. `GET /api/suppliers` no cambia. Sin variables de entorno ni dependencias nuevas. Sin grants nuevos.

**Datos:** filas existentes de `supplier_persona_natural` y `supplier_empresa` con texto en el nombre se respaldan y se rellenan. El nombre visible queda idéntico (espacios normalizados).

**Pruebas:** ninguna prueba existente se modifica. Las nuevas van en archivos nuevos (`personName`, servicio, migración, MCP, formulario).

## Consideraciones de seguridad

Nombres y apellidos son datos personales (Ley 19.628), ya expuestos hoy como `full_name` / `nombre_rep_legal`. Este cambio los parte; no amplía quién puede leerlos.

- Crear y editar siguen exigiendo `create` / `update` sobre `Supplier`. El detalle sigue exigiendo `read` sobre `Supplier`. Sin grants nuevos.
- Los mensajes de validación son genéricos en español («Los nombres son obligatorios.», «El apellido paterno es obligatorio.», «El nombre completo es obligatorio.») y no repiten el valor enviado.
- El respaldo en `supplier_child_backup` copia la fila completa (incluye identificador y nombre), igual que la migración de referencia. Si el respaldo falla, no se modifica nada.
- **Riesgo asumido — MCP HTTP de pre-prod sin autenticación.** Las partes quedan en el mismo detalle que ya devuelve `obtener_proveedor`. Autenticar el MCP es otro change. En `ENVIRONMENT=prod` el proceso MCP HTTP ya se niega a arrancar.

**Validación (front y back, es-CL):**

| Campo | Alta | Edición |
| --- | --- | --- |
| Persona natural, modo partes (`first_names`, `last_name`, `maternal_last_name`) | Si viene alguna parte: nombres y apellido paterno obligatorios; materno opcional. `full_name` se recompone (si también viene, mandan las partes). | Lo omitido se conserva; partes y `full_name` quedan consistentes. |
| Persona natural, modo texto (solo `full_name`) | Obligatorio y no vacío, como hoy. Las partes se derivan. | Igual si solo viene `full_name`. |
| Empresa, representante (`rep_first_names`, `rep_last_name`, `rep_maternal_last_name`, `nombre_rep_legal`) | Opcional. Si no viene nada, todo queda en `NULL`. Si viene alguna parte, nombres y apellido paterno obligatorios. | Igual, mezclando lo nuevo con lo guardado. |

Errores en español vía el mismo `supplierService` para REST y MCP.
