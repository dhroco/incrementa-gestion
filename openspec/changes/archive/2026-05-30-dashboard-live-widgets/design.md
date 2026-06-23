## Context

`DashboardPage.jsx` consume hoy `/api/placeholder/dashboard` (datos estáticos en `app.js`) y renderiza `PlaceholderCardGrid`, `PlaceholderTable` y `UnderConstructionBlock`. El sistema ya tiene módulos operativos de Proveedores, Constructor de documento y Plantillas estándar, con autorización CASL vía `@casl/react` (`useAbility` + `AbilityContext`) en páginas como `SupplierListPage` y `StandardTemplatesListPage`.

Restricciones explícitas del cambio:
- No eliminar `/api/placeholder/dashboard`.
- No modificar `AppRouter.jsx`, `variables.css` ni `global.css`.
- Estilos nuevos solo en `frontend/src/styles/dashboard.css`.
- Widgets como componentes inline en `DashboardPage.jsx` (sin biblioteca genérica de widgets).
- Knex retorna COUNT como string — convertir a `number` en el servicio antes de serializar.

**Excepción visual acotada:** las guías corporativas prohíben gradientes y estética tipo dashboard marketing. Este cambio introduce degradés coloridos **únicamente** en las tres tarjetas del dashboard, como excepción deliberada y acotada al alcance solicitado. El resto del sistema mantiene la guía ERP existente.

## Goals / Non-Goals

**Goals:**
- Exponer `GET /api/dashboard/stats` con métricas reales en una sola llamada.
- Ejecutar todas las queries en paralelo (`Promise.all`) para minimizar latencia.
- Reemplazar la UI del dashboard por tres widgets con métricas, desglose, acciones y estado de carga por widget.
- Respetar permisos CASL por widget y por botón de creación.
- Formatear números con locale `es-CL` en frontend.

**Non-Goals:**
- Biblioteca reutilizable de widgets (fase posterior).
- Listado de contratos firmados (botón "Ver contratos" queda deshabilitado).
- Eliminar el endpoint placeholder ni componentes placeholder del proyecto.
- Filtros por empresa en conteos (métricas globales de plataforma).
- Modificar permisos del catálogo CASL.

## Decisions

### 1. Estructura del endpoint y payload

`GET /api/dashboard/stats` protegido con `authorize('read', 'Dashboard')`. Respuesta envelope estándar (`sendOk`) con shape:

```json
{
  "suppliers": {
    "total": 42,
    "personaNatural": 10,
    "empresa": 32
  },
  "contracts": {
    "draftPending": 5,
    "signedTotal": 18
  },
  "templates": {
    "activeTotal": 7,
    "mostRecentName": "Contrato de prestación de servicios"
  }
}
```

**Alternativa descartada:** endpoints separados por widget — más round-trips y complejidad en frontend sin beneficio.

### 2. Queries en `dashboardService.js`

Todas las queries en paralelo con `Promise.all`:

| Métrica | Query |
|---------|-------|
| Proveedores total | `COUNT(*)` en `supplier` |
| Personas naturales | `COUNT(*)` WHERE `supplier_type = 'persona_natural'` |
| Empresas | `COUNT(*)` WHERE `supplier_type = 'empresa'` |
| Borradores pendientes | `COUNT(*)` en `draft_document` WHERE `status = 'draft'` |
| Documentos firmados | `COUNT(*)` en `document` |
| Plantillas activas | `COUNT(*)` en `template` JOIN `template_standard` WHERE `status = 'active'` |
| Plantilla más reciente | `SELECT name FROM template JOIN template_standard WHERE status = 'active' ORDER BY created_at DESC LIMIT 1` |

Helper `_toCount(row)` convierte `row.count` string → `number` con `Number()` o `parseInt`.

**Alternativa descartada:** una sola query SQL con subselects — menos legible y más difícil de mantener que queries simples en paralelo.

### 3. Capas backend

