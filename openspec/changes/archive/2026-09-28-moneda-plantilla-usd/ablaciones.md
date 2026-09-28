# Ablaciones

Corridas sin IA por agent-orchestrator el 2026-09-28T17:46:25.478Z.

- ✓ **moneda-plantilla-usd.ablaciones/clp-miles-con-punto** · cazada: la prueba se puso en rojo
- ✓ **moneda-plantilla-usd.ablaciones/coherencia-pais-plantilla** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/generate-sin-moneda-de-plantilla** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/select-sin-currency-code** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/usd-con-prefijo-de-pesos** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/moneda-desconocida-sin-guarda** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/moneda-en-blanco-no-cae-a-clp** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/migracion-no-marca-usd** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/reescritura-muta-la-entrada** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/parrafo-con-nodos-de-mas** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/negrita-no-verificada** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/variable-no-verificada** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/up-no-persiste-la-reescritura** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/respaldo-guarda-lo-reescrito** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/up-reescribe-todas-las-plantillas** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/default-de-moneda-usd** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/check-admite-otra-moneda** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/down-borra-todos-los-respaldos** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/aviso-solo-si-no-hay-ninguna** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/marca-usd-antes-de-reescribir** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/down-no-quita-la-columna** · cazada: la prueba se puso en rojo
- ✓ **ablaciones-revisor/down-restaura-respaldos-ajenos** · cazada: la prueba se puso en rojo
- ✗ **ablaciones-revisor/generate-sin-404-de-plantilla** · sobrevive (borde): la prueba siguió en verde con «backend/services/documentBuilderService.js» ablacionado: falta una prueba que mida esto (generateAndPersist responde 404 «Plantilla no encontrada.» si la plantilla no existe (tarea 2.3); sin la guarda, templateRow.currency_code revienta con TypeError (500). Ninguna prueba de generateAndPersist hace que getTemplateRow devuelva null; la de mcpServer mockea el servicio)
