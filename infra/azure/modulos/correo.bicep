// Correo saliente con Azure Communication Services Email: contrato firmado a Yerko y Marcela.
// Dominio administrado por Azure (`<guid>.azurecomm.net`, sin tocar DNS); el remitente es
// `DoNotReply@<ese dominio>`. Más adelante se puede cambiar a un dominio propio sin tocar el código
// (solo la variable ACS_EMAIL_FROM). Sin claves: el backend entra con su identidad administrada.
param nombre string
param tags object
@description('Ubicación de los datos de ACS (no la región de los recursos, que es global).')
param dataLocation string
param principalesEnvio array

// «Communication and Email Service Owner»: permite enviar con Entra ID.
var rolCorreo = '09976791-48a7-449e-bb21-39d1a415f350'

resource correo 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: 'email-${nombre}'
  location: 'global'
  tags: tags
  properties: { dataLocation: dataLocation }
}

resource dominio 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: correo
  name: 'AzureManagedDomain'
  location: 'global'
  tags: tags
  properties: { domainManagement: 'AzureManaged' }
}

resource acs 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: nombre
  location: 'global'
  tags: tags
  properties: {
    dataLocation: dataLocation
    linkedDomains: [dominio.id]
  }
}

resource envio 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in principalesEnvio: {
  name: guid(acs.id, p, rolCorreo)
  scope: acs
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', rolCorreo)
    principalId: p
    principalType: 'ServicePrincipal'
  }
}]

output endpoint string = 'https://${acs.properties.hostName}'
output remitente string = 'DoNotReply@${dominio.properties.mailFromSenderDomain}'
