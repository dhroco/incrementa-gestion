## Why

`parseRut` ya rechaza un dígito verificador que no corresponde, y `validateHeadquartersForCompanySubmit` reenvía ese rechazo para los representantes legales de la empresa. La revisión de `rut-dv-estricto` dejó ese borde sin prueba: ninguna envía el RUT del representante con el dígito equivocado. Hay que fijarlo ahora, antes de que un cambio posterior lo suelte sin que nadie lo note.

## What Changes

- Una prueba nueva en `frontend/src/utils/companyFormPayload.rutLegal.test.js` recorre los casos del formulario de empresa: dígito equivocado en representante 1 y en representante 2, ocho dígitos sin guion leídos como cuerpo más dígito, dígito correcto, y ambos vacíos (los representantes son opcionales).
- Con el primero válido y el segundo con dígito equivocado, el resultado sigue siendo el rechazo.
- El mensaje de error es `El dígito verificador no corresponde al RUT ingresado.`
- Ningún archivo de producto cambia. Si la prueba no pasa con el código actual, se consulta a la mesa en vez de ajustar el producto.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `chilean-rut-validation`: el formulario de empresa (`validateHeadquartersForCompanySubmit`) rechaza el RUT de cada representante legal cuando el dígito no corresponde, acepta el dígito correcto y acepta ambos vacíos. El comportamiento ya está en el código; este change lo deja escrito y cubierto por prueba. No cambia `parseRut`, el backend ni el mensaje.

## Impact

- Frontend, solo pruebas: archivo nuevo `frontend/src/utils/companyFormPayload.rutLegal.test.js`. Llama a `validateHeadquartersForCompanySubmit` y mira el resultado.
- No se modifica `companyFormPayload.test.js` ni ningún otro archivo de prueba existente.
- No se tocan `companyFormPayload.js`, `rut.js`, backend, API, base de datos ni configuración.
- Validación: el frontend ya aplica `parseOptionalRut` (vacío válido; si hay valor, las mismas reglas que `parseRut`). El backend ya rechaza el mismo caso en `validateCompanyPayload`; ese contrato no cambia.
- Errores al usuario en español (`es-CL`), el mensaje canónico del dígito que no corresponde. El RUT se muestra y se valida con el formato chileno `XX.XXX.XXX-X`.

## Consideraciones de seguridad

El RUT es un identificador personal. El rechazo no incluye el dígito esperado ni el valor enviado: solo el mensaje fijo. La prueba afirma ese mensaje y no imprime el RUT corregido. No hay persistencia, logs ni canales nuevos.
