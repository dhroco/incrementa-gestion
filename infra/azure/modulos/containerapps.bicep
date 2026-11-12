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

@description('false: sin Resend. No se lee RESEND-API-KEY de Key Vault y el backend omite el envío de correos.')
param usarResend bool

@description('Despliega el MCP HTTP (sin login). En prod solo con mcpRutaSecreta=true: mcp-http.mjs no arranca con ENVIRONMENT=prod sin MCP_RUTA_SECRETA.')
param incluirMcp bool

@description('true: el MCP lee MCP-RUTA-SECRETA de Key Vault y atiende solo en /mcp/<secreto>. El secreto tiene que existir en Key Vault antes de aplicar.')
param mcpRutaSecreta bool

@description('Rangos de IP que pueden llegar al MCP (vacío: sin restricción). En prod, solo Anthropic.')
param mcpIpPermitidas array

@description('true: lee FIRME-API-TOKEN y FIRME-LEGAL-ENTITY-ID de Key Vault (tienen que existir antes de aplicar), los pasa al backend, al MCP y al job del barrido, y crea el job. false: sin Firme (la firma queda bloqueada).')
param usarFirme bool

@description('Réplicas mínimas del backend (0: se apaga sin uso; 1: siempre encendido).')
param minReplicasBackend int

@description('Réplicas mínimas del MCP (0: se apaga sin uso; 1: siempre encendido).')
param minReplicasMcp int

@description('URL base de la API de Firme (prod: https://api.documentos.firme.cl; pre-prod: staging).')
param firmeApiUrl string

@description('ARN del topic SNS de Firme (opcional: si viene, el webhook solo acepta mensajes de ese topic). Vacío: se omite.')
param firmeSnsTopicArn string

@description('Cron (UTC) del barrido de firmas pendientes en Firme.')
param firmeBarridoCron string

param nombreBarrido string

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

var nombresSecretos = concat(
  usarResend ? ['DATABASE-URL', 'RESEND-API-KEY'] : ['DATABASE-URL'],
  usarFirme ? ['FIRME-API-TOKEN', 'FIRME-LEGAL-ENTITY-ID'] : []
)
var secretosBackend = secretosCargados ? secretosDe(keyVaultUri, idBackendId, nombresSecretos) : []
var secretosMcp = secretosCargados ? secretosDe(keyVaultUri, idMcpId, concat(nombresSecretos, mcpRutaSecreta ? ['MCP-RUTA-SECRETA'] : [])) : []
var envRutaMcp = mcpRutaSecreta ? [
  { name: 'MCP_RUTA_SECRETA', secretRef: 'mcp-ruta-secreta' }
] : []
var restriccionesMcp = map(range(0, length(mcpIpPermitidas)), i => {
  name: 'permitido-${i}'
  ipAddressRange: mcpIpPermitidas[i]
  action: 'Allow'
})
var envResend = usarResend ? [
  { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
] : []
var envFirme = usarFirme ? concat([
  { name: 'FIRME_API_URL', value: firmeApiUrl }
  { name: 'FIRME_API_TOKEN', secretRef: 'firme-api-token' }
  { name: 'FIRME_LEGAL_ENTITY_ID', secretRef: 'firme-legal-entity-id' }
], empty(firmeSnsTopicArn) ? [] : [
  { name: 'FIRME_SNS_TOPIC_ARN', value: firmeSnsTopicArn }
]) : []

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
], envResend, envFirme) : []

var envMcp = secretosCargados ? concat(envComun, [
  { name: 'AZURE_CLIENT_ID', value: idMcpClientId }
  { name: 'GRAPH_ENABLED', value: 'false' }
  { name: 'DATABASE_URL', secretRef: 'database-url' }
], envResend, envFirme, envRutaMcp) : []

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
      scale: { minReplicas: minReplicasBackend, maxReplicas: 2 }
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
        ipSecurityRestrictions: restriccionesMcp
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
      scale: { minReplicas: minReplicasMcp, maxReplicas: 1 }
    }
  }
}

// Barrido de firmas pendientes en Firme (respaldo del webhook: Firme aún no avisa los vencimientos).
// Misma imagen y mismas variables que el backend; solo cambia el comando. Sin Firme no se crea.
resource barrido 'Microsoft.App/jobs@2024-03-01' = if (usarFirme && secretosCargados) {
  name: nombreBarrido
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
      triggerType: 'Schedule'
      replicaTimeout: 300
      replicaRetryLimit: 0
      scheduleTriggerConfig: {
        cronExpression: firmeBarridoCron
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [{ server: acrLoginServer, identity: idBackendId }]
      secrets: secretosBackend
    }
    template: {
      containers: [
        {
          name: 'barrido'
          image: imagenEfectiva
          command: ['node', 'scripts/firme-barrido.js']
          env: envBackend
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
        }
      ]
    }
  }
}

output backendFqdn string = backend.properties.configuration.ingress.fqdn
output mcpFqdn string = incluirMcp ? mcp!.properties.configuration.ingress.fqdn : ''
