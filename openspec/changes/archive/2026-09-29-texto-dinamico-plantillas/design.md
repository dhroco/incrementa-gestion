## Context

`texto-dinamico-base` ya dejó el tipo `dynamic_text` y los textos `servicios_entregables` y `cuentas_publicacion` en el catálogo, el Constructor, el editor y el MCP. Ninguna plantilla los usa todavía. La cláusula 2.3 sigue armada con `cantidad_reels`, `formato_reel` y `proveedor_red_social` en singular, y la cláusula de la cuenta nombra una red a mano.

Los párrafos de hoy, leídos de pre-producción el 29-sep, están en `docs/disenos/prompts/texto-dinamico-plantillas.fixtures.json`. `docs/**` es de solo lectura: la migración y las pruebas copian esos párrafos; no los importan. La redacción de destino la aprobó David el 29-sep (sección 3 del encargo).

El patrón de migración es el de `backend/migrations/202609280002_mx_price_clause_usd.js`: función pura exportada, respaldo en `template_content_backup`, `down` que restaura por nota. Esa migración avisa y sigue si falta una plantilla. Esta no: si falta alguna de las 21, no escribe nada.

El listado aplana `contract_overrides` en `mapContractListItem` y filtra la red con un `ILIKE` solo sobre `proveedor_red_social`. La celda está en `formatRedSocial` (`ContractsListPage.jsx`): red y cuenta, una de las dos, o «—». La suite corre sin base (`env -u DATABASE_URL`).

## Goals / Non-Goals

**Goals:**

- Reescribir la 2.3 de las 21 plantillas a `servicios_entregables`, y la cláusula de la cuenta (2.5 en CONTRATO_0001–0016, 2.6 en PL0001–PL0004) a `cuentas_publicacion`, verificando el párrafo exacto de cada variante.
- Dejar el `content_json` anterior en `template_content_backup` y poder restaurarlo.
- Mostrar `servicios_entregables` en el ítem y en la celda de red social cuando viene, y encontrar por ese texto en el filtro que hoy busca la red.

**Non-Goals:**

- El catálogo, el Constructor, el MCP y la generación del PDF.
- Las cláusulas 2.1 y 2.2, los textos de evento y la revisión de redacción.
- La 2.5 de CONTRATO_0017 (es el reporte de resultados).
- Editar migraciones existentes, correr esta migración o conectarse a una base.
- Tocar `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`, `.agent-orchestrator/**`.
- Modificar cualquier archivo de prueba existente.

## Decisions

### 1. Una tabla de variantes y una función que reemplaza un párrafo verificado

`backend/migrations/202609290001_dynamic_text_clauses.js` exporta `rewriteDynamicTextClauses(contentJson, code)`, `up` y `down`. Al inicio, una tabla código → variante de la 2.3 y variante de la cuenta:

| Códigos | 2.3 | Cuenta |
| --- | --- | --- |
| CONTRATO_0001–0007 y CONTRATO_0009 | `A` | `A_negrita` (2.5) |
| CONTRATO_0008 | `A_colaboracion` | `A_negrita` (2.5) |
| CONTRATO_0010–0015 | `A` | `A` (2.5) |
| CONTRATO_0016 | `MX` | `MX` (2.5) |
| CONTRATO_0017 | `MX` | ninguna |
| PL0001–PL0004 | `PL` | `PL` (2.6) |

Son 21 códigos. Una sola función recorre los párrafos, exige exactamente uno que calce con la firma esperada y lo cambia por los nodos nuevos. La firma compara, en orden, `type`, `text` y `attrs.variableId`, y las marcas de los nodos de texto. No compara el resto de `attrs` de las variables viejas. Los nodos que la redacción no nombra se copian iguales, incluidas las marcas de `company_nombre_comercial` (negrita solo en `A_negrita`).

El nodo `variable` nuevo copia `bold`, `italic`, `underline` y `uppercase` de la primera variable que reemplaza (`cantidad_reels` en la 2.3; `proveedor_cuenta_social` en la cuenta de `A`, `A_negrita` y `MX`; `proveedor_red_social` en la cuenta `PL`). Lleva `group: 'contrato'`, el `variableId` y el `label` del catálogo: `Entregables (cláusula 2.3)` y `Cuentas de publicación (cláusula 2.5)`. Esos cuatro flags hoy son `false` en los fixtures; se copian, no se escriben fijos.

