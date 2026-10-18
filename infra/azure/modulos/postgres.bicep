// PostgreSQL 16 Flexible Server. Endpoint privado en la VNet para Container Apps y TLS
// obligatorio (por defecto). El acceso público queda habilitado pero sin ninguna regla de
// firewall: la IP del administrador la abre scripts/firewall-mi-ip.sh, porque esa IP cambia.
// Bicep no administra esa regla, así que volver a aplicar no la borra ni la pisa.
param nombre string
param location string
param tags object
param adminUsuario string
@secure()
param adminClave string
param sku string
param tier string
param storageGb int
param backupDias int
param vnetId string
param subnetEndpointsId string

resource servidor 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: nombre
  location: location
  tags: tags
  sku: { name: sku, tier: tier }
  properties: {
    version: '16'
    administratorLogin: adminUsuario
    administratorLoginPassword: adminClave
    authConfig: {
      passwordAuth: 'Enabled'
      activeDirectoryAuth: 'Disabled'
    }
    storage: { storageSizeGB: storageGb, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: backupDias, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

resource base 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: servidor
  name: 'incrementa'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource dns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource dnsVnet 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dns
  name: 'vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnetId }
  }
}

resource endpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${nombre}'
  location: location
  tags: tags
  properties: {
    subnet: { id: subnetEndpointsId }
    privateLinkServiceConnections: [
      {
        name: 'postgres'
        properties: {
          privateLinkServiceId: servidor.id
          groupIds: ['postgresqlServer']
        }
      }
    ]
  }
}

resource endpointDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: endpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      { name: 'postgres', properties: { privateDnsZoneId: dns.id } }
    ]
  }
}

output fqdn string = servidor.properties.fullyQualifiedDomainName
