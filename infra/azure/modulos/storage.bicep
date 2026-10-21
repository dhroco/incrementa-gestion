// Blob Storage: `documentos` (borradores, rúbricas, avatares) y `firmados` (PDF firmados, WORM).
// Sin acceso anónimo y sin claves de cuenta: todo entra con identidades de Entra, y los
// navegadores leen con SAS de delegación de usuario que firma el backend.
param nombre string
param location string
param tags object
param retencionFirmadosDias int
@description('false: el contenedor `firmados` queda sin política WORM (para probar y limpiar antes de salir a producción).')
param wormFirmados bool
param principalesDatos array
param objectIdAdministrador string

var rolBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource cuenta 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: nombre
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    // Necesario para habilitar la inmutabilidad por versión en el contenedor `firmados`.
    immutableStorageWithVersioning: { enabled: true }
  }
}

resource blob 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: cuenta
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: { enabled: true, days: 14 }
    containerDeleteRetentionPolicy: { enabled: true, days: 14 }
  }
}

resource documentos 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blob
  name: 'documentos'
  properties: { publicAccess: 'None' }
}

resource firmados 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blob
  name: 'firmados'
  properties: {
    publicAccess: 'None'
    immutableStorageWithVersioning: { enabled: true }
  }
}

// Política WORM por defecto del contenedor: cada PDF firmado queda protegido contra borrado
// y reemplazo por `retencionFirmadosDias` desde que se crea. Desbloqueada: se puede acortar
// o quitar. Bloquearla (az storage container immutability-policy lock) es irreversible y se
// decide aparte.
resource politicaFirmados 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = if (wormFirmados) {
  parent: firmados
  name: 'default'
  properties: {
    immutabilityPeriodSinceCreationInDays: retencionFirmadosDias
    allowProtectedAppendWrites: false
  }
}

resource datos 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in principalesDatos: {
  name: guid(cuenta.id, p, rolBlobDataContributor)
  scope: cuenta
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', rolBlobDataContributor)
    principalId: p
    principalType: 'ServicePrincipal'
  }
}]

// El administrador necesita el rol de datos para copiar los archivos (azcopy) y para que el
// backend en local firme URLs con su `az login`.
resource administrador 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(cuenta.id, objectIdAdministrador, rolBlobDataContributor)
  scope: cuenta
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', rolBlobDataContributor)
    principalId: objectIdAdministrador
    principalType: 'User'
  }
}

output nombre string = cuenta.name
