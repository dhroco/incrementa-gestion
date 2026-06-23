const test = require('node:test')
const assert = require('node:assert/strict')

const { createGcsService } = require('../services/gcsService')

test('getSignedUrl invokes file.getSignedUrl with read action and expiry', async () => {
  let signedOptions = null

  const storage = {
    bucket(name) {
      assert.equal(name, 'test-bucket')
      return {
        file(gcsPath) {
          assert.equal(gcsPath, 'contratos/doc.pdf')
          return {
            getSignedUrl: async (options) => {
              signedOptions = options
              return ['https://storage.googleapis.com/signed-url']
            }
          }
        }
      }
    }
  }

  const gcs = createGcsService({ bucketName: 'test-bucket', storage })

  const before = Date.now()
  const url = await gcs.getSignedUrl({ gcsPath: 'contratos/doc.pdf', expiresInMinutes: 60 })
  const after = Date.now()

  assert.equal(url, 'https://storage.googleapis.com/signed-url')
  assert.equal(signedOptions.version, 'v4')
  assert.equal(signedOptions.action, 'read')
  assert.ok(signedOptions.expires >= before + 60 * 60 * 1000 - 1000)
  assert.ok(signedOptions.expires <= after + 60 * 60 * 1000 + 1000)
})
