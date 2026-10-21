// Red privada: una subred para Container Apps y otra para los endpoints privados.
param nombre string
param location string
param tags object

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: nombre
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.20.0.0/16'] }
    subnets: [
      {
        // Container Apps con perfiles de carga necesita al menos /27 y la delegación.
        name: 'snet-apps'
        properties: {
          addressPrefix: '10.20.0.0/23'
          delegations: [
            {
              name: 'containerapps'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
        }
      }
      {
        name: 'snet-endpoints'
        properties: {
          addressPrefix: '10.20.2.0/24'
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output subnetAppsId string = '${vnet.id}/subnets/snet-apps'
output subnetEndpointsId string = '${vnet.id}/subnets/snet-endpoints'
