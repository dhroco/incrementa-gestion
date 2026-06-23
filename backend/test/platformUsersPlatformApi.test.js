const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

test('POST /api/platform/users returns 403 when missing grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })
  const res = await request(app)
    .post('/api/platform/users')
    .send({ email: 'a@b.cl', profile_code: 'ADMINISTRADOR_PLATAFORMA' })

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})

test('GET /api/platform/users/roles returns 200 with items', async () => {
  const platformUsersService = {
    listAssignableRolesForAdmin: async () => ({
      ok: true,
      data: {
        items: [
          { code: 'ADMINISTRADOR_PLATAFORMA', label: 'Administrador de plataforma' },
          { code: 'CUSTOM_ROLE', label: 'Rol personalizado' }
        ]
      }
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'PlatformUser']]),
    platformUsersService
  })

  const res = await request(app).get('/api/platform/users/roles')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 2)
})

test('GET /api/platform/users returns 403 when missing grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })
  const res = await request(app).get('/api/platform/users')

  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})

test('POST /api/platform/users returns 422 when user not in Keycloak', async () => {
  const platformUsersService = {
    createPlatformUser: async () => ({
      ok: false,
      status: 422,
      code: 'IDP_USER_NOT_FOUND',
      message: 'El usuario con ese email no existe en el servidor de autenticación. Créalo primero en Keycloak.'
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'PlatformUser']]),
    platformUsersService
  })

  const res = await request(app)
    .post('/api/platform/users')
    .send({ email: 'nuevo@ejemplo.cl', profile_code: 'ADMINISTRADOR_PLATAFORMA' })

  assert.equal(res.statusCode, 422)
  assert.equal(res.body?.error?.code, 'IDP_USER_NOT_FOUND')
  assert.equal('temporary_password' in (res.body?.data ?? {}), false)
})

test('POST /api/platform/users returns 201 without temporary password', async () => {
  const platformUsersService = {
    createPlatformUser: async () => ({
      ok: true,
      status: 201,
      data: {
        user: {
          id: 'profile-1',
          email: 'nuevo@ejemplo.cl',
          full_name: 'Nuevo Usuario',
          is_active: true,
          profile_code: 'ADMINISTRADOR_PLATAFORMA'
        }
      }
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'PlatformUser']]),
    platformUsersService
  })

  const res = await request(app)
    .post('/api/platform/users')
    .send({ email: 'nuevo@ejemplo.cl', profile_code: 'ADMINISTRADOR_PLATAFORMA' })

  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.user?.email, 'nuevo@ejemplo.cl')
  assert.equal('temporary_password' in (res.body?.data ?? {}), false)
})
