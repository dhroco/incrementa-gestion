# Dominio · texto dinámico en las cláusulas del objeto (2.1, 2.2 y 2.3)

> Propuesta de Ignacio (arquitecto), 29-sep-2026, a partir de la conversación de David con Marcela.
> **Estado: propuesta.** Las decisiones marcadas «⚖ David» están abiertas. Todavía no hay recortes.

## 1. Qué pide el negocio

1. **Cláusula 2.3 (casi todas las plantillas).** El entregable no siempre es «N reels en el formato
   X en una red». Puede ser «cinco (5) reels en TikTok y cuatro (4) reels en Facebook». Hoy la 2.3
   tiene dos variables en singular incrustadas (`cantidad_reels`, `formato_reel`) y no puede
   expresarlo. Es el Tema 3 de Marcela.
2. **Cláusulas 2.1, 2.2 y 2.3 en los contratos por evento.** Hay que describir el evento (qué,
   cuándo, dónde) y a veces cambian los formatos y el periodo de publicación. Es el Tema 5.
3. Para las dos cosas, un **texto dinámico**: lo redacta quien completa el contrato, en el momento de
   crearlo, y queda incrustado en la cláusula.
4. **Un agente revisa** que la cláusula completa, con los textos dinámicos ya puestos, quede bien
   redactada antes de generar el contrato.

## 2. Lo que se encontró en las plantillas (pre-prod, solo lectura, 29-sep)

Son 21 plantillas: CONTRATO_0001–0015 (Chile), CONTRATO_0016–0017 (México) y PL0001–PL0004 (Chile, una
versión más antigua).

**La 2.1 y la 2.2 son iguales en las 21**, salvo el periodo de las mexicanas:

> 2.1 … prestará servicios de generación de contenido para redes sociales, en los cuales publicará
> videos y recomendaciones del Producto (en adelante, los “Servicios”).
>
> 2.2 … (i.e. “Instagram, Facebook y/o Tik Tok”), bajo el formato de Historia o Reel, durante el
> mes de `{{mes_ejecucion}}`.

**La 2.3 tiene tres patrones:**

| Plantillas | Texto de la 2.3 |
|---|---|
| 0001–0015 (0008 agrega «bajo la colaboración pagada») | …la generación y publicación de `{{cantidad_reels}} {{formato_reel}}` en el perfil de `{{proveedor_red_social}}` del Influencer y en el perfil oficial `{{client_product_campaign}}`. |
| 0016–0017 | …de `{{cantidad_reels}} {{formato_reel}}` en `{{proveedor_red_social}}`, que debe ser publicado tanto en el perfil de Instagram del Influencer, como en el de `{{client_brand}}`, bajo la modalidad de “colaboración pagada”… |
| PL0001–PL0004 | …de `{{cantidad_reels}}` **reel** en el perfil de `{{proveedor_red_social}}` del Influencer… (el formato está escrito a mano) |

**Hallazgo importante: las plantillas «con Evento» no mencionan el evento.** CONTRATO_0003, 0006,
0009, 0012, 0015 y 0017 tienen la 2.1, la 2.2 y la 2.3 **idénticas** a las que no son por evento. La
única mención es una línea de título. Hoy un contrato por evento no puede salir bien del sistema sin
editarlo a mano. Son 6 plantillas: 5 chilenas más la mexicana, que calzan con los «cinco tipos por
evento» de Marcela.

**Cláusulas que dependen de la 2.3:**
- **La 2.5 dice «Instagram» escrito a mano** en 16 plantillas (0001–0016), junto a la cuenta del
  influencer, y se declara «elemento esencial del acuerdo». Es un defecto ya conocido (postergado el
  4-sep). Si la 2.3 pasa a decir «reels en TikTok y Facebook», la 2.5 lo contradice.
- **La 2.7 remite a «el contenido referido en la cláusula 2.3»** en 19 plantillas.

**El contrato de ejemplo** (Caffarena, mayo 2026, por evento) muestra lo que el sistema tiene que
poder producir:

> **2.1** … prestará servicios de **asistencia al evento de Caffarena el día 27 de mayo a las 18:30
> en Costanera Center y** generación de contenido para redes sociales…
>
> **2.2** … bajo el formato de **Publicación de video, Story o Reel**, durante **los meses de mayo o
> junio 2026**.
>
> **2.3** … la generación y publicación de **un (1) story en Instagram, que debe ser publicado en el
> perfil de Instagram del Influencer**.

