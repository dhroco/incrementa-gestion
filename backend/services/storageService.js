const {
  BlobServiceClient,
  BlobSASPermissions,
  SASProtocol,
  generateBlobSASQueryParameters
} = require('@azure/storage-blob')
const config = require('../config')
const { getAzureCredential } = require('../lib/azureCredential')

/**
 * Almacenamiento de archivos en Azure Blob Storage.
 *
 * Las rutas son las mismas que se usaban en GCS (por eso las columnas siguen llamándose
 * `gcs_path`): `contratos/…`, `contratos-firmados/…`, `firmas-representantes/…` y `avatars/…`.
 * Los PDF firmados viven en un contenedor aparte con política de inmutabilidad (WORM);
 * el contenedor se elige por el prefijo de la ruta, así la base no cambia.
 */
const SIGNED_PREFIX = 'contratos-firmados/'

// Una clave de delegación se pide con validez de al menos 3 días y se reutiliza mientras
// cubra la URL que se está firmando. Así una URL de 24 h (avatar de la sesión) no obliga a
// pedir una clave nueva en cada petición. Azure acepta como máximo 7 días.
const DELEGATION_KEY_MIN_MS = 3 * 24 * 60 * 60 * 1000
const DELEGATION_KEY_MAX_MS = 7 * 24 * 60 * 60 * 1000
// Margen hacia atrás en el inicio de la SAS, por diferencias de reloj.
const CLOCK_SKEW_MS = 5 * 60 * 1000

function assertPath(gcsPath) {
  if (typeof gcsPath !== 'string' || gcsPath.trim() === '') {
    throw new Error('La ruta del archivo es obligatoria.')
  }
  return gcsPath
}

function createStorageService({
  accountName = config.AZURE_STORAGE_ACCOUNT,
  documentsContainer = config.AZURE_STORAGE_CONTAINER_DOCUMENTOS,
  signedContainer = config.AZURE_STORAGE_CONTAINER_FIRMADOS,
  blobServiceClient: injectedClient,
  credential,
  now = () => Date.now()
} = {}) {
  let client = injectedClient ?? null
  let delegationKey = null

  function getClient() {
    if (client) return client
    if (!accountName) {
      throw new Error('Falta configurar AZURE_STORAGE_ACCOUNT.')
    }
    client = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential ?? getAzureCredential()
    )
    return client
  }

  function containerFor(gcsPath) {
    return gcsPath.startsWith(SIGNED_PREFIX) ? signedContainer : documentsContainer
  }

  function blobClient(gcsPath) {
    const path = assertPath(gcsPath)
    return getClient().getContainerClient(containerFor(path)).getBlockBlobClient(path)
  }

  async function getDelegationKey(startsOn, expiresOn) {
    if (delegationKey && delegationKey.signedExpiresOn.getTime() >= expiresOn.getTime()) {
      return delegationKey
    }
    const keyExpiry = new Date(
      Math.min(
        Math.max(expiresOn.getTime(), startsOn.getTime() + DELEGATION_KEY_MIN_MS),
        startsOn.getTime() + DELEGATION_KEY_MAX_MS
      )
    )
    delegationKey = await getClient().getUserDelegationKey(startsOn, keyExpiry)
    return delegationKey
  }

  async function uploadBuffer({ buffer, gcsPath, contentType = 'application/pdf' }) {
    await blobClient(gcsPath).uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType }
    })
    return gcsPath
  }

  async function downloadBuffer({ gcsPath }) {
    return blobClient(gcsPath).downloadToBuffer()
  }

  async function deleteFile({ gcsPath }) {
    await blobClient(gcsPath).deleteIfExists()
  }

  async function getSignedUrl({ gcsPath, expiresInMinutes }) {
    const blob = blobClient(gcsPath)
    const current = now()
    const startsOn = new Date(current - CLOCK_SKEW_MS)
    const expiresOn = new Date(current + expiresInMinutes * 60 * 1000)
    const key = await getDelegationKey(startsOn, expiresOn)
    const sas = generateBlobSASQueryParameters(
      {
        containerName: blob.containerName,
        blobName: blob.name,
        permissions: BlobSASPermissions.parse('r'),
        protocol: SASProtocol.Https,
        startsOn,
        expiresOn
      },
      key,
      blob.accountName || accountName
    ).toString()
    return `${blob.url}?${sas}`
  }

  return { uploadBuffer, downloadBuffer, deleteFile, getSignedUrl, containerFor }
}

const defaultStorageService = createStorageService()

module.exports = { createStorageService, storageService: defaultStorageService, SIGNED_PREFIX }
