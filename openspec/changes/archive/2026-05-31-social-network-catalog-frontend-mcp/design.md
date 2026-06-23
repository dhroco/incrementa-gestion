## Context

El cambio `social-network-catalog-backend` ya implementó:
- Tabla `social_network_catalog` con 8 redes seed.
- Refactor de `supplier_social_network` con FK `catalog_id`.
- `GET /api/social-networks/catalog` y `listSocialNetworkCatalog()` en `supplierService`.
- Payload create/update de proveedor con `{ catalog_id, account_name }`; respuestas incluyen `code`, `name`.

El frontend de proveedores (`SupplierFormSections.jsx`, `SupplierUpsertPage.jsx`) aún usa:
- Tabla editable con `<select>` de `SOCIAL_NETWORK_OPTIONS` hardcodeadas y campo `network_name`.
- Handlers `onAddSocialNetwork`, `onRemoveSocialNetwork`, `onSocialNetworkChange` por fila.
- `supplierToForm` mapea `network_name` en lugar de `catalog_id`.

MCP `crear_proveedor` / `actualizar_proveedor` no documentan `catalog_id` en redes sociales. No existe herramienta para listar el catálogo.

Restricciones del brief:
- No modificar contrato backend.
- Un solo componente nuevo: `SocialNetworkSelector` (sin subcomponentes).
- Estilos en archivo CSS propio; respetar tokens de `shared-form.css` y variables CSS.
- Íconos SVG locales en `frontend/src/assets/social-networks/`.

## Goals / Non-Goals

**Goals:**
- Componente `SocialNetworkSelector` con modos edición y lectura, íconos por `code`, consumo del catálogo vía API.
- Integrar selector en `SupplierSocialNetworksSection` y actualizar form state / submit payload.
- API client `fetchSocialNetworkCatalog()` en `suppliersApi.js`.
- Assets SVG para las 8 redes del catálogo + ícono genérico fallback.
- MCP: `listar_catalogo_redes`; actualizar descripciones de crear/actualizar proveedor.
- Tests frontend (componente o integración) y MCP.

**Non-Goals:**
- Cambios en backend (migraciones, servicios, rutas).
- CRUD admin del catálogo.
- Subcomponentes dentro de `SocialNetworkSelector` (chips, íconos, etc. van inline en el mismo archivo).
- Carga de íconos desde CDN externo en runtime.

## Decisions

### 1. Estructura del componente SocialNetworkSelector

**Decisión:** componente único en `frontend/src/components/SocialNetworkSelector.jsx` con props:

```javascript
{
  value: Array<{ catalog_id: string, account_name: string, code?: string, name?: string }>,
  onChange?: (networks) => void,
  readOnly?: boolean,
  fieldError?: string
}
```

El componente carga el catálogo internamente con `useEffect` + `fetchSocialNetworkCatalog()` al montar (solo en modo edición o siempre para resolver nombres en lectura). Estado local: `catalogItems`, `loading`, `loadError`.

**Alternativa descartada:** pasar catálogo como prop desde padre — duplica lógica de fetch en cada página; el brief pide carga al montar del formulario y el selector es el punto natural.

### 2. Modo edición: grilla de chips/tarjetas

**Decisión:**
- Grid responsive de tarjetas (CSS grid, gap compacto, estilo ERP).
- Cada tarjeta: ícono SVG + `name` del catálogo.
- Click en tarjeta hace toggle de selección.
- Tarjeta seleccionada: borde/background destacado (tokens existentes, sin colores decorativos).
- Al seleccionar, mostrar `<input className="clause-input">` inline debajo del nombre con placeholder `@nombre_cuenta` o `Ej: @miempresa`.
- Deseleccionar elimina la red del array `value`.
- `onChange` emite array completo `{ catalog_id, account_name }[]` — solo redes seleccionadas con account no vacío al submit (validación en padre).

**Alternativa descartada:** mantener tabla con filas dinámicas — contradice el brief de selector visual por catálogo.

### 3. Modo lectura

**Decisión:** lista compacta o mini-grid de solo redes en `value`, cada ítem con ícono + nombre + handle. Sin interacción. Mensaje vacío: "No hay redes sociales registradas." (clase `clause-list-empty`).

### 4. Mapeo de íconos SVG

**Decisión:**
- Directorio `frontend/src/assets/social-networks/`.
- Un SVG por `code` del catálogo: `instagram.svg`, `facebook.svg`, `linkedin.svg`, `x.svg`, `tiktok.svg`, `youtube.svg`, `whatsapp_business.svg`, `pinterest.svg`.
- Helper inline en el componente (no archivo separado):

```javascript
const iconModules = import.meta.glob('../assets/social-networks/*.svg', { eager: true, import: 'default' })
function resolveSocialIconUrl(code) {
  return iconModules[`../assets/social-networks/${code}.svg`] ?? iconModules['../assets/social-networks/generic.svg']
}
```

- `generic.svg`: ícono neutro de red social para codes sin asset.

**Alternativa descartada:** react-icons o MUI icons — el brief exige SVGs locales nombrados por code; mantiene control de marca.

### 5. Estilos

