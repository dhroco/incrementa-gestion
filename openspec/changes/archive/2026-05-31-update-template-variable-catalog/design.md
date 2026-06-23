## Context

El Constructor de Documento resuelve placeholders de plantilla mediante `buildSubstitutionMap` (datos de proveedor, empresa, cliente) más `missingFieldOverrides` para variables de contrato. El catálogo actual (`VARIABLE_META`, `variableCatalog.js`) incluye restos del modelo laboral (`contract_type`, `work_schedule`, `proveedor_tipo`) y variables de firma (`signing_city`, `contract_date`) que no reflejan el dominio comercial actual.

Los proveedores ya exponen `social_networks` (nombre de red + handle) vía `supplierService.getSupplierById`. El flujo de missing fields (`buildMissingFields`) hoy solo enriquece `client_product_campaign` con opciones select simples (strings).

## Goals / Non-Goals

**Goals:**

- Actualizar catálogo backend y frontend: eliminar variables obsoletas, agregar variables comerciales nuevas.
- Implementar pares primario/secundario (`proveedor_red_social`/`proveedor_cuenta_social`, `precio_numero`/`precio_texto`) sin pedir secundarios al usuario.
- Select de redes sociales con opciones `{ label, values }` que despachan múltiples overrides.
- Auto-generar `precio_texto` desde `precio_numero` con utilidad `numberToWords`.
- Formatear overrides numéricos (`cantidad_reels`, `precio_numero`) con separador de miles chileno (punto).
- Extender `MissingFieldInput` para `type: 'number'` y selects con `values`.
- Actualizar descripción MCP `validar_contrato` para pares y opciones compuestas.

**Non-Goals:**

- Migraciones de BD o renombrado de columnas (`signing_city` en BD no se toca).
- Formateo de números en datos que vienen directamente de BD (supplier, company).
- Soporte de moneda o femenino en `numberToWords`.
- Migración automática de plantillas existentes que usen variables obsoletas.

## Decisions

### 1. Constante `SECONDARY_FIELDS` en `documentBuilderService.js`

Mapa secundario → primario:

```js
const SECONDARY_FIELDS = {
  proveedor_cuenta_social: 'proveedor_red_social',
  precio_texto: 'precio_numero'
}
```

`buildMissingFields` normaliza `missingKeys` reemplazando secundarios por primarios, desduplica, y retorna solo primarios con propiedad opcional `pairField` apuntando al secundario. **Alternativa descartada:** metadata embebida en `VARIABLE_META` con `pairedWith` — menos explícita para la regla de omitir secundarios en missing.

### 2. Opciones select: strings vs objetos con `values`

- `client_product_campaign`: opciones siguen siendo strings (`['Verano 2026', ...]`).
- `proveedor_red_social`: opciones son objetos `{ label, values: { proveedor_red_social, proveedor_cuenta_social } }` construidos desde `supplierRow.social_networks` usando `name` y `account_name`.
- Si `social_networks` está vacío, el campo cae a `type: 'text'` (fallback manual).

Frontend: al seleccionar opción objeto, despacha `setMissingField` por cada entry en `values`. Backend/MCP: mismas reglas documentadas en tool description.

### 3. Preprocesamiento de overrides antes de `buildSubstitutionMap`

Nueva función `preprocessMissingFieldOverrides(overrides)` en `documentBuilderService.js`:

1. `cantidad_reels`: parseInt, formatear miles con `.toLocaleString('es-CL')` o regex `\B(?=(\d{3})+(?!\d))` → `.`.
2. `precio_numero`: mismo formateo de miles.
3. `precio_texto`: si `precio_numero` presente, generar con `numberToWords(parseInt(precio_numero))`; ignorar valor manual de `precio_texto`.

Se aplica solo a overrides entrantes, no al map base de BD.

### 4. `buildSubstitutionMap` — entradas base vacías

Agregar claves nuevas con valor `''` para que `unresolvedKeys` las detecte como missing cuando no hay override:

- `proveedor_red_social`, `proveedor_cuenta_social`
- `fecha_contrato`, `lugar_contrato`, `mes_ejecucion`, `cantidad_reels`, `precio_numero`, `precio_texto`

Eliminar: `proveedor_tipo`, `contract_type`, `work_schedule`. Reemplazar `signing_city` y `contract_date` por `lugar_contrato` y `fecha_contrato`.

### 5. Utilidad `numberToWords.js`

Módulo puro en `backend/utils/numberToWords.js`, exporta `numberToWords(n)` para enteros ≥ 0. Algoritmo por bloques (unidades, decenas compuestas 21–29, centenas, miles, millones). Reglas: "un millón"/"un mil" (no "uno mil"), "cien" vs "ciento", masculino genérico. **Alternativa descartada:** librería externa — requisito de control fino sobre reglas contractuales chilenas.

### 6. Renombre `contract_date` → `fecha_contrato`

Consistencia con naming en español del resto de variables de contrato (`lugar_contrato`, `mes_ejecucion`). Tests y catálogo se actualizan; plantillas existentes con `{{contract_date}}` quedarán sin resolver hasta edición manual.

### 7. Firma de `buildMissingFields`

Pasar contexto ampliado: `buildMissingFields(missing, { clientRow, supplierRow })`. Llamada en `generateAndPersist`: `buildMissingFields(missing, { clientRow, supplierRow: supplier })`.

## Risks / Trade-offs

- **[Plantillas con variables obsoletas]** → Documentar en release notes; placeholders quedarán sin resolver hasta actualizar plantillas.
- **[Proveedor sin redes y template con `proveedor_red_social`]** → Fallback a input texto; usuario ingresa manualmente ambos campos vía overrides si el template también usa `proveedor_cuenta_social`.
- **[Precio con decimales]** → Solo enteros soportados; input `type="number"` con `min="0"` y parseInt en backend trunca decimales.
- **[Select con values en frontend]** → Serialización JSON en `<option value>` requiere `JSON.stringify` del objeto values o índice; preferir índice + lookup en `field.options` para evitar problemas de escape.

## Migration Plan

1. Desplegar backend + frontend en conjunto (catálogo y missing fields deben coiner).
2. Revisar plantillas estándar activas: reemplazar `{{signing_city}}` → `{{lugar_contrato}}`, `{{contract_date}}` → `{{fecha_contrato}}`, eliminar referencias a variables removidas.
3. Rollback: revertir deploy; plantillas ya editadas conservan nuevas variables.

## Open Questions

- Ninguna crítica; alcance definido por el solicitante.
