// Registro de imágenes del entorno. Sin usuario administrador: se entra con identidades.
param nombre string
param location string
param tags object
param principalesPull array

var rolAcrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: nombre
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

resource pull 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in principalesPull: {
  name: guid(acr.id, p, rolAcrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', rolAcrPull)
    principalId: p
    principalType: 'ServicePrincipal'
  }
}]

output loginServer string = acr.properties.loginServer
output id string = acr.id