**Decisión:** `frontend/src/components/SocialNetworkSelector.css` importado desde el componente. Usar variables CSS existentes (`--border-radius-card`, colores de borde `#E3E6E8`, tipografía heredada). Patrón visual similar a `supplier-type-chip` pero adaptado a grid de selección.

**Alternativa descartada:** estilos inline — inconsistente con el proyecto.

### 6. Refactor SupplierSocialNetworksSection

**Decisión:**
- Reemplazar tabla y handlers de fila por `<SocialNetworkSelector value={...} onChange={...} readOnly={readOnly} fieldError={fieldErrors.social_networks} />`.
- Simplificar props: eliminar `onSocialNetworkChange`, `onAddSocialNetwork`, `onRemoveSocialNetwork` de la sección (y propagación en `SupplierFormSections`, `SupplierUpsertPage`).
- Nuevo handler único en `SupplierUpsertPage`: `onSocialNetworksChange(networks)` → `setForm(f => ({ ...f, social_networks: networks }))`.
- Actualizar `supplierToForm`: mapear `{ catalog_id, account_name, code, name }` desde API.
- Actualizar `isSocialNetworkRowComplete` → validar `{ catalog_id, account_name }` ambos no vacíos.
- Actualizar `socialNetworksForSubmit`: emitir `{ catalog_id, account_name }`.
- Eliminar `SOCIAL_NETWORK_OPTIONS` y `socialNetworkSelectOptions`.

**Alternativa descartada:** mantener handlers legacy y adaptar internamente — innecesario; el nuevo UX no usa filas.

### 7. API client

**Decisión:** en `suppliersApi.js`:

```javascript
export async function fetchSocialNetworkCatalog({ accessToken, signal } = {}) {
  return apiGet('/api/social-networks/catalog', { accessToken, signal })
}
```

`SocialNetworkSelector` obtiene token vía hook/contexto existente del proyecto (patrón de otras páginas con `useSelector` + `accessToken` o prop `accessToken` — confirmar en implementación el patrón usado en `SupplierUpsertPage`).

### 8. MCP listar_catalogo_redes

**Decisión:** nueva herramienta que llama `supplierService.listSocialNetworkCatalog()` directamente (coherente con regla "no HTTP interno" de MCP). Retorna `{ ok: true, data: { items: [{ id, code, name }] } }` — omitir `sort_order` en respuesta MCP si no aporta a Claude; incluir si el servicio ya lo devuelve.

Descripción de herramienta: "Lista el catálogo de redes sociales disponibles. Llama ANTES de crear o actualizar redes sociales de un proveedor para obtener los catalog_id (UUID) correctos."

Actualizar descripciones de `crear_proveedor` y `actualizar_proveedor` para documentar:

```
social_networks: [{ catalog_id: UUID del catálogo, account_name: handle ej. @miempresa }]
```

Instruir en descripción que Claude debe invocar `listar_catalogo_redes` primero.

**Alternativa descartada:** llamar `GET /api/social-networks/catalog` vía fetch desde MCP — viola convención del proyecto.

### 9. Tests

**Decisión:**
- `backend/test/mcpServer.test.js`: test `listar_catalogo_redes` retorna items con id/code/name; verificar descripción actualizada en schema (si testeable).
- Frontend: test de `SocialNetworkSelector` o integración en `SupplierFormSections` mockando `fetchSocialNetworkCatalog` — verificar toggle, input handle, payload en submit.

## Risks / Trade-offs

- **[Riesgo] Catálogo no cargado antes de render en edición de proveedor existente** → Mitigación: mostrar skeleton/loading en selector; inicializar `value` desde `supplierToForm` con `catalog_id` aunque catálogo aún cargue; resolver nombres al llegar catálogo.
- **[Riesgo] SVG faltante para nuevo code en migración futura** → Mitigación: `generic.svg` fallback.
- **[Riesgo] Claude Desktop no registra nueva herramienta MCP** → Mitigación: documentar reinicio en tasks.
- **[Riesgo] Validación de redes incompletas (seleccionada sin handle)** → Mitigación: validación en submit existente adaptada a `catalog_id`; opcionalmente deshabilitar submit o mostrar error inline.
- **[Trade-off] Componente monolítico vs subcomponentes** → Aceptado por restricción del brief.

## Migration Plan

1. Añadir assets SVG y componente `SocialNetworkSelector`.
2. Refactorizar `SupplierFormSections`, `SupplierUpsertPage`, `SupplierViewPage` (solo props si aplica).
3. Actualizar `suppliersApi.js`.
4. Desplegar frontend.
5. Actualizar `mcpTools.mjs` y tests MCP.
6. Reiniciar Claude Desktop en estaciones de desarrollo.
7. Verificar: crear proveedor con redes → vista muestra íconos → MCP `listar_catalogo_redes` → crear/actualizar con `catalog_id`.

**Rollback:** revertir frontend/MCP; backend sigue compatible. UI antigua con `network_name` dejaría de funcionar contra API actual — rollback frontend implica no editar redes hasta re-desplegar versión alineada.

## Open Questions

- Ninguna bloqueante: el brief define UX, assets, payload y alcance MCP. Confirmar en implementación el mecanismo exacto de acceso al token en `SocialNetworkSelector` (prop vs hook Redux) según patrón ya usado en páginas de proveedor.
