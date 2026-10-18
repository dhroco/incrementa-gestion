// Log Analytics: recibe los logs de Container Apps (reemplaza a Cloud Logging).
param nombre string
param location string
param tags object

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: nombre
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

output customerId string = workspace.properties.customerId