La redacción de destino, las comillas curvas de la `MX` (U+201C y U+201D) y el punto que la cuenta `A` no tiene hoy quedan en la spec. El documento de entrada no se muta. Otro párrafo del mismo `doc` queda igual. Un código fuera de la tabla lanza `Error` cuyo mensaje, en español, incluye el código. Un párrafo que no calza (por ejemplo uno ya reescrito) lanza `Error` con el código y lo que no calzó.

**Alternativa descartada:** un caso por plantilla. Son las mismas cuatro redacciones de la 2.3 y cuatro de la cuenta. La tabla se lee; veintiún copias no.

### 2. Primero las 21 en memoria, después el respaldo

`up` carga las 21 por `template.code`. Si falta alguna, lanza antes de insertar, con los códigos ausentes en el mensaje. Si están las 21, calcula `rewriteDynamicTextClauses` de todas y solo entonces inserta en `template_content_backup` la nota `texto-dinamico-plantillas: 2.3 y cuenta con texto dinámico` y actualiza `content_json`. Knex envuelve la migración en una transacción; igual no se escribe nada hasta que las 21 reescrituras existan en memoria.

`down` hace lo que el `down` de `202609280002_mx_price_clause_usd.js` con el respaldo: restaura `content_json` desde las filas de esa nota y las borra. No toca `currency_code` ni otra columna.

**Alternativa descartada:** el aviso de la migración de moneda, que sigue si falta una plantilla. El encargo pide fallar sin escribir.

### 3. El listado suma el campo y abre el filtro con un OR agrupado

`mapContractListItem` agrega `servicios_entregables: overrides.servicios_entregables ?? null`, igual que los otros overrides. Si la clave no viene, el ítem lleva `null` y el resto no cambia: las pruebas viejas solo afirman campos concretos.

El `ILIKE` de `redSocialSearch` pasa a ser un `AND` de un grupo `(proveedor_red_social ILIKE ? OR servicios_entregables ILIKE ?)`, con el mismo término `%…%` ya recortado. El grupo evita que el `OR` suelte los demás filtros. El nombre del query no cambia.

`formatRedSocial` devuelve `servicios_entregables` cuando es un string no vacío. Si no, hace lo de hoy (red y cuenta, una de las dos, o «—»). La columna sigue llamándose Red Social. No hay estilo nuevo.

**Alternativa descartada:** mostrar entregables y, además, la cuenta vieja. El encargo dice que la celda muestra los entregables si vienen.

### 4. Las pruebas no tocan la base ni los archivos viejos

`docs/**` no se importa. Los párrafos de los fixtures se copian al archivo de prueba, envueltos en un `doc` junto a otro párrafo. `rewriteDynamicTextClauses` se prueba ahí.

`contractsQueryService.entregables.test.js` afirma el ítem mapeado. Para el filtro, `listContracts` corre con un doble del query builder que registra el SQL y los bindings del `ILIKE`: la suite no tiene `DATABASE_URL`. El predicado registrado tiene que nombrar las dos columnas con el mismo término, y un contrato cuya red está solo en `servicios_entregables` cumple ese predicado.

La prueba de la celda monta `ContractsListPage` con permiso `read` sobre `Contract` y los fetch mockeados. No se exporta `formatRedSocial`.

## Risks / Trade-offs

- [El `content_json` de pre-producción no calza con el fixture] → `up` lanza con el código y lo que no calzó, y no deja plantillas a medias. No se «arregla» el párrafo a mano dentro de la migración.
- [CONTRATO_0017 pierde el reporte de la 2.5 porque se busca por el número] → La cuenta solo se reemplaza si el párrafo calza con la firma de esa variante. 0017 no tiene variante de cuenta.
- [Un `OR` mal agrupado devuelve contratos de otro cliente] → El grupo va dentro del `andWhere`, con el mismo término en las dos columnas.
- [La celda muestra un string vacío y esconde la red de un contrato viejo] → Solo un string no vacío reemplaza el texto de hoy.
- [Una prueba existente falla al aparecer el campo nuevo] → No se ajusta. Se consulta a la mesa. El mapeo usa `?? null` y las pruebas viejas no comparan el objeto entero.

## Migration Plan

La migración la aplica Ignacio después de fusionar. Este change no la corre ni abre una conexión. `texto-dinamico-base` ya está en el árbol; esta migración no depende de una columna nueva, solo de las filas `template` y de `template_content_backup`.

Rollback: el `down` restaura el `content_json` desde la nota y borra esas filas. Los PDF ya emitidos no se reescriben. Los contratos viejos siguen mostrando la red, porque no tienen `servicios_entregables`.

## Open Questions

Ninguna. La redacción, las variantes, la nota de respaldo y el comportamiento del listado quedan cerrados en el encargo.
