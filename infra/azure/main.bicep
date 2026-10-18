// incrementa-gestion · infraestructura de un entorno en Azure (pre-prod o prod).
// Se aplica sobre un resource group que ya existe:
//   az deployment group what-if -g rg-incrementa-preprod -f main.bicep -p preprod.bicepparam
//   az deployment group create  -g rg-incrementa-preprod -f main.bicep -p preprod.bicepparam
// Arquitectura: docs/arquitectura-azure-iconos-oficiales.html · Plan: docs/plan-migracion-azure.html
targetScope = 'resourceGroup'

@description('Nombre corto del entorno: preprod o prod.')
@allowed(['preprod', 'prod'])
param entorno string

@description('Valor de ENVIRONMENT para el backend: dev en pre-prod, prod en prod.')
@allowed(['dev', 'prod'])
param environmentApp string

param location string = resourceGroup().location

@description('Static Web Apps no existe en todas las regiones; el contenido igual se sirve desde su CDN global.')
param locationStaticWebApp string = 'eastus2'

@description('Tenant de Entra ID del login de este entorno.')
param tenantLogin string

@description('Client id de la app registration del login (es también la audiencia del API).')
param clientIdLogin string

@description('Object id del administrador en Entra: recibe permisos para cargar secretos y copiar archivos.')
param objectIdAdministrador string

@description('Usuario administrador de PostgreSQL.')
param postgresAdminUsuario string = 'incrementa_admin'

@description('Clave del administrador de PostgreSQL. Se pasa al aplicar; nunca va en un archivo.')
@secure()
param postgresAdminClave string

param postgresSku string = 'Standard_B1ms'
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param postgresTier string = 'Burstable'
param postgresStorageGb int = 32
param postgresBackupDias int = 7

@description('Días de retención WORM de los PDF firmados (5 años).')
param retencionFirmadosDias int = 1825

@description('Primera aplicación: false. Las Container Apps nacen con una imagen de ejemplo y sin secretos. Después de cargar los secretos en Key Vault y publicar la imagen, se vuelve a aplicar con true.')
param secretosCargados bool = false

@description('Imagen del backend y del MCP. Con secretosCargados=false se ignora. Al volver a aplicar, pasar la imagen que esté corriendo, para no pisar el último despliegue.')
param imagenBackend string = ''

param resendFromEmail string = 'onboarding@resend.dev'

@description('El MCP HTTP abierto (sin autenticación) solo existe en pre-prod; con ENVIRONMENT=prod se niega a arrancar.')
param incluirMcp bool = entorno == 'preprod'

param tags object = {
  sistema: 'incrementa-gestion'
  entorno: entorno
}

// ── nombres ──────────────────────────────────────────────
var sufijo = 'incrementa-${entorno}'
var nombres = {
  vnet: 'vnet-${sufijo}'
  logs: 'log-${sufijo}'
  idBackend: 'id-incrementa-backend-${entorno}'
  idMcp: 'id-incrementa-mcp-${entorno}'
  keyVault: 'kv-${sufijo}'
  acr: 'acrincrementa${entorno}'
  storage: 'stincrementa${entorno}'
  postgres: 'psql-${sufijo}'
  caEnv: 'cae-${sufijo}'
  backend: 'ca-incrementa-backend'
  mcp: 'ca-incrementa-mcp'
  swa: 'swa-${sufijo}'
}

module red 'modulos/red.bicep' = {
  name: 'red'
  params: { nombre: nombres.vnet, location: location, tags: tags }
}

module logs 'modulos/logs.bicep' = {
  name: 'logs'
  params: { nombre: nombres.logs, location: location, tags: tags }
}

module identidades 'modulos/identidades.bicep' = {
  name: 'identidades'
  params: { nombreBackend: nombres.idBackend, nombreMcp: nombres.idMcp, location: location, tags: tags }
}

module registro 'modulos/registro.bicep' = {
  name: 'registro'
  params: {
    nombre: nombres.acr
    location: location
    tags: tags
    principalesPull: [identidades.outputs.backendPrincipalId, identidades.outputs.mcpPrincipalId]
  }
}

module keyVault 'modulos/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    nombre: nombres.keyVault
    location: location
    tags: tags
    principalesLectura: [identidades.outputs.backendPrincipalId, identidades.outputs.mcpPrincipalId]
    objectIdAdministrador: objectIdAdministrador
  }
}

module storage 'modulos/storage.bicep' = {
  name: 'storage'
  params: {
    nombre: nombres.storage
    location: location
    tags: tags
    retencionFirmadosDias: retencionFirmadosDias
    principalesDatos: [identidades.outputs.backendPrincipalId, identidades.outputs.mcpPrincipalId]
    objectIdAdministrador: objectIdAdministrador
  }
}

module postgres 'modulos/postgres.bicep' = {
  name: 'postgres'
  params: {
    nombre: nombres.postgres
    location: location
    tags: tags
    adminUsuario: postgresAdminUsuario
    adminClave: postgresAdminClave
    sku: postgresSku
    tier: postgresTier
    storageGb: postgresStorageGb
    backupDias: postgresBackupDias
    vnetId: red.outputs.vnetId
    subnetEndpointsId: red.outputs.subnetEndpointsId
  }
}

module staticWebApp 'modulos/staticwebapp.bicep' = {
  name: 'staticwebapp'
  params: { nombre: nombres.swa, location: locationStaticWebApp, tags: tags }
}

module apps 'modulos/containerapps.bicep' = {
  name: 'containerapps'
  params: {
    nombreEntorno: nombres.caEnv
    nombreBackend: nombres.backend
    nombreMcp: nombres.mcp
    location: location
    tags: tags
    subnetAppsId: red.outputs.subnetAppsId
    logsCustomerId: logs.outputs.customerId
    logsNombre: nombres.logs
    acrLoginServer: registro.outputs.loginServer
    idBackendId: identidades.outputs.backendId
    idBackendClientId: identidades.outputs.backendClientId
    idMcpId: identidades.outputs.mcpId
    idMcpClientId: identidades.outputs.mcpClientId
    keyVaultUri: keyVault.outputs.uri
    secretosCargados: secretosCargados
    imagen: imagenBackend
    environmentApp: environmentApp
    oidcIssuer: '${environment().authentication.loginEndpoint}${tenantLogin}/v2.0'
    oidcAudience: clientIdLogin
    storageAccount: nombres.storage
    corsOrigin: 'https://${staticWebApp.outputs.hostname}'
    resendFromEmail: resendFromEmail
    incluirMcp: incluirMcp
  }
  // storage no se usa por salida: se espera explícitamente a que existan los roles de datos.
  dependsOn: [storage]
}

output backendUrl string = 'https://${apps.outputs.backendFqdn}'
output mcpUrl string = incluirMcp ? 'https://${apps.outputs.mcpFqdn}/mcp' : ''
output frontendUrl string = 'https://${staticWebApp.outputs.hostname}'
output postgresFqdn string = postgres.outputs.fqdn
output acrLoginServer string = registro.outputs.loginServer
output keyVaultNombre string = nombres.keyVault
output storageNombre string = nombres.storage
output idBackendPrincipalId string = identidades.outputs.backendPrincipalId
output idMcpPrincipalId string = identidades.outputs.mcpPrincipalId