- `dashboardService.js`: lógica de queries, retorna objeto tipado con números.
- `dashboardController.js`: handler delgado, try/catch → 500 con mensaje español.
- Registro en `app.js` junto a otras rutas protegidas.

### 4. Autorización frontend por widget

Patrón idéntico a `SupplierListPage`:

```jsx
const ability = useAbility(AbilityContext)
const showSuppliers = ability.can('read', 'Supplier')
const canCreateSupplier = ability.can('create', 'Supplier')
const showContracts = ability.can('use', 'DocumentBuilder')
const showTemplates = ability.can('read', 'Template')
const canCreateTemplate = ability.can('create', 'Template')
```

Cada widget se renderiza condicionalmente. Si ningún widget es visible, mostrar mensaje vacío amigable (sin error).

### 5. Rutas de acción verificadas en `AppRouter.jsx`

| Acción | Ruta |
|--------|------|
| Listado proveedores | `/app/proveedores` |
| Crear proveedor | `/app/proveedores/nuevo` |
| Constructor documento | `/app/gestion-contratos/constructor-documento` |
| Listado plantillas | `/app/gestion-contratos/templates-estandar` |
| Crear plantilla | `/app/gestion-contratos/templates-estandar/nueva` |

"Ver contratos": `<span>` o `<button type="button" disabled>` con clase secundaria + estado visual deshabilitado — **no** usar `<Link>`.

### 6. Diseño visual de widgets (`dashboard.css`)

Grid responsive (3 columnas ≥900px, 1 columna en móvil), gap 16px.

Cada widget:
- `border-radius: 24px` (esquinas muy redondeadas).
- Degradé de fondo + texto blanco + decoración sutil (círculos semitransparentes vía pseudo-elementos).
- Colores: Proveedores púrpura (`#6425D0` → `#8B5CF6`), Contratos naranja (`#EA580C` → `#F97316`), Plantillas dorado (`#B45309` → `#D97706`).
- Métrica principal: 36–40px bold; descripción secundaria 13px; desglose en una línea 12px.
- Botones al fondo de la tarjeta (flex, gap 8px):
  - **Primario:** fondo blanco, texto color del widget, border-radius píldora.
  - **Secundario:** fondo `rgba(255,255,255,0.15)`, borde blanco semitransparente.
  - **Deshabilitado:** opacidad reducida, `cursor: not-allowed`, sin hover.

Estado de carga: skeleton o spinner centrado **dentro** de la tarjeta, preservando altura mínima y estructura (métrica placeholder `—`, texto "Cargando…").

### 7. Carga de datos en frontend

Un solo `useEffect` + `apiGet('/api/dashboard/stats')` al montar (con `accessToken`). Estado compartido `loading | error | success`. En error, `ErrorBlock` con retry; en denied (403), `AccessDeniedBlock`. Los widgets visibles muestran skeleton mientras `loading`.

**Alternativa descartada:** fetch independiente por widget — contradice un único endpoint agregado.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Degradés contradicen guía corporativa global | Excepción documentada, CSS aislado en `dashboard.css` |
| Usuario con `read Dashboard` pero sin permisos de módulos ve dashboard vacío | Mensaje "No hay widgets disponibles para su perfil" |
| COUNT global sin scope por empresa | Aceptado: dashboard es vista de plataforma; scope futuro si se requiere |
| Knex COUNT como string | Conversión explícita en servicio |
| "Ver contratos" genera confusión | Estilo claramente deshabilitado + tooltip o texto secundario opcional "Próximamente" |

## Migration Plan

1. Desplegar backend con nuevo endpoint (compatible hacia atrás; placeholder intacto).
2. Desplegar frontend con nuevo `DashboardPage.jsx`.
3. Rollback: revertir frontend a versión anterior; el endpoint nuevo puede quedar sin uso.

No requiere migraciones de BD ni cambios de configuración.

## Open Questions

_(ninguna — requisitos del brief son suficientes para implementar)_