## 3. Propuesta

### 3.1 El texto dinámico es un tipo nuevo de variable

Hoy una variable es un nodo `variable` dentro de la plantilla (TipTap), definido en el catálogo
(`VARIABLE_META` en el backend y `variableCatalog.js` en el frontend) con un `type` (`text`, `date`,
`number` o `select`). **El texto dinámico es un `type` nuevo, `dynamic_text`**, con `source: 'contract'`.
Todo lo que ya existe para las variables del contrato sirve igual: se detecta como campo faltante, se
pide en el Constructor y en el MCP, y se guarda en `contract_overrides` y en el snapshot del borrador.

Cada texto dinámico se define **una sola vez en el catálogo**, no en cada plantilla:

| Campo | Para qué |
|---|---|
| `label` | El nombre que ve quien completa |
| `instruccion` | Qué escribir, en una frase |
| `ejemplos` | Dos o tres ejemplos reales |
| `encaje` | La frase de la plantilla que lo rodea. El Constructor la muestra con el hueco resaltado, y el agente la usa para revisar |
| `reglas` | Lo que el agente tiene que verificar para ese texto (sección 3.3) |

En el editor de plantillas se inserta como cualquier variable, pero se ve con otro color para que
Marcela los distinga.

### 3.2 Los textos dinámicos propuestos

| Id | Cláusula | Plantillas | Queda así (ejemplo) |
|---|---|---|---|
| `servicios_entregables` | 2.3 | las 21 | …la generación y publicación de ⟨**cinco (5) reels en TikTok y cuatro (4) reels en Facebook**⟩ en los perfiles del Influencer y en el perfil oficial `{{client_product_campaign}}`. |
| `evento_servicio` | 2.1 | las 6 «con Evento» | …prestará servicios de ⟨**asistencia al evento de Caffarena el día 27 de mayo a las 18:30 en Costanera Center**⟩ y generación de contenido para redes sociales… |
| `formato_periodo_publicacion` | 2.2 | las 6 «con Evento» | …bajo el formato de ⟨**Publicación de video, Story o Reel, durante los meses de mayo o junio de 2026**⟩. |

- `servicios_entregables` **reemplaza** a `cantidad_reels`, `formato_reel` y `proveedor_red_social`
  en la 2.3. Esas variables dejan de usarse ahí y siguen donde aparezcan fuera de la 2.3.
- En las 15 plantillas que no son por evento, la 2.1 y la 2.2 quedan como están.

⚖ **David:**
- **(a)** ¿El evento va como texto dinámico, o como 4 variables fijas (nombre del evento, fecha, hora
  y lugar)? El texto dinámico da libertad. Las variables fijas se equivocan menos y permiten
  validar fechas. **Recomiendo texto dinámico con revisión**, porque el evento puede tener más de
  una jornada o sede.
- **(b)** En las plantillas por evento, ¿el periodo de la 2.2 deja de ser `{{mes_ejecucion}}`? Si es
  así, el listado de contratos pierde el mes de ejecución en esos contratos, porque hoy lo lee de
  ahí.
- **(c)** ¿Qué pasa con la 2.5 («Instagram» escrito a mano)? Recomiendo arreglarla **en el mismo
  recorte** que la 2.3: si se hace después, un contrato multi-red sale con una contradicción en una
  cláusula esencial.

### 3.3 La revisión del agente

**Cuándo.** Con todos los campos completos y **antes de generar el PDF**. En el Constructor es un
paso nuevo, «Revisar redacción»; en el MCP, una herramienta nueva, `revisar_redaccion`, que se llama
antes de `generar_contrato`.

**Qué recibe:**
- el texto final de la sección SEGUNDO completa (2.1 a 2.8), con los textos dinámicos marcados;
- la definición de cada texto dinámico (`encaje` y `reglas`);
- los datos del contrato que sirven para contrastar: redes y cuentas del proveedor, mes de ejecución
  y fecha del contrato.

**No recibe** RUT, direcciones ni precio.

**Qué verifica:**
1. **Gramática y concordancia** de la cláusula completa, no solo del texto dinámico: número, género y
   conectores con la frase que lo rodea.
2. **Cantidades en palabras y cifra**, como el resto del contrato: «cinco (5)».
3. **Coherencia con las redes del proveedor**: cada red nombrada en la 2.3 existe entre las del
   proveedor, y la 2.5 no la contradice.
