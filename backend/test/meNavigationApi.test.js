const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')

function authStub(req, _res, next) {
  req.auth = { userId: 'user-1', email: 'user@example.com' }
  next()
}

test('GET /api/me/navigation returns filtered ordered tree', async () => {
  const effectiveNavigationResolver = async () => ({
    profile: { code: 'ADMINISTRADOR_PLATAFORMA', label: 'Administrador de plataforma' },
    rows: [
      // parent
      {
        id: 'm1',
        parent_id: null,
        code: 'NAV_MENU_INICIO',
        label: 'Inicio',
        route_path: null,
        module_title: null,
        sort_order: 100,
        show_in_main_menu: true
      },
      // child (out of order to validate sort)
      {
        id: 'c2',
        parent_id: 'm1',
        code: 'NAV_ITEM_INICIO_INSTRUCTIVO',
        label: 'Instructivo',
        route_path: '/app/instructivo',
        module_title: 'Instructivo',
        sort_order: 140,
        show_in_main_menu: true
      },
      {
        id: 'c1',
        parent_id: 'm1',
        code: 'NAV_ITEM_INICIO_DASHBOARD',
        label: 'Dashboard',
        route_path: '/app/dashboard',
        module_title: 'Dashboard',
        sort_order: 110,
        show_in_main_menu: true
      }
    ]
  })

  const app = createApp({ requireAuth: authStub, effectiveNavigationResolver })

  const res = await request(app).get('/api/me/navigation').expect(200)
  assert.equal(res.body.profile.code, 'ADMINISTRADOR_PLATAFORMA')
  assert.ok(res.body.navigation)
  assert.ok(Array.isArray(res.body.navigation.tree))

  const [root] = res.body.navigation.tree
  assert.equal(root.code, 'NAV_MENU_INICIO')
  assert.ok(Array.isArray(root.children))
  assert.equal(root.children[0].code, 'NAV_ITEM_INICIO_DASHBOARD')
  assert.deepEqual(res.body.navigation.grantedCodes, [
    'NAV_ITEM_INICIO_DASHBOARD',
    'NAV_ITEM_INICIO_INSTRUCTIVO',
    'NAV_MENU_INICIO'
  ])
})

test('GET /api/me/navigation returns PROFILE_NOT_ASSIGNED when missing profile', async () => {
  const effectiveNavigationResolver = async () => null
  const app = createApp({ requireAuth: authStub, effectiveNavigationResolver })

  const res = await request(app).get('/api/me/navigation').expect(404)
  assert.equal(res.body.code, 'PROFILE_NOT_ASSIGNED')
})

test('GET /api/me/navigation returns empty tree when profile has no granted rows', async () => {
  const effectiveNavigationResolver = async () => ({
    profile: { code: 'CONTADOR', label: 'Contador' },
    rows: []
  })

  const app = createApp({ requireAuth: authStub, effectiveNavigationResolver })
  const res = await request(app).get('/api/me/navigation').expect(200)
  assert.deepEqual(res.body.navigation.tree, [])
  assert.deepEqual(res.body.navigation.grantedCodes, [])
})

