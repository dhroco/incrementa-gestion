const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')
const { createLegalRepSignatureService } = require('../services/legalRepSignatureService')
const { PNG } = require('pngjs')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

function makePngBuffer({ width, height, colorType = 6, transparent = true, bgAlpha = null }) {
  const alpha = bgAlpha != null ? bgAlpha : transparent ? 0 : 255
  const png = new PNG({ width, height, colorType })

  // Fill with transparent/opaque depending on alpha presence.
  if (colorType === 6) {
    // RGBA: [r,g,b,a]
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 0
      png.data[i + 1] = 0
      png.data[i + 2] = 0
      png.data[i + 3] = alpha
    }
  } else if (colorType === 4) {
    // GA: [g,a]
    for (let i = 0; i < png.data.length; i += 2) {
      png.data[i] = 0
      png.data[i + 1] = alpha
    }
  } else {
    // Non-alpha formats: rgba transparency not available.
    png.data.fill(0)
  }

  return PNG.sync.write(png)
}

function createDbStub({ companyExists = true, existingSignature = null } = {}) {
  return (table) => {
    if (table === 'company') {
      return {
        where: () => ({
          first: async () => (companyExists ? { id: 'c1' } : null)
        })
      }
    }

    if (table === 'legal_rep_signature') {
      return {
        select: () => ({
          where: () => ({
            first: async () => existingSignature
          })
        }),
        insert: async () => {},
        update: async () => {},
        where: () => ({
          delete: async () => {}
        })
      }
    }

    throw new Error(`Unexpected table in stub: ${table}`)
  }
}

test('POST /api/companies/:id/legal-rep-signatures/:repIndex: 403 sin grant update', async () => {
  const gcsService = { uploadBuffer: async () => {}, deleteFile: async () => {}, getSignedUrl: async () => 'x' }
  const db = createDbStub()
  const service = createLegalRepSignatureService({ db, gcsService })

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([]),
    legalRepSignatureService: service,
    userProfileIdResolver: async () => 'p1'
  })

  const png = makePngBuffer({ width: 6, height: 6, colorType: 6, transparent: true })
  const res = await request(app)
    .post('/api/companies/c1/legal-rep-signatures/1')
    .attach('signature', png, { filename: 'sig.png', contentType: 'image/png' })

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})

test('POST: acepta PNG transparente y no expone gcs_path', async () => {
  const gcsService = {
    uploadBuffer: async () => {},
    deleteFile: async () => {},
    getSignedUrl: async () => 'https://signed.example/firmas/.../sig.png'
  }
  const db = createDbStub({ existingSignature: null })
  const service = createLegalRepSignatureService({ db, gcsService })

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Company']]),
    legalRepSignatureService: service,
    userProfileIdResolver: async () => 'p1'
  })

  const png = makePngBuffer({ width: 6, height: 6, colorType: 6, transparent: true })
  const res = await request(app)
    .post('/api/companies/c1/legal-rep-signatures/1')
    .attach('signature', png, { filename: 'sig.png', contentType: 'image/png' })

  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.rep_index, 1)
  assert.equal(typeof res.body?.data?.url, 'string')
  assert.equal(res.body?.data?.gcs_path, undefined)
})

test('POST: rechaza “JPEG con Content-Type png” por magic bytes', async () => {
  const gcsService = { uploadBuffer: async () => {}, deleteFile: async () => {}, getSignedUrl: async () => 'x' }
  const db = createDbStub({ existingSignature: null })
  const service = createLegalRepSignatureService({ db, gcsService })

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Company']]),
    legalRepSignatureService: service,
    userProfileIdResolver: async () => 'p1'
  })

  // JPEG SOI marker (does NOT match PNG magic bytes).
  const notPng = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44])

  const res = await request(app)
    .post('/api/companies/c1/legal-rep-signatures/1')
    .attach('signature', notPng, { filename: 'sig.png', contentType: 'image/png' })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})

test('POST: rechaza PNG opaco (fondo sin transparencia)', async () => {
  const gcsService = { uploadBuffer: async () => {}, deleteFile: async () => {}, getSignedUrl: async () => 'x' }
  const db = createDbStub({ existingSignature: null })
  const service = createLegalRepSignatureService({ db, gcsService })

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Company']]),
    legalRepSignatureService: service,
    userProfileIdResolver: async () => 'p1'
  })

  const opaquePng = makePngBuffer({ width: 6, height: 6, colorType: 6, transparent: false })

  const res = await request(app)
    .post('/api/companies/c1/legal-rep-signatures/1')
    .attach('signature', opaquePng, { filename: 'sig.png', contentType: 'image/png' })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})

test('POST: rechaza PNG >500KB', async () => {
  const gcsService = { uploadBuffer: async () => {}, deleteFile: async () => {}, getSignedUrl: async () => 'x' }
  const db = createDbStub({ existingSignature: null })
  const service = createLegalRepSignatureService({ db, gcsService })

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Company']]),
    legalRepSignatureService: service,
    userProfileIdResolver: async () => 'p1'
  })

  // PNG con datos variados para que el tamaño supere el límite.
  const width = 800
  const height = 800
  const png = new PNG({ width, height, colorType: 6 })
  for (let i = 0; i < png.data.length; i += 4) {
    const p = i / 4
    png.data[i] = p % 256
    png.data[i + 1] = (p * 7) % 256
    png.data[i + 2] = (p * 13) % 256
    png.data[i + 3] = 0 // alpha transparent
  }
  const bigTransparentPng = PNG.sync.write(png)

  assert.ok(bigTransparentPng.length > 500 * 1024, `fixture should exceed 500KB, got ${bigTransparentPng.length}`)

  const res = await request(app)
    .post('/api/companies/c1/legal-rep-signatures/1')
    .attach('signature', bigTransparentPng, { filename: 'sig.png', contentType: 'image/png' })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})

test('DELETE: elimina la firma registrada', async () => {
  const gcsService = {
    uploadBuffer: async () => {},
    deleteFile: async () => {},
    getSignedUrl: async () => 'x'
  }

  const db = createDbStub({ existingSignature: { gcs_path: 'firmas-representantes/c1/1/old.png' } })
  const service = createLegalRepSignatureService({ db, gcsService })

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Company']]),
    legalRepSignatureService: service,
    userProfileIdResolver: async () => 'p1'
  })

  const res = await request(app).delete('/api/companies/c1/legal-rep-signatures/1')
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body?.data, {})
})


test('POST: acepta PNG con fondo casi transparente (alfa bajo, no exactamente 0)', async () => {
  const gcsService = { uploadBuffer: async () => {}, deleteFile: async () => {}, getSignedUrl: async () => 'https://signed' }
  const db = createDbStub({ existingSignature: null })
  const service = createLegalRepSignatureService({ db, gcsService })

  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Company']]),
    legalRepSignatureService: service,
    userProfileIdResolver: async () => 'p1'
  })

  // Una rúbrica escaneada y recortada suele quedar con alfa muy bajo pero != 0.
  const casiTransparente = makePngBuffer({ width: 6, height: 6, colorType: 6, bgAlpha: 1 })

  const res = await request(app)
    .post('/api/companies/c1/legal-rep-signatures/1')
    .attach('signature', casiTransparente, { filename: 'sig.png', contentType: 'image/png' })

  assert.equal(res.statusCode, 200)
})
