# Sistema de Gestión de Contratos y Contabilidad

Sistema ERP moderno para la gestión integral de contratos y contabilidad, desarrollado como monorepo con frontend React y backend Node.js.

## 🏗️ Arquitectura del Proyecto

```
gestion-contrato/
├── frontend/          # Aplicación React + Vite
├── backend/           # API Node.js + Express
├── infra/            # Infraestructura como código
├── docs/             # Documentación del proyecto
└── package.json      # Scripts coordinados del monorepo
```

## 🚀 Configuración del Entorno Local

### Prerrequisitos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd gestion-contrato
   ```

2. **Instalar todas las dependencias**
   ```bash
   npm run install:all
   ```

### Desarrollo Local

#### Ejecutar ambos servicios simultáneamente (Recomendado)

```bash
npm run dev
```

Este comando inicia:
- **Frontend**: http://localhost:5173 (React + Vite con hot reload)
- **Backend**: http://localhost:3000 (Express con nodemon)

#### Ejecutar servicios por separado

**Solo Frontend:**
```bash
npm run dev:frontend
```

**Solo Backend:**
```bash
npm run dev:backend
```

### Verificación de la Instalación

1. **Verificar que ambos servicios están ejecutándose:**
   - Frontend: Abrir http://localhost:5173
   - Backend: Abrir http://localhost:3000 (debe mostrar status: "OK")

2. **Verificar health check del backend:**
   ```bash
   curl http://localhost:3000
   ```
   Respuesta esperada:
   ```json
   {
     "status": "OK",
     "message": "Backend is running",
     "environment": "local",
     "timestamp": "2026-04-09T00:00:00.000Z"
   }
   ```

## 🎨 Sistema de Diseño

El proyecto implementa un sistema de diseño corporativo estricto:

### Tipografía
- **Fuente**: Inter (pesos 400, 500, 600, 700)
- **Tamaño base**: 13px
- **Valores destacados**: 18px

### Paleta de Colores
- **Main Headerbar**: #031B30
- **Sidebar**: #194166
- **Área de trabajo**: #F0F1F2
- **Selección**: #657A8A
- **Cards**: #FFFFFF
- **Institucional GCC**: Fondo #FFF0C0, Texto #000000

### Variables CSS
Todas las variables de diseño están definidas en `frontend/src/styles/variables.css` y son accesibles globalmente.

## ⚙️ Configuración por Ambientes

El sistema soporta tres ambientes: `local`, `dev`, `prod`

### Variables de Entorno

**Frontend** (`frontend/config.js`):
- `ENVIRONMENT`: Ambiente actual (default: "local")
- Configuración automática de API_BASE_URL según ambiente

**Backend** (`backend/config.js`):
- `ENVIRONMENT`: Ambiente actual (default: "local")
- `PORT`: Puerto del servidor (default: 3000)
- `DATABASE_URL`: URL de base de datos
- `SUPABASE_JWT_SECRET`: Clave secreta para validación de JWT de Supabase (backend)

## ✅ Checklist de cierre técnico (etapa inicial)

Ver `docs/cierre-tecnico-etapa-checklist.md`.

### Cambiar de Ambiente

```bash
# Desarrollo
ENVIRONMENT=dev npm run dev

# Producción
ENVIRONMENT=prod npm run start
```

## 📦 Scripts Disponibles

### Desarrollo
- `npm run dev` - Ejecutar frontend y backend simultáneamente
- `npm run dev:frontend` - Solo frontend con hot reload
- `npm run dev:backend` - Solo backend con hot reload

### Producción
- `npm run start` - Ejecutar ambos servicios en modo producción
- `npm run build` - Construir frontend para producción

### Utilidades
- `npm run install:all` - Instalar dependencias en todos los módulos
- `npm test` - Ejecutar tests (pendiente implementación)

## 🔧 Estructura de Desarrollo

### Frontend (React + Vite)
- **Puerto**: 5173
- **Hot Reload**: Activado
- **Build Tool**: Vite
- **Styling**: CSS Variables + CSS Modules

### Backend (Node.js + Express)
- **Puerto**: 3000
- **Hot Reload**: Nodemon
- **CORS**: Configurado para frontend local
- **Health Check**: GET /

### Monorepo
- **Coordinación**: Concurrently para ejecutar múltiples servicios
- **Gestión de dependencias**: npm workspaces implícito
- **Scripts unificados**: Desde package.json raíz

## 🚨 Solución de Problemas

### Error de puertos ocupados
```bash
# Verificar procesos en puertos
lsof -i :3000  # Backend
lsof -i :5173  # Frontend

# Terminar procesos si es necesario
kill -9 <PID>
```

### Error de dependencias
```bash
# Limpiar e reinstalar
rm -rf node_modules frontend/node_modules backend/node_modules
rm package-lock.json frontend/package-lock.json backend/package-lock.json
npm run install:all
```

### Error de configuración de ambiente
Verificar que `ENVIRONMENT` sea uno de: `local`, `dev`, `prod`

## ☁️ Arquitectura Cloud y CI/CD

El proyecto está desplegado en AWS con infraestructura automatizada y pipeline de CI/CD.

### Infraestructura AWS

**Componentes:**
- **ECS Fargate**: Contenedores serverless para el backend
- **ECR**: Registro privado de imágenes Docker
- **Application Load Balancer (ALB)**: Distribución de tráfico HTTP
- **VPC**: Red virtual con subnets públicas
- **CloudWatch Logs**: Monitoreo y logs centralizados

**Ambientes:**
- **Dev**: 1 task, recursos mínimos (256 CPU, 512 MB RAM)
- **Prod**: 2 tasks, alta disponibilidad (512 CPU, 1024 MB RAM)

### Pipeline CI/CD (GitHub Actions)

**Flujo automatizado:**
1. Push a `develop` → Despliega a `dev`
2. Push a `main` → Despliega a `prod`

**Proceso:**
- Build de imagen Docker
- Push a Amazon ECR
- Actualización de task definition
- Despliegue a ECS con zero-downtime

### Despliegue

Ver documentación completa en [`infra/README.md`](infra/README.md)

**Quick start:**
```bash
# Desplegar infraestructura
./infra/scripts/deploy-stack.sh dev

# Ver outputs del stack
aws cloudformation describe-stacks --stack-name gfa-contratos-dev-infra --query 'Stacks[0].Outputs'
```

**Secretos requeridos en GitHub:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

### Monitoreo

**CloudWatch Logs:**
```bash
aws logs tail /ecs/gfa-contratos-dev-backend --follow
```

**Health check:**
```bash
curl http://<ALB_DNS>/health
```

## 📋 Próximos Pasos

1. Implementar autenticación y autorización
2. Configurar base de datos PostgreSQL
3. Desarrollar módulos de gestión de contratos
4. Implementar sistema de notificaciones

## 🤝 Contribución

1. Seguir las convenciones de diseño establecidas
2. Mantener consistencia en la estructura de archivos
3. Documentar cambios significativos
4. Probar en ambiente local antes de commit

---

**Versión**: 1.0.0  
**Última actualización**: Abril 2026
