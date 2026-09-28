# Decisiones del cambio moneda-plantilla-usd

Registro automático de la mesa de consultas.

## C-H7K38JV · La tarea 3.2 pide una prueba «Reels count formatted» donde preprocessMissingFieldOverrides({ cantidad_reels: '1000' }) deja cantidad_reels en "1.000". El código actual usa formatCantidadReels y devuelve "mil (1000)" (spec document-builder-supplier-context: palabras y cifra). El delta de template-variable-pairs copió el escenario viejo de miles. ¿La prueba nueva debe afirmar "mil (1000)", que es el comportamiento vigente, o "1.000", como dice tasks.md?

- **Preguntó:** Cursor
- **Decidió:** Ignacio
- **Revisión humana:** confirmada el 2026-09-28. No se toca la spec `template-variable-pairs` en este cambio; su corrección va en un recorte aparte.
- **Respuesta:** Quita del delta de specs/template-variable-pairs el escenario de cantidad_reels ('1000' → "1.000") y sácalo de la tarea 3.2. cantidad_reels queda fuera de este recorte y no se toca: su comportamiento vigente es formatCantidadReels ('mil (1000)'), según el requisito «Contract variable cantidad_reels rendered in words and figures» de document-builder-supplier-context. Esa es la fuente de verdad y las pruebas actuales lo cubren. La línea vieja de template-variable-pairs (1000 → '1.000') es una inconsistencia previa de la spec principal y no se corrige en esta corrida. El delta de template-variable-pairs solo debe modificar el formato de precio_numero según la moneda de la plantilla (sección 3 del prompt) y dejar intacto todo lo demás del requisito, salvo esa línea de cantidad_reels, que el delta no debe repetir como escenario. No hace falta commit mío.
- **Motivo del Arquitecto:** Hay una contradicción entre artefactos, y eso cae en el punto 9 (diseño/spec), que le toca a Ignacio. En main, openspec/specs/template-variable-pairs/spec.md:59 y :65-68 todavía dicen cantidad_reels 1000 → "1.000". Eso quedó obsoleto: después se agregó openspec/specs/document-builder-supplier-context/spec.md:259-280 («Contract variable cantidad_reels rendered in words and figures»: "tres (3)", "veintiún (21)"), que es lo que implementan backend/utils/formatReels.js y su prueba. El delta de este cambio (specs/template-variable-pairs/spec.md:7 y :15-18) y tasks.md:26 copiaron el escenario obsoleto. Si la prueba afirma "mil (1000)", se aparta de tasks.md, que escribió Ignacio. Si el delta queda como está, al archivar el cambio el escenario incorrecto se vuelve a consolidar en main. Las dos cosas son para que Ignacio las corrija, no para que yo las interprete.
- **Fecha:** 2026-09-28T16:44:38.599Z

## C-I5PLRN6 · El veredicto final en rojo pide decidir dos puntos de diseño que la spec no cierra, y hay una decisión con revisión humana pendiente. ¿Qué hago en cada uno?

- **Preguntó:** Cursor
- **Decidió:** Humano
- **Respuesta:** 1) Opción (b): la migración no lanza error si no encuentra CONTRATO_0016 y 0017 (sigue el precedente 202609040004:37-39 y no rompe migrate:latest en bases nuevas); agrega un console.warn si encuentra menos de 2, y anótalo en design.md. Antes de migrar producción confirmo los códigos reales.
2) Anótalo como riesgo aceptado en Risks/Trade-offs de design.md, sin cambiar standardTemplatesService. Mostrar la moneda en la ficha de la plantilla queda como recorte futuro.
3) Se confirma C-H7K38JV: no se toca la spec template-variable-pairs en este cambio; su corrección va en un recorte aparte.
- **Motivo del Arquitecto:** Los tres puntos quedan fuera de lo que puedo decidir yo.

1) Qué hace up() si no encuentra CONTRATO_0016 y CONTRATO_0017. Hoy la migración promete, por decisión de David en docs/disenos/moneda-plantilla.md:37-38, que esas dos quedan en USD. La elección decide qué pasa con datos reales en producción, que corre en la nube del cliente y usa otros datos. Eso es el punto 8 y cambia una decisión escrita de David, así que le toca a David. Hay un precedente en main, backend/migrations/202609040004_template_country_and_mx_wording.js:37-39: el mismo whereIn(MX_CODES) sin contar filas, que no hace nada si no las encuentra. Pero seguirlo significa aceptar que el diseño no se cumpla en un ambiente sin esas plantillas, y eso no es solo aplicar el precedente. Además, esas plantillas no vienen de los seeds (backend/seeds/006_gfa_template_seed.js no las tiene). En una base nueva, migrate:latest corre sin ellas. Si up() lanza, se rompe la migración de cualquier base nueva, incluida la de pruebas de AOD.

2) Anotar en design.md que la moneda y el content_json editable pueden quedar desalineados. Es un trade-off del diseño, y design.md y los recortes los escribe Ignacio (puntos 2 y 9).

3) C-H7K38JV tiene la revisión humana pendiente. Solo un humano la cierra. Yo no puedo confirmarla ni reabrirla.
- **Fecha:** 2026-09-28T17:18:46.455Z

## C-JQR52YP · Al separar 202609280001 en A (solo template.currency_code default CLP + CHECK, antes del deploy) y B (marcar CONTRATO_0016/0017 en USD y reescribir la cláusula 3.1, después del deploy), las pruebas ya escritas importan up/down/rewriteMxPriceClause de ese mismo archivo y afirman el comportamiento combinado. La regla me prohíbe modificarlas. ¿Cómo parto los archivos?

- **Preguntó:** Cursor
- **Decidió:** Humano
- **Respuesta:** Opción (a). Además, esas pruebas no están congeladas: la guarda solo protege las que existían en la base de la corrida (f35cc99), y templateCurrencyMigration.test.js, templateCurrencyMigrationClosure.test.js y documentBuilderService.currency.test.js las creó esta misma corrida. Ajústalas para que importen de la migración que corresponde (esquema desde 202609280001, datos desde 202609280002) sin cambiar lo que verifican, y agrega lo que falte para correr A y después B. Antes de correr B en pre-producción o producción confirmo los códigos reales de CONTRATO_0016 y 0017.
- **Motivo del Arquitecto:** El pedido del humano (A y B separadas, con A antes del deploy y B después) choca con la regla de AOD que congela las pruebas existentes antes de la corrida. Las dos pruebas importan up/down/rewriteMxPriceClause de 202609280001 y exigen que ese archivo haga esquema y datos juntos. Se contradicen dos instrucciones humanas, y decidir cuál manda no me toca. Además, B toca datos reales: marca CONTRATO_0016/0017 en USD y reescribe content_json. Eso es el punto 8 de las atribuciones, que siempre decide David. Tampoco hay precedente ni decisión previa que lo cubra: C-I5PLRN6 fija el warn y el no-error, no la separación. Ante la duda de a quién va, va a David.
- **Fecha:** 2026-09-28T18:13:44.936Z
