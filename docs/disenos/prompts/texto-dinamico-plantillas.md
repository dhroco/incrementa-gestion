# Recorte · texto-dinamico-plantillas

> Encargo de Ignacio (arquitecto), 29-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/texto-dinamico.md`. Depende de `texto-dinamico-base`, que crea el tipo
> `dynamic_text` y los textos `servicios_entregables` y `cuentas_publicacion`.

## 1. Objetivo

Hoy la cláusula 2.3 describe el entregable con variables en singular (`cantidad_reels`,
`formato_reel`, `proveedor_red_social`) y no puede decir «cinco (5) reels en TikTok y cuatro (4)
reels en Facebook». Además, la cláusula de la cuenta dice «en Instagram», escrito a mano, aunque el
contrato sea de otra red.

Al terminar:
- **la 2.3 de las 21 plantillas** usa el texto dinámico `servicios_entregables`;
- **la cláusula de la cuenta** (la 2.5 en CONTRATO_0001–0016, la 2.6 en PL0001–PL0004) usa
  `cuentas_publicacion` y ya no nombra una red;
- **el listado de contratos** sigue mostrando la red social: para los contratos nuevos, muestra los
  entregables.

## 2. Arquitectura

- **Migración nueva** `backend/migrations/202609290001_dynamic_text_clauses.js`, con el patrón de
  `202609280002_mx_price_clause_usd.js`:
  - una función pura exportada `rewriteDynamicTextClauses(contentJson, code)` que aplica, **según la
    variante que corresponda a `code`**, la reescritura de la 2.3 y la de la cláusula de la cuenta
    (sección 3);
  - verificación exacta de cada párrafo antes de reescribir. Si un párrafo no calza, `Error` con
    el código de la plantilla y lo que no calzó;
  - en `up`: primero calcula la reescritura de **las 21**, y solo si todas calzan guarda el respaldo
    en `template_content_backup` (nota `texto-dinamico-plantillas: 2.3 y cuenta con texto dinámico`)
    y actualiza. Si falta alguna de las 21, falla sin escribir nada;
  - en `down`: restaura desde el respaldo con esa nota y lo borra.
- **Listado de contratos**:
  - `contractsQueryService.mapContractListItem` agrega `servicios_entregables`, leído de
    `contract_overrides`;
  - el filtro que hoy busca en `contract_overrides->>'proveedor_red_social'` busca también en
    `contract_overrides->>'servicios_entregables'` (un `OR`, con el mismo `ILIKE`);
  - en `ContractsListPage.jsx`, la celda de la red social muestra `servicios_entregables` si viene,
    y si no, lo de hoy.
- **No cambian** el catálogo, el Constructor, el MCP ni la generación del PDF: todo eso ya lo hizo
  `texto-dinamico-base`.

## 3. Reescrituras

Los párrafos exactos de hoy, por variante y con las plantillas en que aparecen, están en
**`docs/disenos/prompts/texto-dinamico-plantillas.fixtures.json`** (leídos de pre-producción el
29-sep). Úsalos como la verificación exacta de la migración y como fixtures de las pruebas: cópialos
al archivo de prueba, porque `docs/**` es de solo lectura.

En cada variante, el nodo `variable` nuevo copia los `attrs` de formato (`bold`, `italic`,
`underline`, `uppercase`) de la primera variable que reemplaza y lleva `group: 'contrato'`,
`variableId` y `label` del catálogo. Los nodos que no se nombran quedan idénticos.

### 3.1 La 2.3

Redacción aprobada por David el 29-sep, incluida «en el o los perfiles» y el «contenido que» de las
mexicanas.

| Variante | Queda así |
|---|---|
| `A` (14 plantillas) | `2.3 ` (negrita) · `En concreto, los Servicios comprenden la generación y publicación de ` · ⟨`servicios_entregables`⟩ · `, en el o los perfiles del Influencer y en el perfil oficial ` · `{{client_product_campaign}}` · `.` |
| `A_colaboracion` (CONTRATO_0008) | igual que `A`, pero el último nodo es ` bajo la colaboración pagada.` |
| `MX` (0016, 0017) | `2.3 ` · `En concreto, los Servicios comprenden la generación y publicación de ` · ⟨`servicios_entregables`⟩ · `, contenido que debe ser publicado tanto en el o los perfiles del Influencer, como en el de ` · `{{client_brand}}` · `, bajo la modalidad de “colaboración pagada” identificando la cuenta ` · `{{client_brand_account}}` · `.` |
| `PL` (PL0001–0004) | `2.3 En concreto, los Servicios comprenden la generación y publicación de ` · ⟨`servicios_entregables`⟩ · `, en el o los perfiles del Influencer y en el perfil oficial ` · `{{client_brand_account}}` · `.` |

En todas desaparecen `cantidad_reels`, `formato_reel` y `proveedor_red_social` de la 2.3, y en la `MX`
desaparece también «de Instagram».

### 3.2 La cláusula de la cuenta

| Variante | Queda así |
|---|---|
| `A_negrita` y `A` (2.5 en 0001–0015) | `2.5 ` · `El Influencer deberá publicar el contenido a través de ` · ⟨`cuentas_publicacion`⟩ · `. Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de ` · `{{company_nombre_comercial}}` (con sus marcas de hoy, que son distintas en cada variante) · ` para celebrar el presente Contrato.` |
| `MX` (2.5 en 0016) | igual, pero con `se obliga a publicar` en lugar de `deberá publicar` |
| `PL` (2.6 en PL0001–0004) | `2.6 El Influencer deberá publicar el contenido a través de ` · ⟨`cuentas_publicacion`⟩ · `. Esta condición es un elemento esencial…` (el resto igual) |

- En la `A` se agrega el punto que hoy falta antes de «Esta condición».
- Además de «en Instagram», desaparecen de la cláusula `proveedor_red_social` (solo en `PL`) y
  `proveedor_cuenta_social`, porque la cuenta queda dentro de `cuentas_publicacion`.
- **CONTRATO_0017 no tiene cláusula de cuenta** (su 2.5 es el reporte de resultados): no se toca.

## 4. Recomendaciones

- Una tabla de variantes (código → variante de la 2.3 y de la cuenta) al inicio de la migración, y
  una sola función que reemplace un párrafo verificado por nodos nuevos, se leen mejor que 21 casos.
- La verificación compara `type`, `text` y `attrs.variableId` de cada nodo, y las marcas de los
  nodos de texto.

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`,
  `.agent-orchestrator/**`.
- **Las migraciones existentes no se editan**: solo se agrega la nueva. **No la corras** ni nada que
  se conecte a la base: la aplica Ignacio después de fusionar.
- Mensajes, documentación y commits en español.

## 6. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente.** Las pruebas
del listado (`contractsQueryService.test.js`, `contractsApi.test.js`) no traen
`servicios_entregables`, así que tienen que seguir pasando igual. Si cualquier prueba existente
falla, **no la ajustes: consulta a la mesa.**

## 7. Pruebas nuevas

**Todas en archivos nuevos**:
- **`backend/test/dynamicTextClausesMigration.test.js`**, sobre `rewriteDynamicTextClauses`, con los
  párrafos de los fixtures envueltos en un `doc` junto a otro párrafo cualquiera:
  - cada variante de la 2.3 y de la cuenta queda como en la sección 3. Compara el texto plano, con
    las variables como `{{id}}`, y los nodos variable nuevos;
  - todo lo demás del documento queda idéntico, y el documento de entrada no cambia;
  - CONTRATO_0017 reescribe la 2.3 y no toca su 2.5;
  - lanza si un párrafo no calza (por ejemplo, un documento ya reescrito) y si el código no está en
    la tabla.
- **`backend/test/contractsQueryService.entregables.test.js`**: un contrato con
  `servicios_entregables` en `contract_overrides` lo trae en el ítem del listado; el filtro por red
  social encuentra un contrato por una red nombrada solo en `servicios_entregables`.
- **`frontend/src/pages/ContractsListPage.entregables.test.jsx`**: la celda muestra
  `servicios_entregables` cuando viene y la red social de hoy cuando no.

## 8. Puntos de atención

- Revisa en el `down` de `202609280002_mx_price_clause_usd.js` cómo se restaura desde el respaldo:
  aquí es igual, con otra nota.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y
  `cd frontend && npm run lint`. Las tres en verde; el lint, con 0 errores.
