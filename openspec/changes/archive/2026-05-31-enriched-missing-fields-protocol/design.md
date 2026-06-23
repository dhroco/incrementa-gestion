## Context

El módulo Clientes ya está implementado: tablas `client` / `client_product_campaign`, CRUD, variables `client_name`, `client_brand`, `client_brand_account` en `buildSubstitutionMap`, y selección opcional en Document Builder. La UI aún usa la etiqueta genérica «Campaña» aunque el dominio de negocio distingue producto y campaña. La variable `client_product_campaign` no existe en catálogo ni en sustitución — es un valor contractual por documento que debe elegirse entre las campañas del cliente o ingresarse manualmente.

Hoy, cuando `generateAndPersist` detecta placeholders sin resolver, devuelve `data.missingFieldKeys: string[]`. El frontend (`DocumentBuilderPage.jsx`) y `apiClient.js` parsean esa lista plana; el usuario solo ve inputs de texto genéricos. El MCP expone `validar_contrato` con la misma respuesta. No hay validación proactiva al seleccionar plantilla — el usuario descubre campos faltantes solo al pulsar Generar.

Restricciones del brief: no renombrar columnas BD ni firma de `buildSubstitutionMap`; `client_product_campaign` solo vía overrides; dry-run progresivo solo si `stage1Ok`; flujo 409 duplicado sin cambios; mismo endpoint `/api/document-builder/generate` con `dryRun: true`.

## Goals / Non-Goals

**Goals:**

- Unificar terminología UI «Producto/Campaña» en páginas de Clientes (solo textos visibles).
- Registrar `client_product_campaign` en catálogo frontend y mapa de sustitución (base vacía).
- Introducir `VARIABLE_META` extensible en backend con `label`, `type` (`text` | `date` | `select`) y `options` dinámicas.
- Reemplazar `missingFieldKeys` por `missingFields` en respuesta de servicio y HTTP 422 (`meta.missingFields`).
- Document Builder: dry-run automático al completar stage2 (plantilla seleccionada con proveedor+empresa); inputs tipados; limpiar overrides al cambiar plantilla/proveedor/empresa; habilitar Generar solo con todos los campos completos.
- Actualizar descripción MCP de `validar_contrato` para guiar interacción según `type`.

**Non-Goals:**

- Migraciones de BD o nuevos endpoints.
- Renombrar `product_campaigns` en API, servicios o Redux.
- Compatibilidad hacia atrás con `missingFieldKeys` (breaking change aceptado).
- Autocompletar `client_product_campaign` desde BD sin override explícito.
- Nuevo catálogo dinámico de variables en runtime (mapa estático extensible manualmente).

## Decisions

### 1. Mapa estático `VARIABLE_META` en `documentBuilderService.js`

**Decisión:** Definir `VARIABLE_META` y `getVariableMeta(key)` en el servicio, con fallback `{ label: key, type: 'text' }`.

**Rationale:** Centraliza metadatos donde ya se calculan campos faltantes; extensible agregando entradas sin tocar lógica de resolución. Variables conocidas iniciales: `client_product_campaign` (select), `contract_date` (date), `signing_city` (text).

**Alternativa descartada:** Mover metadatos a `variableCatalog.js` del frontend y duplicar en backend — riesgo de desincronización.

### 2. Opciones de select desde `clientRow.product_campaigns`

**Decisión:** Al construir `missingFields`, si `key === 'client_product_campaign'` y el cliente cargado tiene campañas, incluir `options: product_campaigns.map(c => c.name)`.

**Rationale:** Reutiliza datos ya cargados en `generateAndPersist`; no requiere query adicional. Si no hay cliente o campañas vacías, el campo queda `type: 'text'` (fallback de meta) o select sin options — el brief prioriza select con options cuando existen.

### 3. Formato HTTP 422 unificado

**Decisión:** Controller retorna:

