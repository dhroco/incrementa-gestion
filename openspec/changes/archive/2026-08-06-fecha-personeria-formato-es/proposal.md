## Why

En la cláusula PERSONERÍA, las fechas de personería del proveedor empresa (`{{fecha_escritura}}` — Fecha Escritura Pública — y `{{fecha_estatuto}}` — Fecha Certificado Estatuto) no se escriben en formato legal chileno. El contrato queda diciendo "consta en escritura pública de fecha 2024-03-15" en vez de "de fecha 15 de marzo de 2024".

Hay **dos caminos rotos**, por causas distintas:

1. **Dato guardado en BD.** `pg` devuelve un objeto `Date` para columnas de tipo `date`, y `formatDateEs` solo aceptaba strings ISO. Al fallar el match caía al `return raw`, imprimiendo la representación inglesa de JavaScript: `"Tue May 27 2025 00:00:00 GMT-0400 (Chile Standard Time)"` dentro del contrato.
2. **Override desde formulario o MCP.** `preprocessMissingFieldOverrides` solo formateaba `fecha_contrato`. Cuando el proveedor no tiene la fecha cargada y se entrega como override, el valor ISO pisaba el mapa ya formateado y salía crudo: `"2024-03-15"`.

La causa de fondo es que el mismo formateador estaba **duplicado** en dos archivos (`formatDateEs` en `documentBuilderVariableContext.js` y `formatContractDate` en `documentBuilderService.js`), con listas `MESES_ES` propias. Arreglar uno no arreglaba el otro.

## What Changes

- **Nuevo util `backend/utils/formatFechaEs.js`** con `formatFechaEs(value)`, única implementación del formato "15 de marzo de 2024". Acepta `Date` (camino BD) y string ISO (camino override); cualquier otro valor se devuelve tal cual.
- Para un `Date` se leen los componentes **locales**, no los UTC: `pg` construye el valor a medianoche local, así que `toISOString()` correría el día un día atrás en zonas al oeste de Greenwich, Chile incluido.
- **`documentBuilderVariableContext.js`**: se elimina `formatDateEs` y su `MESES_ES`; `fecha_estatuto` y `fecha_escritura` usan el util compartido.
- **`documentBuilderService.js`**: se elimina `formatContractDate` y su `MESES_ES`; los overrides de tipo fecha se formatean por lista (`DATE_OVERRIDE_KEYS`: `fecha_contrato`, `fecha_escritura`, `fecha_estatuto`).

**Restricciones explícitas:** no se modifica el contenido de ninguna plantilla — las 6 activas afectadas ya incrustan la variable correcta y el defecto era solo de renderizado. No se tocan `supplierService` ni el esquema de BD. No cambia el formato de `fecha_contrato`, que ya era correcto.

## Capabilities

### New Capabilities

_(ninguna — extiende `document-builder-supplier-context`)_

### Modified Capabilities

- `document-builder-supplier-context`: formato legal chileno para las fechas de personería, por ambos caminos.

## Impact

- **Backend**: `utils/formatFechaEs.js` (nuevo), `services/documentBuilderVariableContext.js`, `services/documentBuilderService.js`; test `test/formatFechaEs.test.js` (nuevo).
- **Plantillas afectadas (sin cambios de contenido)**: `fecha_estatuto` en CONTRATO_0001–0003; `fecha_escritura` en CONTRATO_0004–0006. Las 11 activas restantes no usan estas variables.
- **Operacional**: los contratos generados desde el despliegue salen con la fecha correcta. Los borradores ya generados conservan el texto viejo y deben regenerarse si importa.

## Consideraciones de seguridad

- No toca autenticación, autorización ni permisos; es formato de presentación de un dato que el proveedor ya tiene cargado.
- Se elimina una fuga de detalle de entorno: el texto inglés de `Date` filtraba la zona horaria del servidor al PDF del contrato.
- El formateo por componentes locales evita corrimientos de día, que en una fecha de escritura pública sería un error con efecto legal.
