## Why

La cláusula 2.3 de las 17 plantillas estándar activas dice "la generación y publicación de `{{cantidad_reels}}` en el perfil de …". Como `cantidad_reels` se renderiza solo como cifra ("3"), el contrato final queda gramaticalmente incompleto: "publicación de 3 en el perfil de Instagram", sin el sustantivo que indica *qué* se publica.

Además, el formato de la publicación no siempre es un reel: puede ser un video, una historia, un post, etc. Hoy no hay forma de expresarlo.

## What Changes

- **Nueva variable `formato_reel`** (label "Formato de reel") en la categoría **Contrato**, tanto en el catálogo del editor (frontend) como en `VARIABLE_META` y el mapa de sustitución (backend). Es un `select` con catálogo cerrado: Reel, Video, Historia, Story, Post, Carrusel, Short.
- **Nuevo render de `cantidad_reels`**: pasa de cifra con separador de miles ("3") a palabras + cifra sin sustantivo ("tres (3)"), siguiendo el patrón ya establecido por `duracion_ejecucion` y `dias_cesion`.
- **Render de `formato_reel`**: en minúsculas y concordando en número con `cantidad_reels` ("Reel" con 1 → "reel"; "Video" con 3 → "videos").
- **Nuevo util `backend/utils/formatReels.js`** con `formatCantidadReels`, `formatFormatoReel` y `FORMATO_REEL_OPTIONS`. Reutiliza `cardinal` de `formatDuracion.js`, que pasa a exportarse.
- **Contenido de las 17 plantillas activas**: se inserta la variable `formato_reel` inmediatamente después de `cantidad_reels` en la cláusula 2.3, con un espacio de separación.

Resultado en el contrato final:

- `cantidad_reels` = 1, `formato_reel` = "Reel" → "… la generación y publicación de **un (1) reel** en …"
- `cantidad_reels` = 3, `formato_reel` = "Video" → "… la generación y publicación de **tres (3) videos** en …"

**Restricciones explícitas:** no se tocan las 4 plantillas inactivas (PL0001–PL0004), que llevan la palabra "reel" literal en el texto. No se crean tablas ni migraciones: el catálogo de formatos vive en código, como constante. No se modifican otras cláusulas ni otras variables.

## Capabilities

### New Capabilities

_(ninguna — extiende `document-builder-supplier-context`)_

### Modified Capabilities

- `document-builder-supplier-context`: nueva variable de contrato `formato_reel` y nuevo render de `cantidad_reels`.

## Impact

- **Backend**: `utils/formatReels.js` (nuevo), `utils/formatDuracion.js` (exporta `cardinal`), `services/documentBuilderService.js`, `services/documentBuilderVariableContext.js`; test `test/formatReels.test.js` (nuevo).
- **Frontend**: `src/data/variableCatalog.js` (variable nueva + descripción actualizada de `cantidad_reels`).
- **Datos**: 17 filas de `template` actualizadas en su `content_json`. Respaldo previo de cada una en `template_content_backup` con `note = 'pre-formato-reel-clausula-2.3'`.
- **Operacional**: los contratos generados desde ahora piden un campo más ("Formato de reel") antes de generar el PDF. Los borradores ya generados no cambian.

## Consideraciones de seguridad

- El cambio no toca autenticación, autorización ni permisos CASL; `formato_reel` es un campo de contenido del contrato, sin PII.
- El catálogo de formatos es cerrado y se valida en el backend al renderizar: un valor fuera de catálogo se escribe en minúsculas con plural genérico, nunca se inyecta markup ni se ejecuta.
- La actualización de plantillas se hizo en transacción por fila, con respaldo del `content_json` original en `template_content_backup`, lo que permite revertir sin pérdida.
