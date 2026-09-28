## 1. Prueba del formulario de empresa

- [x] 1.1 Crear `frontend/src/utils/companyFormPayload.rutLegal.test.js`. Importar `validateHeadquartersForCompanySubmit` desde `./companyFormPayload` y afirmar el objeto que devuelve. No leer el código fuente de la función. No modificar `companyFormPayload.js`, `rut.js`, `companyFormPayload.test.js` ni ningún otro archivo existente.
- [x] 1.2 En ese archivo, una tabla `it.each` parte de `{ businessName: 'Dynamics Corp. SpA', shortName: 'Dynamics', rut: '76.123.456-0', email: '', rutLegal1: '', rutLegal2: '' }` y cubre: `rutLegal1` `'12.345.678-9'` → `{ ok: false, message: 'El dígito verificador no corresponde al RUT ingresado.' }`; `rutLegal2` `'12.345.678-9'` → el mismo rechazo; `rutLegal1` `'12345678'` (sin guion) → el mismo rechazo; `rutLegal1` `'12.345.678-5'` → `{ ok: true }`; `rutLegal2` `'12.345.678-5'` → `{ ok: true }`; ambos `''` → `{ ok: true }`; `rutLegal1` `'12.345.678-5'` y `rutLegal2` `'12.345.678-9'` → el mismo rechazo.

## 2. Verificación

- [x] 2.1 Correr `cd frontend && npm test` y `cd frontend && npm run lint` (0 errores). Correr también `cd backend && env -u DATABASE_URL npm test`. Si la prueba nueva falla, no ajustar código de producto ni pruebas existentes: consultar a la mesa. El diff de producto queda vacío: no hay endpoints, configuración por ambiente ni autorización que tocar.
