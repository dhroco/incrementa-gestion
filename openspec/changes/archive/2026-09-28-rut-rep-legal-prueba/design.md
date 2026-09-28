## Context

Desde `rut-dv-estricto`, `parseRut` en `frontend/src/utils/rut.js` rechaza un dígito verificador que no calza con el módulo 11 y no lo reemplaza. `validateHeadquartersForCompanySubmit` (`frontend/src/utils/companyFormPayload.js`) aplica esa regla a la empresa con `parseRut` y a cada representante con `parseOptionalRut`: cadena vacía es válida; si hay valor, el fallo de `parseRut` se devuelve tal cual, con el mensaje `El dígito verificador no corresponde al RUT ingresado.`

El comportamiento del formulario ya es el correcto (verificado el 28-sep-2026). La revisión final de `rut-dv-estricto` dejó el borde sin prueba: ninguna envía el RUT del representante legal con el dígito equivocado a esa función. El backend ya cubre el mismo rechazo en `validateCompanyPayload`. El diseño de dominio está en `docs/disenos/identificador-tributario.md`.

La guarda de AOD revisa el archivo de prueba entero. Un archivo que ya existe no se toca ni para agregarle un caso.

## Goals / Non-Goals

**Goals:**

- Fijar con una prueba nueva que el formulario de empresa rechaza el dígito equivocado del representante 1, del representante 2, y de los ocho dígitos sin guion leídos como cuerpo más dígito.
- Fijar que el dígito correcto se acepta, que ambos representantes vacíos se aceptan, y que un segundo representante inválido se rechaza aunque el primero esté bien.
- Dejar el requisito escrito en el delta de `chilean-rut-validation`.

**Non-Goals:**

- Cambiar código de producto, mensajes, `parseRut`, `parseOptionalRut` o el backend.
- Modificar `companyFormPayload.test.js` ni ningún otro archivo de prueba existente.
- Unificar las dos copias de `parseRut`, corregir el placeholder `12.345.678-9` de `openspec/config.yaml`, ni revalidar RUT ya guardados.
- Cambios de UI, estilos, responsive o formato visual. La prueba no renderiza.

## Decisions

### 1. Un archivo de prueba nuevo, sin tocar producto

La prueba vive en `frontend/src/utils/companyFormPayload.rutLegal.test.js`. Importa `validateHeadquartersForCompanySubmit` y compara el objeto de resultado. No lee el código fuente.

Alternativa considerada: agregar los casos a `companyFormPayload.test.js`. Se descarta porque la guarda de AOD protege los archivos de prueba existentes completos, y el encargo lo prohíbe.

Si la prueba no pasa con el código actual, no se ajusta el producto: se consulta a la mesa. Eso contradiría lo ya verificado.

### 2. Una tabla `it.each` para una sola regla

Base válida, y cada fila cambia solo los campos de representante:

```js
{
  businessName: 'Dynamics Corp. SpA',
  shortName: 'Dynamics',
  rut: '76.123.456-0',
  email: '',
  rutLegal1: '',
  rutLegal2: ''
}
```

| `rutLegal1` | `rutLegal2` | Resultado |
|---|---|---|
| `12.345.678-9` | `''` | `{ ok: false, message: 'El dígito verificador no corresponde al RUT ingresado.' }` |
| `''` | `12.345.678-9` | igual |
| `12345678` | `''` | igual (sin guion: el `8` es el dígito y no corresponde) |
| `12.345.678-5` | `''` | `{ ok: true }` |
| `''` | `12.345.678-5` | `{ ok: true }` |
| `''` | `''` | `{ ok: true }` |
| `12.345.678-5` | `12.345.678-9` | el mismo rechazo |

La última fila demuestra que se valida el segundo aunque el primero esté bien. Entra en la misma tabla: es la misma regla, con los dos campos seteados.

Alternativa considerada: un `it` por caso, o dejar la fila cruzada fuera de la tabla. Se descarta porque el encargo pide una tabla que se lea como una sola regla.

### 3. El delta agrega un requisito; no reescribe los existentes

`parseRut`, `validateCompanyPayload` y `formatRutInput` ya están en `openspec/specs/chilean-rut-validation/spec.md` y no cambian. El delta usa `ADDED Requirements` para el formulario de empresa.

## Risks / Trade-offs

- [La prueba falla porque el producto no hace lo verificado] → No se cambia producto ni pruebas existentes. Se consulta a la mesa y se detiene la corrida.
- [La prueba afirma el mensaje y alguien lo cambia en `parseRut`] → El fallo es el punto: el formulario reenvía el mensaje canónico. No se duplica la lógica del módulo 11 en la prueba.
- [Alcance que se cuela a UI o backend] → El único archivo de implementación permitido es el de prueba nuevo. El resto de restricciones del encargo queda en las tareas.

## Migration Plan

No hay migración, datos ni despliegue propio. El cambio es una prueba de frontend. Revertir es borrar el archivo nuevo. Las pruebas del perfil que deben quedar en verde: `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y `cd frontend && npm run lint` (0 errores).

## Open Questions

Ninguna. El encargo fija archivo, casos, base y mensaje. Si al implementar algo de eso no se puede cumplir, se consulta a la mesa; no se reinterpreta.