```json
{
  "error": { "code": "MISSING_PLACEHOLDERS", "message": "..." },
  "meta": { "missingFields": [...], "timestamp": "..." }
}
```

Eliminar `missingFieldKeys` de `error` y de `data` del servicio.

**Rationale:** Alinea con patrón existente de `meta` para datos auxiliares; `apiClient.js` ya normaliza `meta`.

### 4. Dry-run progresivo en Document Builder

**Decisión:** `useEffect` dependiente de `[templateSelected, selectedSupplierId, companyId, selectedClientId, stage1Ok, stageTemplateOk]` que:
1. Si `!stage1Ok` → no ejecutar.
2. Al cambiar dependencias → `clearMissingFields()` y reset overrides locales.
3. Llama `postDocumentBuilderGenerate({ ..., dryRun: true })`.
4. Si `ok` → estado «listo»; si 422 → poblar `missingFields` en Redux desde `res.missingFields`.

**Rationale:** Misma ruta y permisos que generación real; evita sorpresa al pulsar Generar. Incluir `selectedClientId` porque afecta options de `client_product_campaign`.

**Alternativa descartada:** Endpoint dedicado `/validate` — duplicaría autorización y lógica.

### 5. Estado Redux `missingFields` enriquecido

**Decisión:** Mantener slice existente pero almacenar por key los valores de override; la definición de campos (label, type, options) vive en estado local del componente derivado de la respuesta dry-run, no en Redux.

**Rationale:** Redux ya guarda overrides `{ [key]: value }`; metadatos son efímeros por sesión de plantilla.

### 6. Inputs tipados en UI

**Decisión:** Render condicional por `field.type`:
- `text` → `<input type="text">`
- `date` → `<input type="date">` (formato ISO YYYY-MM-DD)
- `select` + `options` → `<select>` con placeholder vacío inicial

**Rationale:** Nativo HTML, consistente con guías ERP compactas; sin librería de date picker adicional.

### 7. Labels UI sin tocar código interno

**Decisión:** Reemplazos puntuales en strings JSX/aria de `ClientFormSections.jsx` y header de `ClientListPage.jsx`.

**Rationale:** Cumple restricción de no renombrar props/tablas; mejora UX inmediata.

### 8. `client_product_campaign` en `buildSubstitutionMap`

**Decisión:** Agregar `client_product_campaign: ''` al grupo client; valor final solo si `overrides.client_product_campaign` está presente.

**Rationale:** Placeholder sin override queda unresolved → aparece en `missingFields`; coherente con `contract_date` y otras variables manuales.

## Risks / Trade-offs

- **[Breaking API]** Consumidores externos de `missingFieldKeys` fallarán → Mitigación: único consumidor es frontend y MCP del mismo repo; actualizar en mismo PR.
- **[Dry-run extra]** Una llamada HTTP adicional por cambio de plantilla → Mitigación: dry-run no persiste ni genera PDF; costo bajo.
- **[Race en useEffect]** Cambios rápidos de plantilla pueden desordenar respuestas → Mitigación: flag de cancelación o ignorar respuestas obsoletas comparando template id al resolver.
- **[Select sin options]** Cliente sin campañas pero template requiere variable → Mitigación: fallback a input text; usuario ingresa valor libre vía override.
- **[Mapa estático]** Nuevas variables requieren editar `VARIABLE_META` → Mitigación: documentado; fallback `text` evita bloqueo.

## Migration Plan

1. Desplegar backend primero (nuevo formato 422); frontend antiguo seguiría funcionando parcialmente hasta actualizar parsing.
2. Desplegar frontend con lectura de `missingFields`.
3. Reiniciar proceso MCP / Claude Desktop para cargar descripción actualizada de `validar_contrato`.
4. Rollback: revertir commit; no hay migración de datos.

## Open Questions

- Ninguna crítica — alcance definido en el brief. Si en el futuro hay muchas variables tipadas, evaluar compartir catálogo frontend/backend en un módulo común.
