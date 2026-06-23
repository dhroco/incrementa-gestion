## Context

El módulo de Proveedores (`suppliers-admin`) expone CRUD completo con un formulario monolítico en `SupplierFormSections.jsx`. Tras la migración a GCS, existen tablas `draft_document` (borradores/en progreso) y `document` (contratos firmados) vinculadas por `supplier_id`. El proyecto hermano gestion-control ya implementa el patrón deseado en la ficha de Trabajador: cajitas apiladas en creación, pestañas en ver/editar, y panel de historial contractual.

Incrementa-gestion usa autorización CASL (`authorize('read', 'Supplier')`) en lugar de grants de navegación legacy. Las clases CSS de tabs y bloques existen en gestion-control (`ClauseForm.css`) pero no en `shared-form.css` de incrementa-gestion.

## Goals / Non-Goals

**Goals:**

- Alinear la UX de Proveedores con el patrón de Trabajador (cajitas en crear, tabs en ver/editar).
- Refactorizar el formulario en secciones reutilizables (`SupplierBasicDataSection`, `SupplierSocialNetworksSection`).
- Exponer antecedentes contractuales del proveedor: contratos firmados (`document`) y en progreso (`draft_document` con `status != 'signed'`).
- Servir PDFs inline en el navegador vía fetch + blob URL (no descarga forzada).
- Mantener validación existente y navegar a la pestaña con error al enviar.

**Non-Goals:**

- Crear un componente genérico de tabs reutilizable en todo el sistema.
- Modificar el flujo de generación de documentos en Document Builder.
- Eliminar proveedores, filtros avanzados de documentos, o acciones sobre borradores desde esta pantalla.
- Migraciones de base de datos (las tablas ya existen).

## Decisions

### 1. CSS en `shared-form.css` (no archivo separado)

**Decisión:** Portar las clases de tabs y bloques desde gestion-control a `frontend/src/styles/shared-form.css`.

**Rationale:** Todas las páginas de formulario de incrementa-gestion ya importan `shared-form.css`. Evita duplicar imports ni crear un `ClauseForm.css` paralelo.

**Alternativa descartada:** Importar `ClauseForm.css` de gestion-control — proyectos separados, no viable.

### 2. Refactor de secciones sin componente wrapper obligatorio

**Decisión:** Extraer `SupplierBasicDataSection` y `SupplierSocialNetworksSection` como exports nombrados. Mantener `SupplierFormSections` como composición de ambas (compatibilidad) o eliminarlo si solo lo usan las páginas que se refactorizan.

**Rationale:** Las páginas controlan el layout (cajitas vs tabs); las secciones solo encapsulan campos.

### 3. Tabs inline en páginas (sin componente genérico)

**Decisión:** Implementar el markup de tabs directamente en `SupplierUpsertPage` (edit) y `SupplierViewPage`, copiando la estructura de `EmployeeUpsertPage`:

```jsx
const SUPPLIER_TABS = [
  { id: 'datos_basicos', label: 'Datos básicos' },
  { id: 'redes_sociales', label: 'Redes sociales' },
  { id: 'antecedentes', label: 'Antecedentes contractuales' }
]
```

**Rationale:** El brief pide explícitamente el patrón inline de gestion-control sin abstracción genérica.

### 4. Mapeo de errores de validación a pestañas

**Decisión:** Agregar helper `getFirstSupplierFormTabWithErrors(fieldErrors)` en `SupplierFormSections.jsx` o un pequeño `supplierFormUtils.js`, mapeando campos básicos → `datos_basicos`, `social_networks` → `redes_sociales`.

**Rationale:** Mismo patrón probado en `employeeFormUtils.js`. La pestaña "Antecedentes contractuales" es solo lectura — no recibe errores de validación del formulario principal.

### 5. API de documentos del proveedor

**Decisión:** Nuevo endpoint `GET /api/suppliers/:id/documents` en `supplierService` + `supplierController`.

**Consultas:**

- `signed_documents`: `document` JOIN `template` ON `document.template_id = template.id` WHERE `document.supplier_id = :id`, ORDER BY `signed_at DESC NULLS LAST, created_at DESC`.
- `draft_documents`: `draft_document` JOIN `template` WHERE `supplier_id = :id` AND `status != 'signed'`, ORDER BY `created_at DESC`.

