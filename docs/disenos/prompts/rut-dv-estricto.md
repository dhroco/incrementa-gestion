# Recorte · rut-dv-estricto

> Encargo de Ignacio (arquitecto), 28-sep-2026. Primera corrida de incrementa-gestion con AOD.
> **Este texto es el prompt del propose: se usa tal cual.** Si algo de aquí no se puede cumplir, se
> consulta a la mesa; no se reinterpreta. Diseño: `docs/disenos/identificador-tributario.md`.

## 1. Objetivo

`parseRut` no rechaza un dígito verificador equivocado: lo reemplaza sin avisar. `12.345.678-9` se
acepta y se guarda como `12.345.678-5`, y ese RUT sale impreso en un contrato. Además adivina si la
entrada trae dígito por el largo, lo que hace ambiguos los RUT de 7 dígitos.

Al terminar:
- **El dígito verificador es obligatorio.** El último carácter de la entrada, una vez quitados los
  puntos, los guiones y los espacios, es siempre el dígito verificador, venga o no con guion.
- **Si el dígito no corresponde al módulo 11, se rechaza.** Nunca se reemplaza ni se calcula a
  partir de la entrada.
- Las dos copias (`backend/utils/rut.js` y `frontend/src/utils/rut.js`) se comportan igual.

## 2. Arquitectura

- Solo cambian las dos funciones `parseRut` y sus pruebas, más el dato de prueba de la sección 6.
  `computeRutDv`, `normalizeRutInput`, `formatRut`, `formatRutDisplay`, `formatRutInput`,
  `parseOptionalRut` y `RutInput` **conservan su firma y su contrato**.
- La forma del resultado no cambia: el backend devuelve `{ ok, rut_body, rut_dv }` o
  `{ ok: false, code, message }`, y el frontend `{ ok, rutBody, rutDv }` o `{ ok: false, message }`.
- Los llamadores ya propagan `message` (`companyService.js`, `identityDocument.js → validateRutCl`,
  los formularios de empresa y proveedor). **No hay que tocarlos**, salvo que una prueba demuestre
  lo contrario; en ese caso consulta a la mesa.
- El MCP no se toca: usa los mismos services, así que el agente recibe el error en español.
- Sin migraciones, sin cambios de esquema, sin cambios de contrato de la API, sin dependencias
  nuevas.

## 3. Reglas de parseo (las dos copias)

Sobre la entrada compacta: sin espacios, puntos ni guiones, con `k` en mayúscula.

1. Vacía: `{ ok: false }`, «El RUT es obligatorio.», con código `RUT_EMPTY` en el backend. Como hoy.
2. Último carácter = dígito verificador; el resto = cuerpo.
3. Cuerpo que no sea solo dígitos, o de largo distinto de 7 u 8: «El RUT ingresado no es válido.»,
   con código `RUT_INVALID` en el backend. **Un carácter extraño no se descarta en silencio**: hoy
   `replace(/\D/g, '')` borra una `K` metida en el cuerpo. Eso también se rechaza.
4. Dígito verificador que no sea `0`–`9` ni `K`: `RUT_INVALID`.
5. Dígito verificador distinto de `computeRutDv(cuerpo)`: `{ ok: false }` con el mensaje
   **«El dígito verificador no corresponde al RUT ingresado.»** y, en el backend, el código
   **`RUT_DV_MISMATCH`**.
6. Si todo calza: `ok: true`, el cuerpo y el dígito **tal como se escribieron** (con `k` → `K`).

Casos de referencia, ya calculados:

| Entrada | Resultado |
|---|---|
| `12.345.678-5` · `12345678-5` · `123456785` | ok, `12345678` / `5` |
| `12.345.678-9` | `RUT_DV_MISMATCH` (el caso de Marcela) |
| `1.234.567-4` · `12345674` | ok, `1234567` / `4` (RUT de 7 dígitos) |
| `1.234.567-9` | `RUT_DV_MISMATCH` (hoy se autocorrige por la regla del largo) |
| `12345678` | `RUT_DV_MISMATCH`: se lee como `1234567` + `8`, y el correcto es `4` |
| `10.000.013-K` · `10.000.013-k` | ok, `10000013` / `K` |
| `1.000.005-K` | ok, `1000005` / `K` |
| `1.000.013-0` | ok, `1000013` / `0` |
| `10.000.013-0` | `RUT_DV_MISMATCH` |
| `123456` · `1234567890` | `RUT_INVALID` |
| `1K34567-4` | `RUT_INVALID` |
| `''`, `null`, `'  '` | `RUT_EMPTY` |

