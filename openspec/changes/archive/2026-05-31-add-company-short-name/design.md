## Context

La tabla `company` almacena `business_name` (razón social) y datos de identificación fiscal, pero no un nombre abreviado para uso contractual. Los contratos referencian a la contratante con un nombre corto (p. ej. "Dynamics" vs "Dynamics Corp. SpA"). Hoy las plantillas deben hardcodear ese texto o reutilizar la razón social completa.

El patrón de validación en `companyService.validateCompanyPayload` ya distingue create (`requireAll: true`) de update (`requireAll: false`) retornando `undefined` para campos omitidos — comportamiento reutilizable para `short_name`.

El formulario de empresa usa layout compartido (`CompanyCreateLayout` / `CompanyEditLayout`) con estado en outlet context y helpers en `companyFormPayload.js`. Las variables de plantilla siguen convención `company_*` en sustitución y catálogo frontend.

## Goals / Non-Goals

**Goals:**

- Columna `short_name TEXT NOT NULL` en `company` con backfill desde `business_name`.
- Validación obligatoria en create (backend + frontend); en edit, obligatorio en UI pero update parcial sin `short_name` no sobrescribe valor existente.
- Campo "Nombre comercial" en formularios entre Razón Social y RUT; visible en vista de detalle.
- Variable `company_nombre_comercial` en sustitución, `VARIABLE_META` y catálogo frontend.
- MCP `listar_empresas` incluye `short_name`.

**Non-Goals:**

- Mostrar `short_name` en `CompaniesListPage` (tabla de listado).
- Renombrar columna BD (`short_name` permanece; variable de plantilla es `company_nombre_comercial`).
- Permitir overrides de `company_nombre_comercial` vía missing fields (valor solo desde BD).
- Cambiar permisos CASL ni rutas API existentes.

## Decisions

### 1. Migración con backfill en tres pasos

**Decisión:** `202606010004_add_short_name_to_company.js`:

1. `ALTER TABLE company ADD short_name TEXT NULL`
2. `UPDATE company SET short_name = business_name WHERE short_name IS NULL`
3. `ALTER COLUMN short_name SET NOT NULL`

**Alternativa descartada:** NOT NULL directo con default `' '` — pierde backfill semántico y obliga default artificial.

### 2. Nombre de variable de plantilla vs columna BD

**Decisión:** columna BD `short_name`; placeholder `company_nombre_comercial` en mapa de sustitución y catálogos. Alineado con convención `company_legal_name` ← `business_name`.

**Alternativa descartada:** renombrar a `company_short_name` en plantillas — inconsistente con brief y etiqueta de negocio "Nombre comercial".

### 3. Validación backend create vs update

**Decisión:** en `validateCompanyPayload`:

- Leer `payload.short_name ?? payload.shortName`
- Si `requireAll && !shortName` → error `'Nombre comercial es obligatorio.'`
- Retornar `short_name: shortName !== null ? shortName : undefined`

Create usa `requireAll: true`; update usa `requireAll: false` — ausencia de campo no borra valor en BD.

### 4. Layout del formulario

**Decisión:** fila 1: Razón Social + Nombre comercial (dos columnas `clause-form-col`); fila 2: RUT (ancho completo o columna única). Campo con asterisco rojo obligatorio; `canSubmit` exige `isNonEmptyString(shortName)`.

**Alternativa descartada:** agregar al final del formulario — viola restricción del brief (entre Razón Social y RUT).

### 5. Estado en layouts create/edit

**Decisión:** `shortName` / `setShortName` en outlet context de ambos layouts. `CompanyEditLayout` inicializa `setShortName(data?.short_name ?? '')` al cargar empresa.

### 6. MCP listar_empresas

**Decisión:** agregar `c.short_name` al select de Knex y mapear `{ id, business_name, short_name, rut }`. Sin cambio de firma de la herramienta.

## Risks / Trade-offs

- **[Riesgo] Despliegue backend antes de migración** → Mitigación: ejecutar `knex migrate:latest` antes de probar; documentar en plan de migración.
- **[Riesgo] Empresas existentes con backfill idéntico a razón social** → Mitigación: aceptado; usuarios pueden editar nombre comercial después.
- **[Riesgo] Update API sin `short_name` deja valor anterior** → Mitigación: comportamiento deseado; UI de edit siempre envía el campo.
- **[Trade-off] Variable no editable en missing fields** → Coherente con otras variables `company_*` de origen BD.

## Migration Plan

1. Ejecutar migración: `cd backend && npm run migrate:latest`.
2. Desplegar backend (companyService, variable context, MCP).
3. Desplegar frontend (formularios, vista, catálogo).
4. Verificar: crear empresa con nombre comercial distinto de razón social; generar documento con `{{company_nombre_comercial}}`.
5. Reiniciar cliente MCP; invocar `listar_empresas` y confirmar `short_name`.

**Rollback:** `knex migrate:rollback` elimina columna; frontend/backend previos fallarán si esperan `short_name` — revertir código en conjunto.

## Open Questions

- Ninguna bloqueante: el brief fija campo obligatorio, posición en formulario y nombre de variable.
