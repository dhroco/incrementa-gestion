# Recorte · rut-rep-legal-prueba

> Encargo de Ignacio (arquitecto), 28-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/identificador-tributario.md`.

## 1. Objetivo

Desde `rut-dv-estricto`, `parseRut` rechaza un dígito verificador que no corresponde. La revisión
final de esa corrida dejó un borde sin cubrir: **ninguna prueba envía el RUT del representante
legal con el dígito equivocado** a `validateHeadquartersForCompanySubmit`
(`frontend/src/utils/companyFormPayload.js`), la validación del formulario de empresa.

El comportamiento ya es el correcto (verificado el 28-sep). Al terminar, **una prueba nueva lo fija**,
y ningún archivo de producto cambia.

## 2. Arquitectura

- **Un solo archivo nuevo**: `frontend/src/utils/companyFormPayload.rutLegal.test.js`.
- **No cambia ningún archivo que no sea de prueba.** Si para que la prueba pase hubiera que cambiar
  código de producto, no lo cambies: consulta a la mesa, porque eso contradice lo verificado.

## 3. Casos

Con una base válida `{ businessName: 'Dynamics Corp. SpA', shortName: 'Dynamics',
rut: '76.123.456-0', email: '', rutLegal1: '', rutLegal2: '' }`, variando un campo a la vez:

| Campo | Valor | Resultado |
|---|---|---|
| `rutLegal1` | `'12.345.678-9'` | `{ ok: false, message: 'El dígito verificador no corresponde al RUT ingresado.' }` |
| `rutLegal2` | `'12.345.678-9'` | igual |
| `rutLegal1` | `'12345678'` (sin guion: el 8 se lee como dígito) | igual |
| `rutLegal1` | `'12.345.678-5'` | `{ ok: true }` |
| `rutLegal2` | `'12.345.678-5'` | `{ ok: true }` |
| `rutLegal1` y `rutLegal2` | `''` | `{ ok: true }` (los representantes son opcionales) |

Además: con `rutLegal1` válido y `rutLegal2` `'12.345.678-9'`, el resultado es el rechazo, lo que
demuestra que se valida también el segundo aunque el primero esté bien.

## 4. Recomendaciones

- Una tabla de casos recorrida con `it.each` se lee bien y deja claro que es una sola regla.

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/**`,
  `frontend/config.js`, `frontend/vite.config.js`, `frontend/eslint.config.js`, `.github/**`,
  `infra/**`, `.agent-orchestrator/**`.
- Commits en español.

## 6. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques `companyFormPayload.test.js` ni ningún otro
archivo de prueba existente.** Si cualquier prueba existente falla, **no la ajustes: consulta a la
mesa.**

## 7. Pruebas nuevas

Las de la sección 3, todas en `frontend/src/utils/companyFormPayload.rutLegal.test.js`. Llaman la
función y miran el resultado; no leen el código fuente.

## 8. Puntos de atención

- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y
  `cd frontend && npm run lint`. Las tres en verde; el lint, con 0 errores.
