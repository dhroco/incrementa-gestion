## 1. Util de formato

- [x] 1.1 `backend/utils/formatDuracion.js`: exportar `cardinal` para reutilizar la apocopación ("uno"→"un", "veintiuno"→"veintiún")
- [x] 1.2 Crear `backend/utils/formatReels.js` con catálogo `FORMATOS` (singular/plural por formato) y `FORMATO_REEL_OPTIONS`
- [x] 1.3 `formatCantidadReels(value)` → "un (1)" / "tres (3)"; valor vacío o no numérico se devuelve tal cual
- [x] 1.4 `formatFormatoReel(formato, cantidad)` → minúsculas, singular si cantidad es 1, plural en caso contrario; match ignorando mayúsculas, tildes y `s` final; plural genérico del español para formatos fuera de catálogo

## 2. Backend — servicio de generación

- [x] 2.1 `documentBuilderService.js`: agregar `formato_reel` a `VARIABLE_META` como `{ label: 'Formato de reel', type: 'select', source: 'contract' }`
- [x] 2.2 `preprocessMissingFieldOverrides`: resolver `formato_reel` **antes** de reescribir `cantidad_reels` (necesita el entero para la concordancia)
- [x] 2.3 `preprocessMissingFieldOverrides`: `cantidad_reels` pasa de `formatThousands` a `formatCantidadReels`
- [x] 2.4 `buildMissingFields`: poblar `field.options` con `FORMATO_REEL_OPTIONS` para `formato_reel`
- [x] 2.5 `documentBuilderVariableContext.js`: agregar `formato_reel: ''` al mapa base junto a `cantidad_reels`

## 3. Frontend — catálogo de variables

- [x] 3.1 `src/data/variableCatalog.js`: agregar `formato_reel` al grupo `contrato`
- [x] 3.2 Actualizar la descripción de `cantidad_reels` para reflejar el nuevo render y su relación con `formato_reel`

## 4. Contenido de plantillas

- [x] 4.1 Respaldar el `content_json` de las 17 plantillas activas en `template_content_backup` (`note = 'pre-formato-reel-clausula-2.3'`)
- [x] 4.2 Insertar en la cláusula 2.3 un nodo texto `" "` + nodo `variable` `formato_reel` inmediatamente después del nodo `cantidad_reels`, clonando los atributos de formato del nodo hermano
- [x] 4.3 Transformación idempotente: no reinsertar si `formato_reel` ya sigue a `cantidad_reels`
- [x] 4.4 No tocar las 4 plantillas inactivas (PL0001–PL0004)

## 5. Tests

- [x] 5.1 `backend/test/formatReels.test.js`: cardinales, apocopación, plurales de catálogo e irregulares, fallback genérico, valores vacíos
- [x] 5.2 Tests de los dos casos textuales pedidos: "un (1) reel" y "tres (3) videos"
- [x] 5.3 `npm test` en backend — suite verde (224 tests)
- [x] 5.4 `npm test` en frontend — suite verde (106 tests)

## 6. Verificación

- [x] 6.1 Local: las 17 plantillas activas renderizan `{{cantidad_reels}} {{formato_reel}}` en la cláusula 2.3
- [x] 6.2 Local: pipeline completo (`preprocessMissingFieldOverrides` → `buildSubstitutionMap` → `applySubstitutionsToTipTapDoc`) produce "un (1) reel", "tres (3) videos" y "doce (12) historias"
- [x] 6.3 Post-deploy pre-prod: `validar_contrato` ofrece `formato_reel` como `select` con las 7 opciones; dos contratos generados con el proveedor de prueba "Quijote ltda." confirman en el PDF "tres (3) videos" (CONTRATO_0001, borrador `bcb3b32a`) y "un (1) reel" (CONTRATO_0002, borrador `57e54335`)
