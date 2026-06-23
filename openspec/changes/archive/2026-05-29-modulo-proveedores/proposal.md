## Why

Los contratos del sistema tienen dos partes: Incrementa/Dynamics Corp Spa (gestionada como Empresa) y la contraparte contractual (proveedor). Hoy no existe forma de registrar proveedores ni sus cuentas de redes sociales, lo que bloquea la gestión completa de contratos y obliga a duplicar datos manualmente. Este módulo cierra esa brecha con un catálogo global reutilizable entre empresas.

## What Changes

- Nueva migración `202605290003_create_supplier_tables.js`: tablas `supplier` y `supplier_social_network` con soporte para Persona Natural y Empresa, acreditación de personería opcional y auditoría (`created_by` / `updated_by`).
- Nuevo backend: `supplierService.js`, `supplierController.js` y rutas REST `/api/suppliers` protegidas con grants `NAV_ACTION_PROVEEDORES_*` (READ, CREATE, EDIT).
- Navegación: ítem **Proveedores** bajo **Administración global** (`NAV_MENU_ADMIN_GLOBAL`), sin menú padre nuevo; seed actualizado y migración `202605290004_insert_proveedores_navigation_nodes.js` para entornos ya migrados.
- Nuevo frontend: API client, permisos (`proveedoresAuth.js`), páginas listado/vista/formulario (`SupplierListPage`, `SupplierViewPage`, `SupplierUpsertPage`, `SupplierFormSections`), rutas `/app/proveedores/*` e ícono en sidebar.
- Validaciones de RUT chileno (body + dv) en backend y frontend, siguiendo el patrón de empleados; fechas en formato ISO `YYYY-MM-DD`; textos y errores en español (es-CL).
- UI alineada al sistema de diseño: botones píldora, cards blancas, links en `#F62D84`, acciones ocultas según grants.

**No se incluye en este cambio**: vinculación de proveedores a contratos existentes, eliminación de proveedores, ni permisos para perfiles distintos de `ADMINISTRADOR_PLATAFORMA` (salvo extensión futura vía grants).

## Capabilities

### New Capabilities

- `suppliers-admin`: CRUD de proveedores globales (Persona Natural / Empresa) con redes sociales, API REST, navegación autorizada y UI de administración completa.

### Modified Capabilities

_(ninguna — no existen specs previas de proveedores en `openspec/specs/`)_

## Impact

- **Base de datos**: dos tablas nuevas; sin datos migrados desde otros módulos.
- **API**: cuatro endpoints nuevos bajo `/api/suppliers`; requieren JWT y grants de navegación.
- **Frontend**: nuevo submódulo en Administración global; rutas protegidas análogas a trabajadores.
- **Seeds/migraciones**: `002_navigation_authorization_seed.js` + migración de nodos para BD existentes.
- **Dependencias**: reutiliza `utils/rut.js`, patrones de `employeeService`, `employeeController`, `EmployeesListPage` y middleware `requireGrant` existente.
- **Tests**: se recomiendan tests de API de proveedores siguiendo el patrón de `clauseApi.test.js` / empleados (opcional en alcance mínimo del brief; incluido en tasks como verificación).

## Consideraciones de seguridad

- Los proveedores almacenan RUT, dirección y datos de representante legal — datos personales sensibles. Toda mutación exige JWT válido y grant explícito (CREATE o EDIT); lectura exige READ.
- Validar RUT en backend (no confiar solo en frontend) usando `parseRut` como en empleados; rechazar body/dv inválidos con mensaje en español.
- Campos condicionales por `supplier_type` deben validarse en servidor para evitar inyección de campos de tipo incorrecto.
- Transacciones Knex en create/update para atomicidad entre `supplier` y `supplier_social_network`.
- Grants iniciales solo para `ADMINISTRADOR_PLATAFORMA`; otros perfiles no ven el módulo hasta asignación explícita de grants.
- Mensajes de error al usuario en español (es-CL); no exponer detalles internos de BD en respuestas 500.
