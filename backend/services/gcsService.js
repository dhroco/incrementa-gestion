const { Storage } = require('@google-cloud/storage')
const config = require('../config')

function createGcsService({
  bucketName = config.GCS_BUCKET,
  keyFilename = config.GCS_KEY_FILE,
  storage: injectedStorage
} = {}) {
  const storageOptions = keyFilename ? { keyFilename } : {}
  const storage = injectedStorage ?? new Storage(storageOptions)
  const bucket = storage.bucket(bucketName)

  async function uploadBuffer({ buffer, gcsPath, contentType = 'application/pdf' }) {
    const file = bucket.file(gcsPath)
    await file.save(buffer, { contentType, resumable: false })
    return gcsPath
  }

  async function downloadBuffer({ gcsPath }) {
    const file = bucket.file(gcsPath)
    const [buffer] = await file.download()
    return buffer
  }

  async function deleteFile({ gcsPath }) {
    const file = bucket.file(gcsPath)
    await file.delete({ ignoreNotFound: true })
  }

  async function getSignedUrl({ gcsPath, expiresInMinutes }) {
    const file = bucket.file(gcsPath)
    const expires = Date.now() + expiresInMinutes * 60 * 1000
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires
    })
    return url
  }

  return { uploadBuffer, downloadBuffer, deleteFile, getSignedUrl }
}

const defaultGcsService = createGcsService()

module.exports = { createGcsService, gcsService: defaultGcsService }
