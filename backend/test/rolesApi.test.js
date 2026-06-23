const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

const sampleRole = {
  id: 'role-1',
  code: 'CUSTOM_ROLE',
  label: 'Rol personalizado',
  createdAt: '2026-05-29T00:00:00.000Z',
  permissionsCount: 2,
  usersCount: 0,
  hasFullAccess: false
}

test('GET /api/roles returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })

  const res = await request(app).get('/api/roles')
  assert.equal(res.statusCode, 403)
})

test('GET /api/roles returns 200 with items', async () => {
  const rolesService = {
    listRoles: async () => ({
      ok: true,
      data: { items: [sampleRole] }
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'RolePermission']]),
    rolesService
  })

  const res = await request(app).get('/api/roles')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body?.data?.items?.[0]?.code, 'CUSTOM_ROLE')
})

test('POST /api/roles creates role', async () => {
  const rolesService = {
    createRole: async ({ code, label }) => {
      assert.equal(code, 'NUEVO_ROL')
      assert.equal(label, 'Nuevo rol')
      return {
        ok: true,
        status: 201,
        data: { role: { id: 'role-new', code, label, createdAt: '2026-05-29T00:00:00.000Z' } }
      }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'RolePermission']]),
    rolesService
  })

  const res = await request(app).post('/api/roles').send({ code: 'NUEVO_ROL', label: 'Nuevo rol' })
  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.role?.id, 'role-new')
})

test('PUT /api/roles/:id/permissions rejects invalid pair via service', async () => {
  const rolesService = {
    replaceRolePermissions: async ({ roleId, permissions }) => {
      assert.equal(roleId, 'role-1')
      assert.deepEqual(permissions, [{ action: 'delete', subject: 'Company' }])
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Permiso inválido: delete / Company.'
      }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'RolePermission']]),
    rolesService
  })

  const res = await request(app)
    .put('/api/roles/role-1/permissions')
    .send({ permissions: [{ action: 'delete', subject: 'Company' }] })

  assert.equal(res.statusCode, 400)
  assert.match(res.body?.error?.message, /inválido/i)
})

test('DELETE /api/roles/:id blocked when role has users', async () => {
  const rolesService = {
    deleteRole: async () => ({
      ok: false,
      status: 409,
      code: 'ROLE_IN_USE',
      message: 'No se puede eliminar un rol con usuarios asignados.'
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'RolePermission']]),
    rolesService
  })

  const res = await request(app).delete('/api/roles/role-1')
  assert.equal(res.statusCode, 409)
  assert.equal(res.body?.error?.message, 'No se puede eliminar un rol con usuarios asignados.')
})

test('DELETE /api/roles/:id blocked for platform admin role', async () => {
  const rolesService = {
    deleteRole: async () => ({
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'El rol de Administrador de plataforma no puede eliminarse.'
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'RolePermission']]),
    rolesService
  })

  const res = await request(app).delete('/api/roles/admin-role')
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.error?.message, 'El rol de Administrador de plataforma no puede eliminarse.')
})
