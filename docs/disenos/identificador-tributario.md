# Dominio · identificador tributario

> Diseño de Ignacio (arquitecto), 28-sep-2026. Decisiones de producto de David, mismo día.

## Qué es

Cómo el sistema recibe, valida, guarda y muestra el identificador tributario de empresas,
representantes legales y proveedores. Desde el change `identificador-tributario-por-pais`
(desplegado el 4-sep) el proveedor tiene país y su identificador es **tipo + número** contra el
catálogo `identity_document_type`: RUT para Chile (`validator_key = rut_cl`), RFC para México. Las
empresas y sus representantes legales siguen siendo solo chilenos y usan `parseRut` directo.

## El problema que abre el dominio

`parseRut` (hay dos copias equivalentes: `backend/utils/rut.js` y `frontend/src/utils/rut.js`)
**no rechaza un dígito verificador equivocado: lo reemplaza sin avisar.** `12.345.678-9` se acepta
y se guarda como `12.345.678-5`. Un dedazo produce un RUT distinto del que se escribió, y ese RUT
sale impreso en un contrato. Es a propósito en el código («típico error de tipeo»), y es el mismo
patrón del Tema 2.1 de Marcela: el sistema decide por el usuario en vez de preguntar. Hallazgo
colateral del Tema 4 (`docs/observaciones-marcela.md`).

Hay un segundo defecto, que impide arreglar el primero por sí solo: el sistema **adivina si la
entrada trae dígito verificador** por el largo (8 caracteres o menos, sin dígito; 9, con dígito).
Para los RUT de 7 dígitos esa regla es ambigua:

| Lo que se escribe | Hoy se interpreta como | Debería ser |
|---|---|---|
| `1.234.567-9` (dígito equivocado; son 8 caracteres) | cuerpo `1234567`, el 9 se descarta, dígito calculado `4` | rechazo |
| `12345678` | cuerpo `12345678` sin dígito, se calcula `5` | cuerpo `1234567` + dígito `8`; es incorrecto (sería `4`), así que se rechaza |

## Decisión (David, 28-sep)

**El dígito verificador es obligatorio.** El último carácter de la entrada es siempre el dígito
verificador, venga o no con guion. Si no calza con el módulo 11, se rechaza con un mensaje en
español. El sistema deja de calcular o corregir el dígito a partir de la entrada.

Se descartó que el dígito fuera «opcional si no hay guion»: deja vivo el caso de los RUT de 7
dígitos escritos sin guion.

Consecuencias aceptadas:
- Quien hoy escribe el RUT sin dígito ve un error y tiene que escribirlo completo.
- La validación alcanza a todos los canales, porque todos pasan por `parseRut`: la interfaz web
  (empresas, representantes legales y proveedores) y el MCP (el agente recibe el error y tiene que
  preguntarle a la persona, no corregir por su cuenta).
- Los RUT ya guardados **no se tocan**: siempre se guardaron con el dígito calculado, así que son
  válidos por construcción.

## Recortes

En `identificador-tributario.recortes.yaml`:
1. `rut-dv-estricto`: completado y desplegado en pre-prod el 28-sep.
2. `rut-rep-legal-prueba`: una prueba para un borde que quedó sin cubrir (el RUT del representante
   legal con el dígito equivocado en el formulario de empresa). No cambia código.

## Qué queda fuera

- **La moneda de las plantillas mexicanas** (CONTRATO_0016 en USD sale con formato chileno). Es
  otro hallazgo del Tema 4, probablemente toca el modelo de datos y va en un recorte propio.
- **El ejemplo del placeholder, `12.345.678-9`, tiene el dígito equivocado** (el correcto es `-5`).
  Viene de `openspec/config.yaml → locale.rut_format`, que es de solo lectura para las corridas. Si
  se corrige, lo hace David fuera de la corrida.
- **Unificar las dos copias de `parseRut`** (back y front) en un paquete compartido. Es otro
  cambio, de estructura del monorepo.
- **El RFC mexicano y otros países.** Siguen con su validador por patrón, sin cambios.
- **Revalidar datos guardados.** No hay migración ni barrido de la base.
