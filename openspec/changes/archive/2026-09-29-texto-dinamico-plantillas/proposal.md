## Why

La cláusula 2.3 describe el entregable con variables en singular (`cantidad_reels`, `formato_reel`, `proveedor_red_social`) y no puede decir «cinco (5) reels en TikTok y cuatro (4) reels en Facebook». La cláusula de la cuenta nombra una red a mano («en Instagram») aunque el contrato sea de otra. El mecanismo `dynamic_text` y los textos `servicios_entregables` y `cuentas_publicacion` ya existen (`texto-dinamico-base`); este recorte los deja escritos en las 21 plantillas y hace que el listado de contratos muestre los entregables.

## What Changes

- La cláusula 2.3 de las 21 plantillas (CONTRATO_0001–0017 y PL0001–PL0004) pasa a usar el texto dinámico `servicios_entregables`. Desaparecen de esa cláusula `cantidad_reels`, `formato_reel` y `proveedor_red_social`; en las mexicanas desaparece también «de Instagram».
- La cláusula de la cuenta usa `cuentas_publicacion` y ya no nombra una red: la 2.5 en CONTRATO_0001–0016 y la 2.6 en PL0001–PL0004. Desaparecen de esa cláusula `proveedor_cuenta_social` y, en las PL, `proveedor_red_social`. CONTRATO_0017 no tiene cláusula de cuenta (su 2.5 es el reporte de resultados) y no se toca.
- La migración verifica el párrafo exacto de cada variante antes de reescribir. Si alguno de los 21 no calza, falla sin escribir nada. El `content_json` previo queda en `template_content_backup`.
- El listado de contratos sigue mostrando la red social. Si el ítem trae `servicios_entregables`, la celda muestra ese texto. El filtro de red social busca también en ese campo.
- No cambian el catálogo, el Constructor, el MCP ni la generación del PDF.

## Capabilities

### New Capabilities

- `template-dynamic-text-clauses`: reescritura verificada de la cláusula 2.3 y de la cláusula de la cuenta en las 21 plantillas, con respaldo y restauración.

### Modified Capabilities

- `contracts-query`: el ítem del listado incluye `servicios_entregables`; el filtro `redSocialSearch` también busca en `contract_overrides->>'servicios_entregables'`; la celda de red social muestra los entregables cuando vienen.

## Impact

**Backend:** migración nueva `backend/migrations/202609290001_dynamic_text_clauses.js` (función pura `rewriteDynamicTextClauses`). `contractsQueryService.mapContractListItem` y el `ILIKE` del filtro de red social. Sin endpoints nuevos. Las migraciones existentes no se editan y esta no se corre en el change: la aplica Ignacio después de fusionar.

**Frontend:** `ContractsListPage.jsx`, solo la celda de la red social.

**APIs:** `GET /api/contracts` suma el campo `servicios_entregables` en cada ítem, leído de `contract_overrides`. El query `redSocialSearch` sigue igual de nombre y pasa a coincidir también con los entregables.

**Datos:** las 21 plantillas reciben `content_json` nuevo; el anterior queda en `template_content_backup` con la nota `texto-dinamico-plantillas: 2.3 y cuenta con texto dinámico`. Los PDF ya emitidos no se tocan.

**Dependencias:** `texto-dinamico-base` (tipo `dynamic_text` y los dos textos del catálogo). Sin dependencias de paquete nuevas.

**Pruebas:** ninguna prueba existente se modifica. Pruebas nuevas en `backend/test/dynamicTextClausesMigration.test.js`, `backend/test/contractsQueryService.entregables.test.js` y `frontend/src/pages/ContractsListPage.entregables.test.jsx`.

## Consideraciones de seguridad

Las cláusulas reescritas son texto de un contrato con efectos legales. `servicios_entregables` puede nombrar redes del influencer y queda en `contract_overrides` y en el listado, que ya muestra red y cuenta a quien tiene `read` sobre `Contract`. No hay endpoints, columnas, grants ni secretos nuevos. El catálogo y la validación de largo (500 caracteres) no cambian: los sigue haciendo `texto-dinamico-base`.

- La migración calcula la reescritura de las 21 antes de guardar el respaldo o actualizar. Si un párrafo no calza, lanza `Error` con el código de la plantilla y lo que no calzó, y no escribe nada.
- El `down` restaura solo las filas de respaldo con esa nota y las borra.
- La celda del listado muestra el texto guardado. No lo redacta ni lo recorta.

**Validación:**

| Campo | Dónde | Regla |
| --- | --- | --- |
| Párrafo 2.3 y párrafo de la cuenta | Migración, `rewriteDynamicTextClauses` | Compara `type`, `text` y `attrs.variableId` de cada nodo, y las marcas de los nodos de texto, contra el párrafo de la variante de ese código. Si no calza, `Error` en español con el código y lo que no calzó. El documento de entrada no cambia. |
| Código de plantilla | Migración | Si el código no está en la tabla de las 21, `Error`. CONTRATO_0017 reescribe solo la 2.3. |
| `servicios_entregables` en el listado | Backend | Se lee de `contract_overrides` como el resto de overrides. Ausente o nulo no altera los campos de hoy. |
| Filtro de red social | Backend | El mismo `ILIKE` sobre `proveedor_red_social` o sobre `servicios_entregables`. |
| Celda de red social | Frontend | Si viene `servicios_entregables`, se muestra ese texto. Si no, se muestra la red y la cuenta como hoy. |
| Mensajes | Migración | En español (`es-CL`). No hay mensaje nuevo de la API. |
