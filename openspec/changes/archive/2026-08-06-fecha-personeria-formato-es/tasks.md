## 1. Util compartido de fecha

- [x] 1.1 Crear `backend/utils/formatFechaEs.js` con `formatFechaEs(value)` y una única lista `MESES_ES`
- [x] 1.2 Rama `Date`: usar componentes locales (`getFullYear`/`getMonth`/`getDate`), no UTC, para no correr el día
- [x] 1.3 Rama string ISO: parseo por partes (`YYYY-MM-DD`, hora opcional)
- [x] 1.4 Valor no reconocido se devuelve tal cual; `Date` inválido y nulos devuelven string vacío

## 2. Camino BD (dato del proveedor)

- [x] 2.1 `documentBuilderVariableContext.js`: eliminar `formatDateEs` y su `MESES_ES` local
- [x] 2.2 `fecha_estatuto` y `fecha_escritura` pasan a usar `formatFechaEs`

## 3. Camino override (formulario / MCP)

- [x] 3.1 `documentBuilderService.js`: eliminar `formatContractDate` y su `MESES_ES` local
- [x] 3.2 Definir `DATE_OVERRIDE_KEYS` = `fecha_contrato`, `fecha_escritura`, `fecha_estatuto`
- [x] 3.3 `preprocessMissingFieldOverrides` formatea todas esas claves con `formatFechaEs`
- [x] 3.4 Verificar que no quedan referencias colgantes a `formatContractDate`, `formatDateEs` ni `MESES_ES` fuera del util

## 4. Tests

- [x] 4.1 `backend/test/formatFechaEs.test.js`: string ISO, ISO con hora, día sin cero a la izquierda, los 12 meses
- [x] 4.2 Tests de la rama `Date`, incluido el caso de fin de año que delataría un corrimiento por UTC
- [x] 4.3 Tests de passthrough (valor ya formateado, no ISO, fuera de rango) y de nulos
- [x] 4.4 `npm test` en backend — suite verde (235 tests)
- [x] 4.5 `npm test` en frontend — suite verde (106 tests, sin cambios en ese lado)

## 5. Verificación

- [x] 5.1 Local, camino BD: proveedor con `fecha_certificado_estatuto` guardada rinde "27 de mayo de 2025" (antes, el texto inglés de `Date`)
- [x] 5.2 Local, camino override: `fecha_escritura: '2024-03-15'` rinde "15 de marzo de 2024"; `fecha_contrato` sigue correcto
- [x] 5.3 Post-deploy pre-prod, ambos caminos confirmados en el PDF: CONTRATO_0004 con `fecha_escritura` por override rinde "consta en Escritura pública de fecha 15 de marzo de 2024"; CONTRATO_0001 con proveedor que tiene la fecha en BD rinde "de fecha 27 de mayo de 2025". Borradores de prueba eliminados tras verificar.