## 4. Recomendaciones

- Reescribe el cuerpo de `parseRut` en cada archivo y borra la rama que reemplaza el dígito y el
  comentario «típico error de tipeo». La regla del largo (`<= 8`) desaparece.
- Mantén las dos copias con la misma estructura y el mismo mensaje, para que se lean como una sola.
- Actualiza el JSDoc de `parseRut` en el backend: hoy dice «with/without DV (heuristic…)».

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`.
- `RUT_INPUT_PLACEHOLDER` (`12.345.678-9`) **queda como está**, aunque su dígito sea incorrecto:
  viene de `openspec/config.yaml → locale.rut_format`, y lo decide David fuera de la corrida. No
  uses ese valor como ejemplo válido en ninguna prueba.
- Nada que se conecte a la base: la local es la de pre-producción. Sin migraciones ni seeds.
- Los mensajes al usuario, en español. Documentación y commits en español.

## 6. Pruebas existentes que cambian (autorizado)

Estas afirman justo el comportamiento que se elimina. **Solo estas** se pueden modificar:

- `backend/test/rut.test.js`: `parseRut accepts input without DV and computes it` y
  `parseRut corrects a mistyped digit verificador when body is valid`. Se reemplazan por las que
  afirman el rechazo.
- `frontend/src/utils/rut.test.js`: `parseRut accepts without DV and computes it` y
  `parseRut corrects a mistyped digit verificador when body is valid`. Igual.
- `backend/test/companyService.test.js`: el dato `rut: '76123456-7'` (dos apariciones, en
  `validBase` y en la primera prueba) tiene el dígito equivocado; el correcto es `76123456-0`.
  Cámbialo sin tocar ninguna aserción.

Si cualquier otra prueba existente falla, **no la ajustes: consulta a la mesa.**

## 7. Pruebas nuevas

Todas ejecutan el comportamiento: llaman la función o el servicio y miran el resultado. Ninguna lee
el código fuente.

- **`parseRut`, en las dos copias**: cada fila de la tabla de la sección 3, con el `code` en el
  backend y el `message` en las dos.
- **Empresa** (`backend/test/companyService.test.js`, prueba nueva):
  `validateCompanyPayload({ ...validBase, rut: '12.345.678-9' }, { requireAll: true })` da
  `ok: false` y entre los errores está «El dígito verificador no corresponde al RUT ingresado.».
- **Representante legal por campos separados**: con `rut_body_legal_representative_1: '12345678'` y
  `rut_dv_legal_representative_1: '5'`, el payload es válido y guarda `12345678` / `5`. Con dígito
  `'9'`, es inválido. Con el cuerpo y **sin dígito**, es inválido: antes se calculaba.
- **Proveedor chileno** (`backend/test/identityDocument.test.js`): un `document_number`
  `12.345.678-9` con el tipo `rut_cl` se rechaza con el mensaje nuevo, y `12.345.678-5` se acepta
  con canónico `12345678-5`.
- **Sin prueba de API nueva**: `createCompany` resuelve el alcance y valida contra la base (`db`
  directo), así que un `POST /api/companies` con el servicio real necesita base, y aquí no hay.
  El rechazo se prueba en `validateCompanyPayload`, que es lo que `createCompany` llama antes de
  tocar la base. No inventes infraestructura para esto.
- **Frontend**: `formatRutInput('12.345.678-9')` devuelve la entrada **sin cambios**, no
  `12.345.678-5`. Es lo que hace hoy `RutInput` al perder el foco, y la prueba demuestra que ya no
  corrige.

## 8. Puntos de atención

- `formatRutDisplay` y `formatRutInput` usan `parseOptionalRut` → `parseRut`. Con la regla nueva,
  un valor guardado sin dígito se mostraría crudo en vez de formateado. Revisa que ningún llamador
  les pase solo el cuerpo: `CompanyEditLayout.jsx` y `CompaniesViewPage.jsx` usan
  `formatRut(body, dv)`, que no pasa por `parseRut`, y está bien. Si encuentras uno que pasa solo
  el cuerpo, consulta a la mesa.
- `backend/migrations/202604260001_*.js` importa `computeRutDv`. No cambia, y las migraciones no se
  editan.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test`,
  `cd frontend && npm run lint`. Las tres en verde.
