const { DefaultAzureCredential } = require('@azure/identity')

/**
 * Credencial de Azure compartida por Blob Storage y Microsoft Graph.
 *
 * - En Azure (Container Apps) usa la managed identity del contenedor. Si es una identidad
 *   asignada por el usuario, su client id llega en la variable AZURE_CLIENT_ID, que
 *   DefaultAzureCredential lee sola.
 * - En local usa la sesión de `az login`.
 *
 * Se crea recién al primer uso, para que importar los servicios (por ejemplo en las
 * pruebas) no requiera configuración de Azure.
 */
let credential = null

function getAzureCredential() {
  if (!credential) credential = new DefaultAzureCredential()
  return credential
}

module.exports = { getAzureCredential }
