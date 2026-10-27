const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { createStorageService } = require('../services/storageService')

function sha(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function serviceWithStore() {
  const blobs = new Map()
  const calls = []

  function blobFor(containerName, name) {
    const key = `${containerName}/${name}`
    return {
      containerName,
      name,
      async uploadData(buffer, options) {
        calls.push({ containerName, name, buffer, options })
        const conditions = options?.conditions
        if (conditions && Object.prototype.hasOwnProperty.call(conditions, 'ifNoneMatch')) {
          assert.equal(conditions.ifNoneMatch, '*')
          if (blobs.has(key)) {
            const err = new Error('BlobAlreadyExists')
            err.statusCode = 409
            err.code = 'BlobAlreadyExists'
            throw err
          }
        }
        blobs.set(key, Buffer.from(buffer))
      },
      async downloadToBuffer() {
        if (!blobs.has(key)) {
          const err = new Error('missing')
          err.statusCode = 404
          throw err
        }
        return Buffer.from(blobs.get(key))
      }
    }
  }

  const client = {
    getContainerClient(containerName) {
      return {
        getBlockBlobClient(name) {
          return blobFor(containerName, name)
        }
      }
    }
  }

  const storage = createStorageService({
    accountName: 'cuentaprueba',
    documentsContainer: 'documentos',
    signedContainer: 'firmados',
    blobServiceClient: client
  })

  return { storage, blobs, calls }
}

test('uploadBufferOnce creates a missing blob with ifNoneMatch', async () => {
  const { storage, calls, blobs } = serviceWithStore()
  const buffer = Buffer.from('pdf-nuevo')
  const result = await storage.uploadBufferOnce({
    buffer,
    gcsPath: 'contratos-firmados/a/b.pdf',
    contentType: 'application/pdf'
  })
  assert.deepEqual(result, { created: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.conditions.ifNoneMatch, '*')
  assert.equal(calls[0].containerName, 'firmados')
  assert.equal(sha(blobs.get('firmados/contratos-firmados/a/b.pdf')), sha(buffer))
})

test('uploadBufferOnce returns created false when the stored hash matches', async () => {
  const { storage } = serviceWithStore()
  const buffer = Buffer.from('mismos-bytes')
  await storage.uploadBufferOnce({ buffer, gcsPath: 'contratos-firmados/a/mismo.pdf' })
  const again = await storage.uploadBufferOnce({ buffer, gcsPath: 'contratos-firmados/a/mismo.pdf' })
  assert.deepEqual(again, { created: false })
})

test('uploadBufferOnce throws STORAGE_CONFLICT when the stored hash differs', async () => {
  const { storage } = serviceWithStore()
  await storage.uploadBufferOnce({ buffer: Buffer.from('uno'), gcsPath: 'contratos-firmados/a/otro.pdf' })
  await assert.rejects(
    () => storage.uploadBufferOnce({ buffer: Buffer.from('dos'), gcsPath: 'contratos-firmados/a/otro.pdf' }),
    (err) => {
      assert.equal(err.code, 'STORAGE_CONFLICT')
      return true
    }
  )
})