**Respuesta:**

```json
{
  "signed_documents": [{ "id", "template_name", "file_name", "signed_at", "effective_from", "effective_until" }],
  "draft_documents": [{ "id", "template_name", "file_name", "status", "created_at" }]
}
```

**Autorización:** `authorize('read', 'Supplier')` + verificar que el proveedor existe (404 si no).

### 6. Visualización PDF inline

**Decisión:** Dos endpoints de descarga con `Content-Disposition: inline`:

| Origen | Endpoint | Cambio |
|--------|----------|--------|
| `draft_document` | `GET /api/document-builder/downloads/:id` | Cambiar `attachment` → `inline` en `documentBuilderController.getDownload` |
| `document` (firmado) | `GET /api/documents/:id/view` (nuevo) | Leer `gcs_path` + `file_name` de `document`, `gcsService.downloadBuffer`, servir PDF inline |

**Frontend:** Botón "Ver" hace `fetch` autenticado al endpoint correspondiente, obtiene `blob`, crea `URL.createObjectURL(blob)`, abre con `window.open(url, '_blank')`, revoca URL tras un timeout corto.

**Alternativa descartada:** URL firmada de GCS al cliente — expone rutas de bucket y complica permisos.

### 7. `SupplierDocumentHistoryPanel`

**Decisión:** Componente dedicado en `frontend/src/pages/SupplierDocumentHistoryPanel.jsx`, modelado tras `EmployeeContractHistoryPanel` pero con dos tablas:

1. **Contratos firmados** — columnas: Plantilla, Nombre de archivo, Fecha firma, Vigencia desde, Vigencia hasta, Acción.
2. **Contratos en progreso** — columnas: Plantilla, Nombre de archivo, Estado (chip/texto legible), Fecha creación, Acción.

Estados legibles: `draft` → "Borrador", `pending_signature` → "Pendiente firma", `rejected` → "Rechazado".

Solo carga cuando `supplierId` y `accessToken` tienen valor. Estados: loading ("Cargando..."), error (`.clause-error`), vacío (mensajes específicos por tabla).

**Clases:** `.clause-list-table`, `.clause-list-table-wrap`.

### 8. Modo Crear vs Ver/Editar

| Modo | Layout | Contenido |
|------|--------|-----------|
| Crear | `.company-form-page-stack` con 2 `.clause-card.company-form-block-card` | Datos básicos + Redes sociales (sin tab Antecedentes — no hay `supplierId`) |
| Editar | Tabs (3 pestañas) | Datos básicos, Redes sociales, Antecedentes contractuales |
| Ver (solo lectura) | Tabs (3 pestañas) | Mismas secciones con `readOnly={true}` |

## Risks / Trade-offs

- **[Cambio de Content-Disposition en draft downloads]** → Puede afectar flujos que esperaban descarga forzada. Mitigación: verificar usos existentes del endpoint; el brief indica que inline es el comportamiento deseado para visualización.
- **[PDFs grandes en memoria]** → `downloadBuffer` carga el archivo completo. Mitigación: aceptable para contratos PDF típicos; streaming queda fuera de alcance.
- **[Object URLs no revocados]** → Fuga menor de memoria. Mitigación: `URL.revokeObjectURL` tras abrir la pestaña.
- **[Tab Antecedentes vacía en proveedores nuevos]** → Solo visible en ver/editar con ID persistido; crear no la muestra (comportamiento correcto).

## Migration Plan

1. Desplegar backend (nuevo endpoint documents + view PDF + cambio inline en downloads).
2. Desplegar frontend (CSS, refactor secciones, páginas, panel, API client).
3. Sin migraciones BD. Rollback: revertir deploy; endpoints nuevos son aditivos salvo el cambio de `Content-Disposition`.

## Open Questions

- ¿El endpoint `GET /api/documents/:id/view` debe validar también permiso de Document Builder o solo `read Supplier`? **Resolución propuesta:** Solo `read Supplier` + verificar que el documento pertenece a un proveedor accesible (el proveedor es entidad global en este módulo).
- ¿Incluir `company_id` en la respuesta de documentos? **Resolución propuesta:** No en v1; las columnas de la UI no lo requieren. El download de drafts sigue usando `companyId` query param existente si el servicio lo exige.
