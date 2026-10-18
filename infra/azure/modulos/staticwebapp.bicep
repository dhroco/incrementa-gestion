// Frontend: Static Web Apps (tier gratis). El deploy lo hace el workflow con un token
// pedido en el momento; aquí no se conecta a ningún repositorio.
param nombre string
param location string
param tags object

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: nombre
  location: location
  tags: tags
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

output hostname string = swa.properties.defaultHostname
