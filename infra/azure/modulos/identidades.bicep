// Una managed identity por servicio: el backend y el MCP no comparten permisos.
param nombreBackend string
param nombreMcp string
param location string
param tags object

resource backend 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: nombreBackend
  location: location
  tags: tags
}

resource mcp 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: nombreMcp
  location: location
  tags: tags
}

output backendId string = backend.id
output backendClientId string = backend.properties.clientId
output backendPrincipalId string = backend.properties.principalId
output mcpId string = mcp.id
output mcpClientId string = mcp.properties.clientId
output mcpPrincipalId string = mcp.properties.principalId
