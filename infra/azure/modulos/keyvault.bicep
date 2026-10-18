// Key Vault con RBAC. Los valores de los secretos se cargan a mano (paso 3.3), nunca desde aquí.
param nombre string
param location string
param tags object
param principalesLectura array
param objectIdAdministrador string

var rolSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var rolSecretsOfficer = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: nombre
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

resource lectura 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in principalesLectura: {
  name: guid(kv.id, p, rolSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', rolSecretsUser)
    principalId: p
    principalType: 'ServicePrincipal'
  }
}]

resource administrador 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, objectIdAdministrador, rolSecretsOfficer)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', rolSecretsOfficer)
    principalId: objectIdAdministrador
    principalType: 'User'
  }
}

output uri string = kv.properties.vaultUri
