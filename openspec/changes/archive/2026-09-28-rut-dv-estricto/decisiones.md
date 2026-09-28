# Decisiones del cambio rut-dv-estricto

Registro automático de la mesa de consultas.

## C-DB5S0Z9 · Las tareas 2.1 a 3.3 y la sección 7 del prompt piden pruebas nuevas dentro de backend/test/rut.test.js, frontend/src/utils/rut.test.js, backend/test/companyService.test.js y backend/test/identityDocument.test.js. Esas adiciones están sin commit. La guarda y esta reparación prohíben modificar pruebas que ya existían (commits 17a8113 y 6b25113). parseRut ya está reescrito y las suites pasan. ¿Restauro esos cuatro archivos a HEAD y muevo las pruebas de la sección 7 a archivos nuevos, actualizando tasks.md, o las dejo en los archivos que nombran las tareas?

- **Preguntó:** Cursor
- **Decidió:** Arquitecto
- **Respuesta:** Toma la opción 1: restaura los cuatro archivos de prueba a HEAD y pasa las pruebas nuevas a archivos nuevos. La guarda de AOD compara el archivo de prueba completo, no cada prueba. Por eso cualquier línea agregada a un archivo que ya existía cuenta como modificación y detiene la corrida. El prompt de reparación lo dice: «no modifiques las pruebas existentes» y «agrega la prueba… en un archivo de pruebas nuevo». La opción 3 no sirve porque deja escenarios de la spec sin cubrir.

Pasos:
1. `git checkout HEAD -- backend/test/rut.test.js frontend/src/utils/rut.test.js backend/test/companyService.test.js backend/test/identityDocument.test.js`. No toques `backend/utils/rut.js` ni `frontend/src/utils/rut.js`.
2. Pasa las pruebas que habías agregado, sin cambiar su contenido, a estos archivos nuevos. El repo ya usa nombres con punto, como `supplierService.document.test.js`:
   - `backend/test/rut.dvEstricto.test.js`: las ocho pruebas de escenario de `parseRut` (2.1).
   - `frontend/src/utils/rut.dvEstricto.test.js`: las ocho de `parseRut` y la de «Blur keeps a mistyped RUT» con `formatRutInput('12.345.678-9')` (2.2).
   - `backend/test/companyService.rutDv.test.js`: la de «Company RUT with a mistyped digit» y las tres del representante legal (3.1 y 3.2). Copia al archivo nuevo la definición de `validBase` y los imports que necesite. No la importes del archivo viejo.
   - `backend/test/identityDocument.rutDv.test.js`: las dos de `validateIdentityDocument` con `rut_cl` (3.3).
   Cada archivo debe tener sus propios imports y correr solo. `node --test` y vitest ya los toman por el patrón `*.test.js`.
3. Actualiza `tasks.md`: en 2.1, 2.2, 3.1, 3.2 y 3.3 cambia la ruta por la del archivo nuevo y agrega «(archivo nuevo: la guarda de AOD protege los archivos de prueba existentes completos)». Deja esas tareas marcadas y la 4.1 sin marcar hasta verificar.
4. Verifica: `git diff HEAD --stat -- backend/test frontend/src/utils/rut.test.js` no debe listar ningún archivo que ya existía. Después corre `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Backend debe seguir en 326 y frontend en 122, las dos en verde, y ninguna prueba puede quedar duplicada ni perdida en el traslado.
- **Motivo del Arquitecto:** Dónde van las pruebas es una decisión de estructura de archivos y convenciones de prueba, y eso lo decide el Arquitecto. No cambia el alcance: se prueban los mismos escenarios de la spec `chilean-rut-validation`, con las mismas afirmaciones. Tampoco cambia contratos ni toca la base. Hay una restricción mecánica que manda: la guarda de AOD revisa el archivo de prueba completo, y el prompt de reparación del flujo (`.agent-orchestrator/flujos/flujo-ciclo.json`, nodo de reparación) pide explícitamente «un archivo de pruebas nuevo» y «no modifiques las pruebas existentes». El prompt y `tasks.md` nombraban los archivos existentes por error mío al redactarlos. Corregir `tasks.md` es dejar al día el artefacto del cambio, cosa que el flujo mismo pide.
- **Fecha:** 2026-09-28T14:54:30.690Z

## C-E6HVUOE · La tarea 4.1 pide backend tests, frontend tests y frontend lint en verde. Las dos suites de pruebas quedaron en verde (backend 329, frontend 124) tras agregar las pruebas que cazan las ablaciones sobrevivientes. `npm run lint` sigue en rojo con 38 errores en archivos ajenos a este recorte (el perfil ya los excluye). ¿Marco 4.1 como hecha, o la dejo sin marcar?

- **Preguntó:** Cursor
- **Decidió:** Humano
- **Respuesta:** El lint del frontend ya no es requisito de este recorte: salió del perfil (28cffe2) porque en preprod ya falla con 38 errores en archivos ajenos. Da la tarea 4.1 por cumplida con las dos suites en verde, anota en tasks.md que el lint queda como deuda para un recorte propio, y sigue.
- **Motivo del Arquitecto:** La tarea escrita y la configuración de la corrida dicen cosas distintas. openspec/changes/rut-dv-estricto/tasks.md:23 exige "Las tres en verde", y eso incluye `npm run lint`. En cambio, .agent-orchestrator/perfil.yaml:4-5 (commit 28cffe2) sacó el lint del perfil a propósito, porque en preprod ya falla con 38 errores ajenos. Dar la 4.1 por hecha sin el lint cambia un criterio de aceptación escrito. Eso es alcance (atribución 2) y una contradicción entre la spec y otra definición del repo (atribución 9). Ninguna decisión previa de esta corrida cubre el caso. Ante la duda, escalo. La opción 3 amplía el alcance a archivos fuera del recorte, así que también queda fuera.
- **Fecha:** 2026-09-28T15:19:24.936Z
