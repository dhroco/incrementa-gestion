## Context

Incrementa-Gestión administra contratos donde la primera parte es siempre Incrementa/Dynamics Corp Spa (entidad `company`) y la segunda parte es el proveedor contractual. No existe hoy entidad ni UI para proveedores. El sistema ya tiene patrones maduros para entidades globales de administración (empresas, usuarios plataforma), empleados con RUT chileno (`utils/rut.js`, `employeeService.js`) y autorización vía nodos de navegación + grants (`navigation_node`, `profile_navigation_grant`).

Restricciones del cambio:
- Proveedores son **globales** (sin `company_id`).
- Dos tipos: `persona_natural` y `empresa`, con campos condicionales y acreditación de personería opcional solo para empresa.
- Redes sociales: relación 1:N en `supplier_social_network`.
- Navegación bajo **Administración global** (`NAV_MENU_ADMIN_GLOBAL`); **no** crear menú padre `NAV_MENU_PROVEEDORES`.
- Seguir guías visuales de `openspec/config.yaml` y patrones de páginas de trabajadores.

## Goals / Non-Goals

**Goals:**
- Persistir proveedores y redes sociales con migración Knex reversible.
- Exponer API REST CRUD (list, detail, create, update) con auth JWT + grants.
- Registrar navegación, grants iniciales para `ADMINISTRADOR_PLATAFORMA` y UI completa (listado, detalle, alta/edición).
- Validar RUT en backend y frontend; mostrar RUT como `XX.XXX.XXX-X`.
- Ordenar listado: empresas primero, luego personas naturales; alfabético dentro de cada grupo.

**Non-Goals:**
- Eliminar proveedores (soft/hard delete).
- Asociar proveedores a contratos o document builder en este cambio.
- Duplicar proveedores por empresa o scoping multi-tenant.
- Grants para perfiles distintos de `ADMINISTRADOR_PLATAFORMA` (extensible después vía seed/grants).
- Ícono para `NAV_MENU_PROVEEDORES` (no existe ese nodo; solo `NAV_ITEM_PROVEEDORES_PROVEEDORES`).

## Decisions

### 1. Modelo de datos en dos tablas

`supplier` con columnas planas para ambos tipos (campos no aplicables quedan NULL) y `supplier_social_network` con FK `ON DELETE CASCADE`.

**Alternativa descartada**: tablas separadas `supplier_person` / `supplier_company` — más joins y complejidad en API sin beneficio inmediato.

### 2. Validación de RUT reutilizando `utils/rut.js`

`createSupplier` / `updateSupplier` llaman `parseRut()` sobre RUT compuesto o body+dv según tipo, igual que `employeeService`. Respuesta incluye campo calculado `rut` formateado para display (helper local `_formatRutDisplay` como en empleados).

**Alternativa descartada**: validar solo en frontend — insuficiente para datos sensibles.

### 3. Redes sociales: replace-all en update

`updateSupplier` ejecuta `DELETE FROM supplier_social_network WHERE supplier_id = ?` e inserta la lista enviada, dentro de transacción. El payload `social_networks` es array de `{ network_name, account_name, sort_order? }`.

**Alternativa descartada**: diff por id — el brief no exige edición parcial y añade complejidad innecesaria.

### 4. Navegación bajo Administración global

Nodos:
| code | label | parent |
|------|-------|--------|
| `NAV_ITEM_PROVEEDORES_PROVEEDORES` | Proveedores | `NAV_MENU_ADMIN_GLOBAL` |
| `NAV_ACTION_PROVEEDORES_READ` | Ver proveedores | ítem |
| `NAV_ACTION_PROVEEDORES_CREATE` | Crear proveedor | ítem |
| `NAV_ACTION_PROVEEDORES_EDIT` | Editar proveedor | ítem |

Ruta: `/app/proveedores`. Migración `202605290004` hace `SELECT id FROM navigation_node WHERE code = 'NAV_MENU_ADMIN_GLOBAL'` antes de insertar; otorga grants READ+CREATE+EDIT a `ADMINISTRADOR_PLATAFORMA` siguiendo patrón de `202604250001`.

**Alternativa descartada**: menú top-level Proveedores — contradice requisito de colgar de Admin Global.

### 5. API y controller delgados

`supplierController.js` extrae `userId` de sesión OIDC (patrón `employeeController`), delega a servicio, mapea errores a HTTP (404, 400 con mensaje español).

Rutas en `app.js`:
- `GET /api/suppliers` → READ
- `GET /api/suppliers/:id` → READ
- `POST /api/suppliers` → CREATE
- `PUT /api/suppliers/:id` → EDIT (opcionalmente `anyOf` CREATE+EDIT como empleados para pantalla compartida de alta/edición)

### 6. Frontend: tres páginas + secciones compartidas

- `SupplierListPage`: búsqueda en subheader (`list-search-field`), tabla con chip de tipo, links Ver/Editar en `--color-selection`.
- `SupplierViewPage`: secciones condicionales solo lectura.
- `SupplierUpsertPage` + `SupplierFormSections`: tipo fijo en edición; radio selector en creación; filas dinámicas de redes sociales.

Permisos: `proveedoresAuth.js` con `canMutateProveedores` (CREATE OR EDIT), análogo a `trabajadoresAuth.js`.

Rutas en `AppRouter.jsx` con guards de grant READ/CREATE/EDIT como empleados.

### 7. Ordenamiento en listSuppliers

SQL/Knex: `ORDER BY CASE supplier_type WHEN 'empresa' THEN 0 ELSE 1 END`, luego `COALESCE(razon_social, full_name) ASC`.

### 8. Sidebar iconography

Agregar entrada solo para `NAV_ITEM_PROVEEDORES_PROVEEDORES` (p. ej. `handshake` o `badge` Material icon key existente en el mapa). No agregar clave inexistente `NAV_MENU_PROVEEDORES`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Campos NULL de tipo incorrecto en BD | Validar `supplier_type` y campos requeridos en servicio antes de insert/update |
| Migración nav en BD ya seedeada duplica nodos | Usar upsert por `code` o verificar existencia antes de insert en `202605290004` |
| RUT duplicado entre proveedores | Fuera de alcance; documentar como mejora futura (unique index) |
| Part 9 del brief menciona `NAV_MENU_PROVEEDORES` | Design alinea con Part 4: solo ítem bajo Admin Global |
| Sin tests automatizados | Incluir en tasks verificación manual + opcional `supplierApi.test.js` |

## Migration Plan

1. Implementar código en branch.
2. `npm run migrate:latest` en backend (migraciones `202605290003` y `202605290004`).
3. En entorno fresh: `knex seed:run` incluye nodos vía seed actualizado.
4. Smoke: login como admin plataforma → Administración global → Proveedores → crear Persona Natural y Empresa con redes → ver detalle → editar.
5. Desplegar backend + frontend a dev/prod tras tests.

**Rollback**: `migrate:down` elimina tablas y nodos insertados; datos de proveedores se pierden en down de tablas.

## Open Questions

- ¿Se requiere índice UNIQUE en `(rut_body, rut_dv)` o `(rut_empresa_body, rut_empresa_dv)` para evitar duplicados? **Decisión provisional**: no en v1 (no solicitado).
- ¿`PUT` debe aceptar CREATE grant además de EDIT (como empleados)? **Decisión provisional**: sí, para coherencia con formulario compartido.
