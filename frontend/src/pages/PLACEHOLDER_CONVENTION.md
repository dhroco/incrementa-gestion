# Convención de placeholders (etapa inicial)

Todas las pantallas privadas de esta etapa son **placeholders**: no consumen datos reales ni implementan acciones funcionales, pero deben verse coherentes dentro del shell y ayudar a entender el propósito del módulo.

## Rutas autorizadas actuales y tipo sugerido

| Ruta | Tipo | Contexto placeholder |
|------|------|----------------------|
| `/app/dashboard` | `dashboard` | Resumen de estado (cards + panel/tabla simulada) |
| `/app/contratos` | `list` | Bandeja/listado de contratos (toolbar + tabla simulada) |
| `/app/proveedores` | `list` | Listado de proveedores (toolbar + tabla simulada) |
| `/app/configuracion` | `admin` | Configuración del sistema (secciones/cards simples) |
| `/app/usuarios` | `admin` | Administración de usuarios (toolbar + tabla simulada) |
| `/app/reportes` | `list` | Reportes (lista de reportes + panel de filtros placeholder) |
| `/app/mi-perfil` | `detail` | Vista de perfil (bloques de datos simulados) |
| `/app/notificaciones` | `list` | Bandeja de notificaciones (lista/tabla simulada) |

> Nota: los títulos de subheader se resuelven desde `navigation.routes.moduleTitle`.

## Estructura mínima por tipo

- **dashboard**
  - Encabezado (título + subtítulo)
  - Mensaje “En construcción”
  - Grid de cards resumen (valores simulados)
  - Panel/tabla simulada (últimos movimientos, alertas, etc.)

- **list (bandeja/listado)**
  - Encabezado (título + subtítulo)
  - Mensaje “En construcción”
  - **Acciones placeholder** (p. ej. “Crear” deshabilitado)
  - Tabla/lista simulada + filtros placeholder (si aplica)

- **admin (administración/configuración)**
  - Encabezado (título + subtítulo)
  - Mensaje “En construcción”
  - Cards/secciones de configuración simuladas

- **detail**
  - Encabezado (título + subtítulo)
  - Mensaje “En construcción”
  - Bloques de datos simulados (dos columnas si aplica)

- **form**
  - Encabezado (título + subtítulo)
  - Mensaje “En construcción”
  - Campos simulados (solo UI, sin submit real)

## Mensajería

- Texto uniforme: **“Esta funcionalidad se encuentra en construcción.”**
- Español (es-CL), sin mensajes improvisados por módulo.