4. **Evento completo**: la 2.1 dice qué es el evento, la fecha, la hora y el lugar.
5. **Fechas coherentes**: el evento cae dentro del periodo de la 2.2 y no es anterior a la fecha del
   contrato.
6. **Que el texto dinámico no meta obligaciones, montos ni plazos** que no correspondan a esa
   cláusula.
7. **Registro formal**, sin abreviaturas ni lenguaje coloquial.

**Qué devuelve:** un veredicto estructurado, `ok` u `observaciones`. Cada observación dice qué texto
dinámico, en qué cláusula, cuál es el problema y una sugerencia de reescritura **solo del texto
dinámico**.

**Lo que el agente nunca hace:** cambiar el texto sin que el usuario lo vea, ni tocar la plantilla. El
usuario **acepta la sugerencia con un clic o edita el texto**, y se vuelve a revisar. Es el mismo
principio del RUT y del precio: el sistema no decide por el usuario.

**Evidencia.** Cada revisión se guarda con el borrador: fecha, modelo, textos revisados y veredicto.

⚖ **David:**
- **(d)** ¿Generar el PDF exige la última revisión en `ok`? ¿O se permite «generar igual» dejando
  registrado quién lo hizo y por qué? Recomiendo **permitirlo con registro**: la revisión es una
  ayuda, y quien firma es Yerko.
- **(e)** ~~Tecnología y costo~~ → **decidido (David, 29-sep): se usa la API de Claude** (sección 3.4).

### 3.4 Con qué se hace la revisión

Con la **API de Claude desde el backend** (`@anthropic-ai/sdk`), modelo `claude-opus-5`, con salida
estructurada: un esquema JSON en `output_config.format`, así el veredicto siempre llega con la misma
forma.

- **Costo estimado:** unos US$0,10 por revisión (≈5K tokens de entrada, ≈3K de salida, a US$5 y
  US$25 por millón). Con 100 contratos al mes y dos revisiones cada uno, **≈US$20 al mes**.
- **Requiere:**
  - una dependencia nueva;
  - la clave `ANTHROPIC_API_KEY` en Secret Manager;
  - aceptar que el texto de la sección SEGUNDO sale a Anthropic. Ese texto incluye el nombre de la
    marca y la cuenta del influencer, pero no RUT, direcciones ni precio.

  Las tres cosas son del umbral de David: stack, costos y datos personales. **Aceptadas por David el 29-sep.**
- **Por qué no usar solo el agente del MCP:** el flujo web no lo tiene. Además, quien escribe el
  texto no debería ser quien lo revisa.

### 3.5 Cómo cambian las plantillas

Con una migración que guarda un respaldo y verifica el texto exacto de cada patrón, como la de la
moneda. Si una plantilla no calza, falla sin escribir nada. Son:
- los 3 patrones de la 2.3 en las 21 plantillas;
- la 2.1 y la 2.2 en las 6 por evento.

Después, Marcela puede ajustar cualquier plantilla desde el editor.

## 4. Recortes propuestos (en orden)

1. **`texto-dinamico-base`.** El tipo `dynamic_text` en el catálogo (back y front), el área de
   texto con instrucción, ejemplos y vista previa en el Constructor, y el soporte en el MCP. El
   primer texto es `servicios_entregables`, con la migración de la 2.3 en las 21 plantillas (y de
   la 2.5, si se decide así en la **(c)**).
2. **`revision-redaccion`.** El servicio de revisión con Claude, el paso «Revisar redacción» en el
   Constructor, la herramienta MCP y la evidencia guardada.
3. **`contrato-por-evento`.** `evento_servicio` y `formato_periodo_publicacion`, con la migración de
   la 2.1 y la 2.2 en las 6 plantillas por evento, más las reglas 4 y 5 del agente.

Los recortes 1 y 2 se despliegan juntos a producción, para que ningún contrato real salga con texto
dinámico sin revisar. En pre-prod pueden ir separados.

## 5. Qué queda fuera

- El anexo de entregables (Tema 3, opción B): el texto dinámico con revisión lo reemplaza y cubre
  además la 2.1 y la 2.2.
- Precio por red o por entregable (Tema 3, pregunta abierta de Marcela). El precio sigue siendo uno
  solo.
- Otras cláusulas con texto dinámico. El mecanismo sirve para cualquiera, pero se empieza por estas
  tres.
