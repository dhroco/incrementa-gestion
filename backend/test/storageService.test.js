const test = require('node:test')
const assert = require('node:assert/strict')
const { URL } = require('node:url')

const { createStorageService } = require('../services/storageService')

// Clave de delegación falsa: el SDK solo necesita sus campos para firmar la SAS.
function fakeDelegationKey(startsOn, expiresOn) {
  return {
    signedObjectId: '00000000-0000-0000-0000-000000000001',
    signedTenantId: '00000000-0000-0000-0000-000000000002',
    signedStartsOn: startsOn,
    signedExpiresOn: expiresOn,
    signedService: 'b',
    signedVersion: '2023-11-03',
    value: Buffer.from('clave-de-prueba-para-firmar-sas').toString('base64')
  }
}

function fakeClient() {
  const calls = { uploads: [], downloads: [], deletes: [], keys: [] }
  const client = {
    getContainerClient(containerName) {
      return {
        getBlockBlobClient(name) {
          return {
            containerName,
            name,
            accountName: 'cuentaprueba',
            url: `https://cuentaprueba.blob.core.windows.net/${containerName}/${name}`,
            uploadData: async (buffer, options) => {
              calls.uploads.push({ containerName, name, buffer, options })
            },
            downloadToBuffer: async () => {
              calls.downloads.push({ containerName, name })
              return Buffer.from(`contenido de ${name}`)
            },
            deleteIfExists: async () => {
              calls.deletes.push({ containerName, name })
            }
          }
        }
      }
    },
    getUserDelegationKey: async (startsOn, expiresOn) => {
      calls.keys.push({ startsOn, expiresOn })
      return fakeDelegationKey(startsOn, expiresOn)
    }
  }
  return { client, calls }
}

function service(extra = {}) {
  const { client, calls } = fakeClient()
  const storage = createStorageService({
    accountName: 'cuentaprueba',
    documentsContainer: 'documentos',
    signedContainer: 'firmados',
    blobServiceClient: client,
    ...extra
  })
  return { storage, calls }
}

test('los PDF firmados van al contenedor firmados y todo lo demás a documentos', () => {
  const { storage } = service()
  assert.equal(storage.containerFor('contratos-firmados/c/s/T/2026/10/x_firmado.pdf'), 'firmados')
  assert.equal(storage.containerFor('contratos/c/s/T/2026/10/x.pdf'), 'documentos')
  assert.equal(storage.containerFor('firmas-representantes/c/1/x.png'), 'documentos')
  assert.equal(storage.containerFor('avatars/u/x.jpg'), 'documentos')
})

test('uploadBuffer sube a la misma ruta, con el tipo de contenido, y devuelve la ruta', async () => {
  const { storage, calls } = service()
  const buffer = Buffer.from('%PDF-1.7')
  const result = await storage.uploadBuffer({
    buffer,
    gcsPath: 'contratos-firmados/a/b/c_firmado.pdf',
    contentType: 'application/pdf'
  })
  assert.equal(result, 'contratos-firmados/a/b/c_firmado.pdf')
  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.uploads[0].containerName, 'firmados')
  assert.equal(calls.uploads[0].name, 'contratos-firmados/a/b/c_firmado.pdf')
  assert.equal(calls.uploads[0].buffer, buffer)
  assert.equal(calls.uploads[0].options.blobHTTPHeaders.blobContentType, 'application/pdf')
})

test('downloadBuffer devuelve el contenido del blob de esa ruta', async () => {
  const { storage, calls } = service()
  const buf = await storage.downloadBuffer({ gcsPath: 'avatars/u/a.png' })
  assert.equal(buf.toString(), 'contenido de avatars/u/a.png')
  assert.deepEqual(calls.downloads, [{ containerName: 'documentos', name: 'avatars/u/a.png' }])
})

test('deleteFile borra sin fallar si el blob no existe', async () => {
  const { storage, calls } = service()
  await storage.deleteFile({ gcsPath: 'contratos/x.pdf' })
  assert.deepEqual(calls.deletes, [{ containerName: 'documentos', name: 'contratos/x.pdf' }])
})

test('una ruta vacía se rechaza', async () => {
  const { storage } = service()
  await assert.rejects(() => storage.downloadBuffer({ gcsPath: '' }), /ruta del archivo es obligatoria/)
})

test('getSignedUrl firma una SAS de solo lectura, por HTTPS, que vence a los minutos pedidos', async () => {
  const fixedNow = Date.UTC(2026, 9, 18, 12, 0, 0)
  const { storage } = service({ now: () => fixedNow })
  const url = new URL(
    await storage.getSignedUrl({ gcsPath: 'contratos/a/b.pdf', expiresInMinutes: 60 })
  )
  assert.equal(url.origin + url.pathname, 'https://cuentaprueba.blob.core.windows.net/documentos/contratos/a/b.pdf')
  assert.equal(url.searchParams.get('sp'), 'r')
  assert.equal(url.searchParams.get('spr'), 'https')
  assert.equal(url.searchParams.get('sr'), 'b')
  assert.equal(new Date(url.searchParams.get('se')).getTime(), fixedNow + 60 * 60 * 1000)
  assert.ok(new Date(url.searchParams.get('st')).getTime() < fixedNow)
  assert.ok(url.searchParams.get('sig'))
  // Es una SAS de delegación de usuario: lleva el objeto de la identidad, no una clave de cuenta.
  assert.equal(url.searchParams.get('skoid'), '00000000-0000-0000-0000-000000000001')
})

test('la clave de delegación se reutiliza mientras cubra la URL', async () => {
  let current = Date.UTC(2026, 9, 18, 12, 0, 0)
  const { storage, calls } = service({ now: () => current })
  await storage.getSignedUrl({ gcsPath: 'contratos/a.pdf', expiresInMinutes: 60 })
  current += 10 * 60 * 1000
  await storage.getSignedUrl({ gcsPath: 'avatars/b.jpg', expiresInMinutes: 1440 })
  assert.equal(calls.keys.length, 1)
  assert.ok(calls.keys[0].expiresOn.getTime() - calls.keys[0].startsOn.getTime() >= 3 * 24 * 60 * 60 * 1000)
})

test('la clave de delegación se renueva cuando ya no cubre la URL', async () => {
  let current = Date.UTC(2026, 9, 18, 12, 0, 0)
  const { storage, calls } = service({ now: () => current })
  await storage.getSignedUrl({ gcsPath: 'contratos/a.pdf', expiresInMinutes: 60 })
  current += 3 * 24 * 60 * 60 * 1000
  await storage.getSignedUrl({ gcsPath: 'contratos/a.pdf', expiresInMinutes: 60 })
  assert.equal(calls.keys.length, 2)
})

test('sin cuenta configurada falla al usarse, no al importarse', async () => {
  const storage = createStorageService({ accountName: '' })
  await assert.rejects(() => storage.downloadBuffer({ gcsPath: 'contratos/a.pdf' }), /AZURE_STORAGE_ACCOUNT/)
})
