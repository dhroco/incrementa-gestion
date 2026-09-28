# Dominio · moneda de la plantilla

> Diseño de Ignacio (arquitecto), 28-sep-2026. Decisiones de producto de David, mismo día.

## Qué es

En qué moneda se expresa el precio de un contrato y cómo se escribe. Hoy la moneda **no existe**
en el sistema: ni la plantilla ni el contrato la guardan. El precio lo escribe
`preprocessMissingFieldOverrides` (`backend/services/documentBuilderService.js`) siempre a la
chilena: `precio_numero` = `$` + separador de miles `es-CL`, y `precio_texto` = el número en
palabras, sin moneda. La moneda la pone, cuando la pone, el texto fijo de la plantilla.

## El problema que abre el dominio

Hallazgo colateral del Tema 4 de Marcela (`docs/observaciones-marcela.md`): CONTRATO_0016 es en
dólares y el precio sale con formato chileno. Al leer las plantillas de pre-producción (28-sep,
solo lectura) apareció algo peor. La cláusula 3.1 de **CONTRATO_0016 y CONTRATO_0017** (idéntica
en las dos) dice:

> …corresponderá a una cantidad fija y única en moneda de curso legal en **(Tipo de moneda País)**,
> de `{{precio_numero}}` `{{precio_texto}}` líquido, más el Impuesto al Valor Agregado…

Un contrato mexicano sale hoy así: «…en moneda de curso legal en (Tipo de moneda País), de $290
doscientos noventa líquido…». Son tres defectos:

1. El texto de relleno «(Tipo de moneda País)» se imprime tal cual.
2. El número sale con formato chileno (`$` y `.` de miles).
3. El precio en texto no dice la moneda ni va entre paréntesis. Las chilenas dicen «en pesos
   chilenos, de $X + IVA (X)».

El «USD» que vio Marcela no está en ninguna plantilla: lo escribió ella al generar el contrato.

## Decisión (David, 28-sep)

**La moneda es fija por plantilla.** Nadie la elige al generar un contrato.

- `template` gana la columna `currency_code`: `CLP` o `USD`, obligatoria, `CLP` por omisión.
  CONTRATO_0016 y CONTRATO_0017 quedan en `USD`, y todas las demás en `CLP`.
- El formato de `precio_numero` sale de esa columna. En `CLP` queda igual que hoy (`$1.290`). En
  `USD` es `US$1,290`, con coma de miles.
- `precio_texto` no cambia: son las palabras del número. La moneda en palabras la pone la
  plantilla.
- La cláusula 3.1 de la 0016 y la 0017 queda así (redacción aprobada por David):

  > …corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de
  > **US$1,290** (**mil doscientos noventa dólares de los Estados Unidos de América**) líquido, más
  > el Impuesto al Valor Agregado…

- Las plantillas chilenas no cambian en nada.

Se descartó sacar la moneda del país de la plantilla: México con dólares, no con pesos mexicanos,
muestra que país y moneda son cosas distintas.

## Recortes

En `moneda-plantilla.recortes.yaml`:
1. `moneda-plantilla-usd`: completado y desplegado en pre-prod el 28-sep.
2. `precio-entero-estricto`: ver más abajo.

## El precio mal escrito (segundo recorte)

`parseIntegerOverride` le quita los puntos a la entrada y aplica `parseInt`. Todo lo que no calza
lo cambia **sin avisar**: `1,290` → `1`, `1290.50` → `129050`, `12,5` → `12`, `290 USD` → `290`. Con
las plantillas en dólares el riesgo aumentó, porque ahí lo natural es escribir `1,290`: el contrato
saldría por **US$1**. Es el mismo patrón del RUT: el sistema decide por el usuario.

**Regla (de Ignacio, 28-sep, como validación de entrada; David eligió el recorte): se rechaza todo lo que no sea un entero limpio.** Se acepta `1290`, o
el número agrupado de a tres con **un solo tipo** de separador (`1.290`, `1.500.000`, `1,290`,
`1,500,000`). Todo lo demás (decimales, símbolos, letras, espacios internos, grupos mal formados,
negativos) se rechaza con un mensaje en español, sin generar el contrato. Se descartó aceptar la
coma solo en USD: la regla es la misma en las dos monedas.

## Qué queda fuera

- **Montos con decimales (centavos).** El precio sigue siendo entero, como hoy.
- **Elegir la moneda desde la interfaz** de plantillas. El país tampoco se elige ahí: ambos se
  fijan por migración.
- **Otras monedas.** Agregar una exige migración y código.
- **Los contratos ya generados** con la 0016 o la 0017. Son PDF emitidos y no se tocan.
