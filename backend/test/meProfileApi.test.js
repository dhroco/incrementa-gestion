const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { createMeController } = require('../controllers/meController')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

const USER_ID = '11111111-1111-1111-1111-111111111111'
const PROFILE_ID = '22222222-2222-2222-2222-222222222222'

function authStub(req, _res, next) {
  req.auth = { userId: USER_ID, email: 'user@example.com' }
  next()
}

function createProfileDbStub() {
  const state = {
    contactEmail: null,
    widgetPreferences: null,
    avatarGcsPath: null
  }

  function userProfileQuery(criteria) {
    return {
      update(payload) {
        if (criteria.user_id === USER_ID || criteria.id === PROFILE_ID) {
          if (payload.contact_email !== undefined) state.contactEmail = payload.contact_email
          if (payload.widget_preferences !== undefined) state.widgetPreferences = payload.widget_preferences
          if (payload.avatar_gcs_path !== undefined) state.avatarGcsPath = payload.avatar_gcs_path
          return 1
        }
        return 0
      },
      first: async () => {
        if (criteria.user_id === USER_ID || criteria.id === PROFILE_ID) {
          return {
            id: PROFILE_ID,
            avatar_gcs_path: state.avatarGcsPath
          }
        }
        return null
      }
    }
  }

  return function db(table) {
    if (table !== 'user_profile') throw new Error(`unexpected table ${table}`)
    return {
      where(criteria) {
        return userProfileQuery(criteria)
      },
      select() {
        return {
          where(criteria) {
            return userProfileQuery(criteria)
          }
        }
      }
    }
  }
}

function createTestMeController(overrides = {}) {
  const db = overrides.db ?? createProfileDbStub()
  db.fn = { now: () => new Date() }

  const gcsService = overrides.gcsService ?? {
    deleteFile: async () => {},
    uploadBuffer: async ({ gcsPath, contentType }) => {
      assert.ok(gcsPath.startsWith(`avatars/${PROFILE_ID}/`))
      assert.ok(['image/jpeg', 'image/png', 'image/webp'].includes(contentType))
      return gcsPath
    },
    getSignedUrl: async ({ gcsPath }) => `https://signed.example/${gcsPath}`
  }

  return createMeController({ db, gcsService })
}

test('PUT /api/me/profile returns 401 without authentication', async () => {
  const app = createApp({
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app).put('/api/me/profile').send({ contact_email: 'a@b.cl' })
  assert.equal(res.status, 401)
})

test('PUT /api/me/profile returns 400 for invalid email', async () => {
  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app)
    .put('/api/me/profile')
    .send({ contact_email: 'not-an-email' })
    .expect(400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})

test('PUT /api/me/profile returns 400 for invalid widget_preferences', async () => {
  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app)
    .put('/api/me/profile')
    .send({ widget_preferences: { suppliers: 'yes' } })
    .expect(400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})

test('PUT /api/me/profile returns 200 on success', async () => {
  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app)
    .put('/api/me/profile')
    .send({
      contact_email: 'contacto@empresa.cl',
      widget_preferences: { suppliers: true, contracts: false, templates: true }
    })
    .expect(200)
  assert.equal(res.body?.ok, true)
})

test('POST /api/me/avatar returns 401 without authentication', async () => {
  const app = createApp({
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app).post('/api/me/avatar')
  assert.equal(res.status, 401)
})

test('POST /api/me/avatar returns 400 when file missing', async () => {
  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app).post('/api/me/avatar').expect(400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})

test('POST /api/me/avatar returns 200 on successful upload', async () => {
  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app)
    .post('/api/me/avatar')
    .attach('avatar', Buffer.from('fake-image'), {
      filename: 'photo.jpg',
      contentType: 'image/jpeg'
    })
    .expect(200)

  assert.equal(res.body?.ok, true)
  assert.match(res.body?.avatar_url, /^https:\/\/signed\.example\//)
})

test('POST /api/me/avatar returns 400 for invalid file type', async () => {
  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app)
    .post('/api/me/avatar')
    .attach('avatar', Buffer.from('not-image'), {
      filename: 'file.txt',
      contentType: 'text/plain'
    })
    .expect(400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
})

test('POST /api/me/avatar returns 400 when file exceeds 2MB', async () => {
  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    meController: createTestMeController()
  })
  const res = await request(app)
    .post('/api/me/avatar')
    .attach('avatar', Buffer.alloc(2 * 1024 * 1024 + 1), {
      filename: 'big.jpg',
      contentType: 'image/jpeg'
    })
    .expect(400)
  assert.equal(res.body?.error?.code, 'VALIDATION_ERROR')
  assert.equal(res.body?.error?.message, 'La imagen no puede superar 2 MB.')
})
