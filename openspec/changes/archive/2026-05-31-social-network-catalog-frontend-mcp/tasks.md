## 1. Assets e íconos SVG

- [x] 1.1 Crear directorio `frontend/src/assets/social-networks/` con SVGs para los 8 codes del catálogo: `instagram`, `facebook`, `linkedin`, `x`, `tiktok`, `youtube`, `whatsapp_business`, `pinterest`
- [x] 1.2 Añadir `generic.svg` como fallback para codes sin ícono dedicado

## 2. API client

- [x] 2.1 En `frontend/src/api/suppliersApi.js`: implementar `fetchSocialNetworkCatalog({ accessToken, signal })` que llame `GET /api/social-networks/catalog`

## 3. Componente SocialNetworkSelector

- [x] 3.1 Crear `frontend/src/components/SocialNetworkSelector.jsx`: cargar catálogo una vez al montar; props `value`, `onChange`, `readOnly`, `fieldError`
- [x] 3.2 Implementar modo edición: grilla de tarjetas con toggle de selección e input inline para handle (`placeholder` claro, ej. `@miempresa`)
- [x] 3.3 Implementar modo lectura: lista de redes asignadas con ícono + nombre + handle; estado vacío en español
- [x] 3.4 Mapear íconos por `code` vía `import.meta.glob` con fallback a `generic.svg`
- [x] 3.5 Crear `frontend/src/components/SocialNetworkSelector.css` con estilos alineados a tokens ERP (borde `#E3E6E8`, cards, densidad compacta)

## 4. Integración en formulario de Proveedor

- [x] 4.1 En `SupplierFormSections.jsx`: reemplazar tabla editable por `SocialNetworkSelector`; eliminar `SOCIAL_NETWORK_OPTIONS`, `socialNetworkSelectOptions` y handlers por fila
- [x] 4.2 Actualizar `supplierToForm` para mapear `{ catalog_id, account_name, code, name }`; actualizar `isSocialNetworkRowComplete`, `validateSocialNetworksForForm` y `socialNetworksForSubmit` para usar `catalog_id`
- [x] 4.3 En `SupplierUpsertPage.jsx`: reemplazar handlers `onSocialNetworkChange` / `onAddSocialNetwork` / `onRemoveSocialNetwork` por `onSocialNetworksChange` único; ajustar submit payload
- [x] 4.4 Verificar `SupplierViewPage.jsx` pasa props correctas a la sección en modo lectura (sin handlers de edición)

## 5. Tests frontend

- [x] 5.1 Añadir test de `SocialNetworkSelector` o integración en formulario de proveedor: mock de catálogo, toggle de red, handle, payload `{ catalog_id, account_name }`

## 6. MCP

- [x] 6.1 En `backend/mcpTools.mjs`: agregar herramienta `listar_catalogo_redes` que llame `supplierService.listSocialNetworkCatalog()` y retorne `id`, `code`, `name`
- [x] 6.2 Actualizar descripciones de `crear_proveedor` y `actualizar_proveedor` documentando `social_networks: [{ catalog_id, account_name }]` e instruyendo llamar `listar_catalogo_redes` primero
- [x] 6.3 En `backend/test/mcpServer.test.js`: test para `listar_catalogo_redes` retorna items del catálogo

## 7. Verificación

- [x] 7.1 Ejecutar tests frontend y backend afectados
- [x] 7.2 Verificación manual: crear proveedor con redes vía selector → vista muestra íconos → editar precarga handles → MCP `listar_catalogo_redes` → crear/actualizar con `catalog_id` (reiniciar Claude Desktop tras despliegue MCP)
