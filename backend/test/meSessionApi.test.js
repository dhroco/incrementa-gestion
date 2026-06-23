const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules, packedRulesForProfile } = require('./testAbilityHelpers')

function authStub(req, _res, next) {
  req.auth = { userId: 'user-1', email: 'user@example.com' }
  next()
}

test('GET /api/me/session returns ADMINISTRADOR_PLATAFORMA with permissions', async () => {
  const buildPackedRulesForUser = async () =>
    packedRulesForProfile({ code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' })

  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    buildPackedRulesForUser,
    sessionMetaResolver: async () => ({
      userIsActive: true,
      displayName: 'Admin User'
    })
  })
  const res = await request(app).get('/api/me/session').expect(200)

  assert.equal(res.body?.profile?.code, 'ADMINISTRADOR_PLATAFORMA')
  assert.equal('company' in res.body, false)
  assert.equal('assignedCompanies' in res.body, false)
  assert.equal('navigation' in res.body, false)
  assert.ok(Array.isArray(res.body?.permissions))
})

test('GET /api/me/session returns profile extras with signed avatar URL', async () => {
  const buildPackedRulesForUser = async () =>
    packedRulesForProfile({ code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' })

  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    buildPackedRulesForUser,
    sessionMetaResolver: async () => ({
      userIsActive: true,
      displayName: 'Admin User',
      avatarGcsPath: 'avatars/profile-1/abc.jpg',
      contactEmail: 'contacto@empresa.cl',
      widgetPreferences: { suppliers: true, contracts: false, templates: true }
    }),
    gcsService: {
      getSignedUrl: async ({ gcsPath, expiresInMinutes }) => {
        assert.equal(gcsPath, 'avatars/profile-1/abc.jpg')
        assert.equal(expiresInMinutes, 1440)
        return 'https://signed.example/avatar.jpg'
      }
    }
  })

  const res = await request(app).get('/api/me/session').expect(200)
  assert.equal(res.body.contact_email, 'contacto@empresa.cl')
  assert.deepEqual(res.body.widget_preferences, { suppliers: true, contracts: false, templates: true })
  assert.equal(res.body.avatar_url, 'https://signed.example/avatar.jpg')
  assert.equal('avatar_gcs_path' in res.body, false)
})

test('GET /api/me/session returns 403 for inactive user', async () => {
  const buildPackedRulesForUser = async () =>
    packedRulesForProfile({ code: 'ADMINISTRADOR_PLATAFORMA', label: 'Admin' })

  const app = createApp({
    requireAuth: authStub,
    attachAbilityMiddleware: attachAbilityWithRules(),
    buildPackedRulesForUser,
    sessionMetaResolver: async () => ({ userIsActive: false })
  })
  const res = await request(app).get('/api/me/session').expect(403)
  assert.equal(res.body?.code, 'USER_INACTIVE')
})
