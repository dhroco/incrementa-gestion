// Container Apps: un environment en la VNet, con el backend y el MCP (misma imagen, otro comando).
param nombreEntorno string
param nombreBackend string
param nombreMcp string
param location string
param tags object
param subnetAppsId string
param logsCustomerId string
param logsNombre string
param acrLoginServer string
param idBackendId string
param idBackendClientId string
param idMcpId string
param idMcpClientId string
param keyVaultUri string
param secretosCargados bool
param imagen string
param environmentApp string
param oidcIssuer string
param oidcAudience string
param storageAccount string
param corsOrigin string
param resendFromEmail string

@description('El MCP HTTP abierto no arranca con ENVIRONMENT=prod: en prod no se despliega.')
param incluirMcp bool

// Imagen de ejemplo de Microsoft para la primera aplicación, antes de que exista la propia.
var imagenEjemplo = 'mcr.microsoft.com/k8se/quickstart:latest'
var imagenEfectiva = secretosCargados && !empty(imagen) ? imagen : imagenEjemplo
var puerto = secretosCargados ? 8080 : 80

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logsNombre
}

resource entorno 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: nombreEntorno
  location: location
  tags: tags
  properties: {
    vnetConfiguration: {
      infrastructureSubnetId: subnetAppsId
      internal: false
    }
    workloadProfiles: [
      { name: 'Consumption', workloadProfileType: 'Consumption' }
    ]
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logsCustomerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// Secretos leídos de Key Vault con la identidad de cada app.
func secretosDe(kvUri string, identidad string, nombres array) array =>
  map(nombres, n => {
    name: toLower(n)
    keyVaultUrl: '${kvUri}secrets/${n}'
    identity: identidad
  })

var secretosBackend = secretosCargados ? secretosDe(keyVaultUri, idBackendId, ['DATABASE-URL', 'RESEND-API-KEY']) : []
var secretosMcp = secretosCargados ? secretosDe(keyVaultUri, idMcpId, ['DATABASE-URL', 'RESEND-API-KEY']) : []

var envComun = [
  { name: 'ENVIRONMENT', value: environmentApp }
  { name: 'NODE_ENV', value: 'production' }
  { name: 'PORT', value: '8080' }
  { name: 'AZURE_STORAGE_ACCOUNT', value: storageAccount }
  { name: 'AZURE_STORAGE_CONTAINER_DOCUMENTOS', value: 'documentos' }
  { name: 'AZURE_STORAGE_CONTAINER_FIRMADOS', value: 'firmados' }
  { name: 'RESEND_FROM_EMAIL', value: resendFromEmail }
]

var envBackend = secretosCargados ? concat(envComun, [
  { name: 'AZURE_CLIENT_ID', value: idBackendClientId }
  { name: 'OIDC_ISSUER_URL', value: oidcIssuer }
  { name: 'OIDC_AUDIENCE', value: oidcAudience }
  { name: 'CORS_ORIGIN', value: corsOrigin }
  { name: 'DATABASE_URL', secretRef: 'database-url' }
  { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
]) : []

var envMcp = secretosCargados ? concat(envComun, [
  { name: 'AZURE_CLIENT_ID', value: idMcpClientId }
  { name: 'GRAPH_ENABLED', value: 'false' }
  { name: 'DATABASE_URL', secretRef: 'database-url' }
  { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
]) : []

var sonda = secretosCargados ? [
  {
    type: 'Liveness'
    httpGet: { path: '/health', port: 8080 }
    initialDelaySeconds: 10
    periodSeconds: 30
  }
] : []

resource backend 'Microsoft.App/containerApps@2024-03-01' = {
  name: nombreBackend
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${idBackendId}': {} }
  }
  properties: {
    environmentId: entorno.id
    workloadProfileName: 'Consumption'
    configuration: {
      ingress: {
        external: true
        targetPort: puerto
        transport: 'auto'
        allowInsecure: false
      }
      registries: secretosCargados ? [{ server: acrLoginServer, identity: idBackendId }] : []
      secrets: secretosBackend
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: imagenEfectiva
          env: envBackend
          probes: sonda
          resources: { cpu: json('0.5'), memory: '1Gi' }
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

resource mcp 'Microsoft.App/containerApps@2024-03-01' = if (incluirMcp) {
  name: nombreMcp
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${idMcpId}': {} }
  }
  properties: {
    environmentId: entorno.id
    workloadProfileName: 'Consumption'
    configuration: {
      ingress: {
        external: true
        targetPort: puerto
        transport: 'auto'
        allowInsecure: false
      }
      registries: secretosCargados ? [{ server: acrLoginServer, identity: idMcpId }] : []
      secrets: secretosMcp
    }
    template: {
      containers: [
        {
          name: 'mcp'
          image: imagenEfectiva
          command: secretosCargados ? ['node', 'mcp-http.mjs'] : []
          env: envMcp
          probes: sonda
          resources: { cpu: json('0.5'), memory: '1Gi' }
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

output backendFqdn string = backend.properties.configuration.ingress.fqdn
output mcpFqdn string = incluirMcp ? mcp!.properties.configuration.ingress.fqdn : ''
