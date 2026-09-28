## Context

`parseRut` existe en dos copias equivalentes: `backend/utils/rut.js` y `frontend/src/utils/rut.js`. Hoy compacta la entrada, descarta cualquier carácter que no sea dígito o `K`, y decide por el largo si el último carácter es el dígito verificador (`<= 8` → cuerpo solo y dígito calculado; `> 8` → último carácter). Si el dígito no calza con el módulo 11, lo reemplaza. El comentario del backend lo llama «típico error de tipeo».

Eso guarda un RUT distinto del escrito. `12.345.678-9` queda `12.345.678-5` y puede imprimirse en un contrato. En un RUT de 7 dígitos la regla del largo es ambigua: `1.234.567-9` se lee como cuerpo sin dígito y se autocorrige a `4`.

Empresa y representante legal llaman `parseRut` desde `companyService` (`validateCompanyPayload`, `parseRepRutFromPayload`). El proveedor chileno entra por `identityDocument.validateRutCl`, que solo reenvía el resultado de `parseRut`. REST y MCP usan esos services. El frontend valida con la misma función y, al perder el foco, `RutInput` llama `formatRutInput`.

Los RUT ya persistidos se guardaron con el dígito calculado: son válidos por construcción. No hay que reescribirlos.

## Goals / Non-Goals

**Goals:**

- El último carácter de la entrada compacta es siempre el dígito verificador.
- Si no corresponde al módulo 11, `parseRut` rechaza. No calcula ni reemplaza el dígito.
- Un carácter extraño en el cuerpo se rechaza; no se borra en silencio.
- Las dos copias comparten estructura, criterios y el mismo texto de error.
- Las pruebas nuevas de la sección 7 del encargo, más las dos pruebas ya en rojo de cada copia, quedan en verde.

**Non-Goals:**

- Cambiar la firma o el contrato de `computeRutDv`, `normalizeRutInput`, `formatRut`, `formatRutDisplay`, `formatRutInput`, `parseOptionalRut` o `RutInput`.
- Tocar llamadores (`companyService.js`, `identityDocument.js`, formularios, MCP) si las pruebas existentes siguen pasando.
- Unificar las dos copias en un paquete compartido.
- Migraciones, seeds, esquema, contrato HTTP, dependencias.
- Corregir `RUT_INPUT_PLACEHOLDER` (`12.345.678-9`). Viene de `openspec/config.yaml` y queda como está. No se usa como RUT válido en ninguna prueba.
- RFC y los demás validadores por patrón.
- Revalidar filas ya guardadas.

## Decisions

### D1 — El dígito es el último carácter, siempre

Sobre la entrada ya compactada por `normalizeRutInput` (sin espacios, puntos ni guiones) y con `k` en mayúscula:

1. Vacía → `{ ok: false }`, mensaje «El RUT es obligatorio.», código `RUT_EMPTY` solo en el backend.
2. Último carácter = dígito verificador; el resto = cuerpo.
3. Cuerpo que no sea solo dígitos, o de largo distinto de 7 u 8 → «El RUT ingresado no es válido.», código `RUT_INVALID`.
4. Dígito que no sea `0`–`9` ni `K` → `RUT_INVALID`, mismo mensaje.
5. Dígito distinto de `computeRutDv(cuerpo)` → «El dígito verificador no corresponde al RUT ingresado.», código `RUT_DV_MISMATCH`.
6. Si calza → `ok: true` con el cuerpo y el dígito tal como quedaron (`k` → `K`).

La forma del resultado no cambia: backend `{ ok, rut_body, rut_dv }` o `{ ok: false, code, message }`; frontend `{ ok, rutBody, rutDv }` o `{ ok: false, message }`.

Se descarta dejar el dígito opcional cuando no hay guion. Esa regla es la que hace ambiguos los RUT de 7 dígitos (`12345678` hoy se toma como cuerpo de 8 y se le calcula `5`; con la regla nueva es cuerpo `1234567` + dígito `8`, y se rechaza porque el correcto es `4`).

### D2 — Rechazar, no corregir

Se borra la rama que asigna `dv = expected` y el comentario «típico error de tipeo». `computeRutDv` se usa solo para comparar. La respuesta de error no incluye el dígito esperado ni el valor ingresado.

### D3 — Dejar de filtrar con `[^0-9kK]`

Hoy `replace(/[^0-9kK]/g, '')` borra una `K` metida en el cuerpo (`1K34567-4` perdería la `K` y podría colar). La compactación queda en lo que ya hace `normalizeRutInput` más la mayúscula. Cualquier otro carácter sigue en el cuerpo y cae en `RUT_INVALID`.

### D4 — Dos copias, una estructura

Se reescribe el cuerpo de `parseRut` en cada archivo con el mismo orden de reglas y los mismos mensajes. El JSDoc del backend deja de decir «with/without DV (heuristic…)». No se extrae un módulo común.

### D5 — Los llamadores no se editan

`validateCompanyPayload` ya empuja `parseRut(...).message`. `parseRepRutFromPayload` concatena cuerpo y dígito y llama `parseRut`: cuerpo `12345678` con dígito `5` pasa; con `9`, o sin dígito, `parseRut` rechaza. `validateRutCl` devuelve `r.message` y el canónico `cuerpo-DV` solo si `ok`. `formatRutInput` ya devuelve el texto recortado cuando `parseOptionalRut` falla, así que `12.345.678-9` sale igual, sin volverse `12.345.678-5`.

`formatRut(body, dv)` no pasa por `parseRut`. Lo usan `CompanyEditLayout.jsx`, `CompaniesViewPage.jsx`, `CompaniesListPage.jsx` y `resolveCompanyVariablePreview.js`. `formatRutDisplay` del frontend sí parsea, pero el proveedor le pasa el `document_number` canónico (con dígito). No hay llamador que le pase solo el cuerpo.

## Risks / Trade-offs

- [Quien escribía el RUT sin dígito ahora ve error] → Consecuencia aceptada. El mensaje dice que el dígito no corresponde, o que el RUT no es válido si el cuerpo queda fuera de 7 u 8 dígitos.
- [Otra prueba existente falla] → No se ajusta. Se consulta a la mesa. Las que ya afirman el comportamiento nuevo (`rut.test.js` en back y front, y el fixture `76123456-0` de `companyService.test.js`) se dejan como están y tienen que pasar.
- [`parseRepRutFromPayload` sigue quitando no-dígitos del cuerpo antes de concatenar] → Fuera de este recorte. Los casos nuevos usan cuerpos numéricos. Si una prueba obligara a cambiar el llamador, se consulta.
- [Un valor guardado sin dígito se vería crudo en `formatRutDisplay`] → Revisado: empresa y representante arman el display con `formatRut(body, dv)`. Si al implementar aparece un llamador que pasa solo el cuerpo, se para y se consulta.
- [Las dos copias se desfasan] → Misma estructura y los mismos mensajes; la tabla de referencia se prueba en las dos.

## Migration Plan

No hay migración ni seed. El despliegue es el de la aplicación. Los RUT ya guardados no se tocan.

Rollback: revertir las dos funciones `parseRut`. No hay datos nuevos que deshacer. Lo que se haya rechazado no llegó a persistirse.

## Open Questions

Ninguna. El dígito obligatorio y el rechazo sin autocorrección están cerrados. El placeholder `12.345.678-9` lo decide David fuera de esta corrida.
