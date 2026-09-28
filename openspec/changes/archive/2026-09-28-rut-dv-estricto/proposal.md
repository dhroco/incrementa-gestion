## Why

`parseRut` no rechaza un dígito verificador equivocado: lo reemplaza sin avisar. `12.345.678-9` se acepta y se guarda como `12.345.678-5`, y ese RUT sale impreso en un contrato. Además adivina si la entrada trae dígito por el largo, lo que hace ambiguos los RUT de 7 dígitos. Hay que cerrarlo ahora, antes de que otro contrato quede con un identificador que el usuario no escribió.

## What Changes

- El dígito verificador pasa a ser obligatorio. El último carácter de la entrada, una vez quitados puntos, guiones y espacios, es siempre el dígito, venga o no con guion.
- Si el dígito no corresponde al módulo 11, se rechaza. Nunca se reemplaza ni se calcula a partir de la entrada.
- Las dos copias (`backend/utils/rut.js` y `frontend/src/utils/rut.js`) se comportan igual.
- Un carácter que no sea dígito en el cuerpo (por ejemplo una `K` metida en el medio) se rechaza; ya no se descarta en silencio.
- Dígito que no calza: mensaje «El dígito verificador no corresponde al RUT ingresado.» y, en el backend, código `RUT_DV_MISMATCH`.
- **BREAKING (comportamiento de aceptación):** un RUT que antes se autocorregía (dígito mal escrito, o cuerpo sin dígito inferido por el largo) ahora se rechaza. La forma de la respuesta de `parseRut` y el contrato HTTP no cambian.

No entra: migraciones, esquema, contrato de la API, dependencias nuevas, el MCP (sigue usando los mismos services), `RUT_INPUT_PLACEHOLDER` (`12.345.678-9`, aunque su dígito sea incorrecto), ni la firma de `computeRutDv`, `normalizeRutInput`, `formatRut`, `formatRutDisplay`, `formatRutInput`, `parseOptionalRut` y `RutInput`.

## Capabilities

### New Capabilities

- `chilean-rut-validation`: contrato estricto de `parseRut` en las dos copias (dígito obligatorio, rechazo por módulo 11, mensajes en español); el payload de empresa deja de aceptar un dígito que no corresponde o un cuerpo sin dígito; `formatRutInput` deja de corregir el dígito al perder el foco.

### Modified Capabilities

- `suppliers-admin`: un documento `rut_cl` cuyo dígito no corresponde se rechaza con «El dígito verificador no corresponde al RUT ingresado.» y no se persiste corregido. `rut_cl` sigue llamando a `parseRut`; no reimplementa el módulo 11.

## Impact

**Backend:** solo el cuerpo de `parseRut` en `backend/utils/rut.js` (se borra la rama que reemplaza el dígito y la regla de largo `<= 8`) y pruebas nuevas en `backend/test/rut.test.js`, `backend/test/companyService.test.js` y `backend/test/identityDocument.test.js`. Los llamadores (`companyService.js`, `identityDocument.js`) ya propagan `message`; no se tocan salvo que una prueba existente demuestre lo contrario.

**Frontend:** el mismo cambio en `frontend/src/utils/rut.js` y pruebas en `frontend/src/utils/rut.test.js`. `formatRut` (cuerpo y dígito por separado) no pasa por `parseRut`.

**APIs:** mismos endpoints. Un alta o edición que antes guardaba el dígito calculado ahora responde error de validación en español, con el mensaje nuevo cuando el dígito no corresponde. Sin prueba de API nueva: `createCompany` toca la base; el rechazo se prueba en `validateCompanyPayload`.

**Datos:** sin migraciones ni seeds. Los RUT ya guardados no se reescriben.

## Consideraciones de seguridad

El RUT es dato personal (Ley 19.628). El fallo actual no es de exposición: es de integridad. Un dígito reemplazado en silencio queda impreso en un contrato con un identificador que nadie ingresó.

- El rechazo no calcula ni devuelve el dígito «correcto». El mensaje no incluye el valor enviado.
- Validación en las dos capas, con el mismo criterio: el frontend avisa al editar; el backend es quien impide persistir (empresa y proveedor chileno, REST y MCP por el mismo service).
- Sin endpoints, grants ni columnas nuevas. No se loguea el RUT rechazado.
