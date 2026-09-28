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

Uno: `moneda-plantilla-usd`, en `moneda-plantilla.recortes.yaml`.

## Qué queda fuera

- **Montos con decimales (centavos).** El precio sigue siendo entero, como hoy.
- **Una entrada escrita con coma de miles** (`1,290`) hoy se lee como `1`, y eso pasa también en
  CLP. Es un defecto previo, del mismo patrón «el sistema decide por el usuario», y merece su
  propio recorte.
- **Elegir la moneda desde la interfaz** de plantillas. El país tampoco se elige ahí: ambos se
  fijan por migración.
- **Otras monedas.** Agregar una exige migración y código.
- **Los contratos ya generados** con la 0016 o la 0017. Son PDF emitidos y no se tocan.
