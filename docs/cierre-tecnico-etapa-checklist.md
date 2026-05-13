# Cierre técnico de etapa — checklist operativo (etapa inicial)

Este documento define un checklist **determinístico** para validar la etapa inicial end-to-end y confirmar que la base quedó lista para iniciar desarrollo de negocio, sin arrastrar restos de plantilla ni mecanismos obsoletos.

## Qué quedó funcionando (base)

- Autenticación con Supabase (login) y sesión manejada en frontend.
- Sesión enriquecida desde backend (perfil resuelto + autorización de navegación efectiva desde BD).
- Menú dinámico en frontend construido desde `navigation.tree` (sesión enriquecida).
- Guards frontend basados en rutas permitidas (`navigation.routes`) y experiencia consistente de acceso denegado.
- Placeholders navegables; algunos módulos consumen endpoints placeholder del backend.
- Manejo global de errores HTTP (401/403/404/5xx/network) con mensajes en español.
- Recuperación de contraseña (solicitud + cambio) con feedback consistente.

## Qué es placeholder intencional (no-negocio)

- Botones/acciones de creación/edición en módulos placeholder: **deshabilitados**.
- Tablas/paneles “Listado/Detalle”: **datos y filas placeholder** salvo módulos conectados a endpoints placeholder.
- “En construcción”: indicador explícito de funcionalidad pendiente.

## Fuente única de verdad (lo que NO debe re-implementarse)

- **Navegación y visibilidad del menú**: provienen del backend/BD a través de **sesión enriquecida** (`navigation.tree` y `navigation.routes`).  
  No volver a implementar menú hardcodeado como fuente primaria.

## Prerrequisitos

- Node.js (>=18) + npm.
- PostgreSQL accesible (local o Supabase) y `DATABASE_URL` configurado si no se usa el default local.
- Variables backend (según ambiente): `ENVIRONMENT`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`.

## Preparación (desde cero)

1. Instalar dependencias:
   - Root: `npm run install:all`
2. Backend: ejecutar migraciones y seeds:
   - `cd backend`
   - `npm run migrate:latest`
   - `npm run seed:run`
3. Levantar servicios:
   - Root (recomendado): `npm run dev`
   - o separado:
     - Frontend: `cd frontend && npm run dev`
     - Backend: `cd backend && npm run dev`

## Validación end-to-end (gate)

### 1) Healthcheck y conectividad

- Abrir backend: `GET /` debe responder 200 con status OK.
- Abrir frontend: carga inicial sin errores visibles.

### 2) Login + sesión persistente

- Iniciar sesión con ambos perfiles.
- Recargar (F5) en una ruta privada y verificar que:
  - Se mantiene la sesión (o redirige a login de forma consistente si expiró).
  - Se reconstruye shell + menú correctamente tras resolver sesión enriquecida.

### 3) Perfil resuelto + enriched-session

- Confirmar que el backend responde sesión enriquecida con:
  - perfil (code + label)
  - `navigation.tree` y `navigation.routes`
- Confirmar que el frontend **no** cae a menús hardcodeados legacy si enriched-session falla.

### 4) Menú dinámico + guards frontend

- Verificar que el menú visible proviene del árbol de navegación autorizado.
- Probar URL manual a una ruta privada no permitida:
  - Debe bloquearse por guard y mostrar experiencia de acceso denegado o redirección definida.

### 5) Navegación completa de rutas autorizadas

- Recorrer todas las entradas de menú (y rutas privadas relevantes).
- Confirmar:
  - Título/subheader consistente para cada ruta.
  - Item activo en sidebar + grupos abiertos coherentes.

### 6) Módulos conectados a backend placeholder

- En módulos conectados, forzar:
  - loading inicial
  - error (simular backend down / cortar conectividad)
  - empty (si el endpoint devuelve 0 elementos)
- Confirmar que no hay “pantallas en blanco”.

### 7) Errores globales

- 401: sesión inválida/expirada → mensaje y redirección/invalidación estándar.
- 403: acceso restringido → UI estable de “Acceso denegado”.
- 404: ruta inválida → página no encontrada con acciones seguras.
- network/5xx: mensaje recuperable + retry cuando aplica.

### 8) Recuperación de contraseña

- Solicitar enlace (Forgot password) y confirmar mensaje.
- Abrir link y restablecer contraseña.
- Verificar:
  - Validaciones y mensajes en español.
  - Éxito: redirección a login.

## Resultado esperado

Si todo lo anterior pasa, la base está lista para iniciar desarrollo de negocio sin arrastrar basura de plantilla, sin mecanismos legacy de navegación, y con seeds mínimos reproducibles para validación.

