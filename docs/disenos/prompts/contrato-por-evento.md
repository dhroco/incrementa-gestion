# Recorte · contrato-por-evento

> Encargo de Ignacio (arquitecto), 29-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/texto-dinamico.md` (§3.2, decisiones a y b). Depende de `texto-dinamico-plantillas` y
> `revision-redaccion`.

## 1. Objetivo

Las 6 plantillas «con Evento» (CONTRATO_0003, 0006, 0009, 0012, 0015 y 0017) **no mencionan el evento**:
su 2.1 y su 2.2 son iguales a las de las plantillas sin evento. Al terminar:
- **la 2.1** de esas 6 describe el evento con el texto dinámico `evento_servicio`;
- **la 2.2** de esas 6 dice el formato y el periodo con el texto dinámico
  `formato_periodo_publicacion`;
- **`mes_ejecucion` se sigue pidiendo** en esas plantillas, aunque deje de aparecer en el texto,
  porque lo usa el listado de contratos;
- **el revisor** verifica además que el evento esté completo y que las fechas sean coherentes.

Las 15 plantillas que no son por evento no cambian.

## 2. Arquitectura

### 2.1 Catálogo (`backend/services/dynamicTextCatalog.js` y `frontend/src/data/variableCatalog.js`)

Dos entradas nuevas, con la misma forma que las actuales y el contenido exacto de la sección 3. La de
`formato_periodo_publicacion` lleva además `requiere: ['mes_ejecucion']`. Las dos entradas actuales
no cambian (no ganan `requiere`). En `VARIABLE_META`, las dos con `type: 'dynamic_text'` y
`source: 'contract'`, como las actuales. En el frontend, en el grupo `contrato`, con
`type: 'dynamic_text'`.

### 2.2 Datos que se piden sin estar en el texto (`documentBuilderService.js`)

- En `generateAndPersist`, después de calcular las claves faltantes a partir del texto, **se agregan
  las claves de `requiere`** de cada texto dinámico presente en la plantilla, si todavía no tienen
  valor (como cuenta `unresolvedKeys`: `null` o vacío después de `trim`). Se piden con su definición
  normal (`mes_ejecucion` es `text` y `source: 'contract'`), en la misma lista de campos faltantes y en
  el mismo 422 `MISSING_PLACEHOLDERS`.
- El valor se guarda en `contract_overrides` como hoy, así que el listado lo sigue mostrando.
- Vale igual en el `dryRun`, en `reviewDraft` y en la generación.

### 2.3 Revisor (`backend/lib/contractReviewer.js`)

`REVIEW_SYSTEM` pasa a ser el texto de la sección 4: son las reglas actuales más la 6 y la 7. **No
cambian** la entrada (`sectionText`, `dynamicTexts`, `datos`), el esquema de salida ni el modelo.
`datos` ya trae `mes_ejecucion` y `fecha_contrato`, que es lo que necesita la regla 7.

### 2.4 Migración nueva `backend/migrations/202609290003_event_clauses.js`

Sigue el patrón de `202609290001_dynamic_text_clauses.js`:
- una función pura exportada, `rewriteEventClauses(contentJson, code)`;
- verificación exacta de los párrafos contra los de
  **`docs/disenos/prompts/contrato-por-evento.fixtures.json`** (cópialos a la prueba, porque
  `docs/**` es de solo lectura);
- se calculan las 6 reescrituras antes de escribir, con respaldo en `template_content_backup`
  (nota `contrato-por-evento: 2.1 y 2.2 con texto dinámico`);
- `down` restaura desde ese respaldo;
- **no la corras**: la aplica Ignacio.

## 3. Catálogo nuevo (contenido exacto)

| id | label | instruccion | ejemplos |
|---|---|---|---|
| `evento_servicio` | `Evento (cláusula 2.1)` | `Describe el servicio en el evento: qué es el evento, la fecha, la hora y el lugar.` | `asistencia al evento de Caffarena el día 27 de mayo de 2026 a las 18:30 horas en Costanera Center` · `asistencia al lanzamiento de la marca los días 3 y 4 de junio de 2026, de 19:00 a 22:00 horas, en el Hotel W de Santiago` |
| `formato_periodo_publicacion` | `Formato y periodo (cláusula 2.2)` | `Escribe los formatos de publicación y el periodo en que se publicará.` | `Publicación de video, Story o Reel, durante los meses de mayo o junio de 2026` · `Reel o Historia, durante el mes de junio de 2026` |

## 4. `REVIEW_SYSTEM` nuevo (texto exacto)

Son las líneas actuales, con la 6 y la 7 insertadas después de la 5:

```
Eres revisor de redacción de contratos de prestación de servicios de influencers, en español formal de Chile o México.
Recibes la sección SEGUNDO de un contrato ya completada (sectionText), los textos dinámicos que escribió una persona al crearlo (dynamicTexts, con su instrucción) y datos del contrato para contrastar (datos).
Revisa SOLO los textos dinámicos y cómo encajan en su cláusula. No opines sobre el resto del contrato.
Verifica:
1. Gramática y concordancia de la cláusula completa con el texto dinámico puesto: número, género y conectores.
2. Que las cantidades vayan en palabras y en cifra entre paréntesis, como "cinco (5)".
3. Que cada red social nombrada en los entregables esté entre datos.redesDelProveedor, y que la cláusula de cuentas nombre una cuenta para cada red de los entregables, y ninguna red que no esté en ellos.
4. Que el texto dinámico no agregue obligaciones, montos, plazos ni condiciones que no correspondan a lo que pide su instrucción.
5. Registro formal: sin abreviaturas, emojis ni lenguaje coloquial.
6. Si hay un texto dinámico del evento, que diga qué es el evento, la fecha, la hora y el lugar.
7. Fechas coherentes: que la fecha del evento no sea anterior a datos.fecha_contrato, que caiga dentro del periodo de publicación de la cláusula 2.2 si lo hay, y que datos.mes_ejecucion calce con ese periodo.
No inventes datos. Si falta información para decidir, dilo como observación.
Responde con verdict "ok" y observations vacía si no hay nada que corregir. Si hay algo, verdict "observaciones" y una observación por problema: dynamicTextId, clause (el número de cláusula, como "2.3"), problem (en una frase) y suggestion (el texto dinámico completo reescrito, listo para reemplazar al actual; nunca otra parte de la cláusula).
```

## 5. Reescrituras de la migración

El nodo `variable` nuevo copia los `attrs` de formato (`bold`, `italic`, `underline`,
`uppercase`: todos `false` hoy) y lleva `group: 'contrato'`, más el `variableId` y el `label` del
catálogo. Los nodos que no se nombran quedan idénticos.

**2.1** (variantes `negrita` y `normal`, que solo difieren en la marca de `{{company_nombre_comercial}}`,
que se conserva). El último nodo de texto,

` y el Influencer, en virtud de la cual, esta último prestará servicios de generación de contenido para redes sociales, en los cuales publicará videos y recomendaciones del Producto (en adelante, los “Servicios”).`

se parte en tres:

` y el Influencer, en virtud de la cual, esta último prestará servicios de ` · ⟨`evento_servicio`⟩ ·
` y generación de contenido para redes sociales, en los cuales publicará videos y recomendaciones del Producto (en adelante, los “Servicios”).`

**2.2, variante `CL`** (0003, 0006, 0009, 0012, 0015): `2.2 ` (negrita) ·
`Dicho contenido deberá ser publicitado a través de las redes sociales del Influencer (i.e. “Instagram, Facebook y/o Tik Tok”), bajo el formato de `
· ⟨`formato_periodo_publicacion`⟩ · `.`

Desaparecen `Historia o Reel, durante el mes de ` y `{{mes_ejecucion}}`.

**2.2, variante `MX`** (0017): el mismo resultado. Desaparece
`Publicación de video, Story o Reel, durante el periodo que se indique expresamente en el presente Contrato o en los Anexos correspondientes, según resulte aplicable.`

## 6. Pruebas existentes

**Dos pruebas existentes ya afirman el comportamiento nuevo** (commit de Ignacio sobre la base,
autorizado por David el 29-sep). **No las modifiques: haz que pasen.**
- `backend/test/contractReviewer.test.js`: `EXPECTED_SYSTEM` es el texto de la sección 4.
- `backend/test/dynamicText.test.js`, `Unknown id is undefined`: ahora usa un id que no existe en
  ningún catálogo, en vez de `evento_servicio`.

Ninguna otra prueba existente cambia. **No modifiques ningún otro archivo de prueba existente.** Si
cualquier otra prueba existente falla, **no la ajustes: consulta a la mesa.**

## 7. Pruebas nuevas

**Todas en archivos nuevos**:
- **`backend/test/eventClausesMigration.test.js`**, sobre `rewriteEventClauses` con los fixtures:
  - cada variante queda como en la sección 5 (texto plano con `{{id}}` y nodos variable nuevos);
  - las marcas de `{{company_nombre_comercial}}` se conservan en cada variante;
  - el resto del documento queda idéntico y la entrada no cambia;
  - lanza si un párrafo no calza o si el código no es de las 6.
- **`backend/test/dynamicTextRequiere.test.js`**:
  - una plantilla con `{{formato_periodo_publicacion}}` y sin `{{mes_ejecucion}}` en el texto, en
    `dryRun` sin overrides, pide los dos, y `mes_ejecucion` como `text`;
  - con `mes_ejecucion` en los overrides, ya no lo pide, y lo guarda en `contract_overrides` (con una
    revisión `ok`, como en `documentBuilderService.review.test.js`);
  - una plantilla con `{{servicios_entregables}}` y sin `{{mes_ejecucion}}` **no** pide
    `mes_ejecucion`.
- **`backend/test/dynamicTextCatalogEvento.test.js`**: las dos entradas nuevas tienen el `label`, la
  `instruccion` y los `ejemplos` exactos de la sección 3; `formato_periodo_publicacion` tiene
  `requiere: ['mes_ejecucion']`, y `servicios_entregables` y `cuentas_publicacion` no tienen
  `requiere`.

## 8. Restricciones y puntos de atención

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`,
  `.agent-orchestrator/**`. Las migraciones existentes no se editan. Nada que se conecte a la base.
- Mensajes, documentación y commits en español.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y
  `cd frontend && npm run lint`. Las tres en verde; el lint, con 0 errores.
