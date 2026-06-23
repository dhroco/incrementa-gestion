const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

test('GET /api/clients returns 403 without grant', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })

  const res = await request(app).get('/api/clients')
  assert.equal(res.statusCode, 403)
})

test('GET /api/clients returns 200 with items and search', async () => {
  let receivedSearch
  const clientService = {
    listClients: async ({ search } = {}) => {
      receivedSearch = search
      return {
        ok: true,
        data: {
          items: [
            {
              id: 'c1',
              name: 'Cliente Demo',
              brand: 'Marca Demo',
              brand_account: '@marca',
              product_campaign_count: 2
            }
          ]
        }
      }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Client']]),
    clientService
  })

  const res = await request(app).get('/api/clients').query({ search: 'marca' })
  assert.equal(res.statusCode, 200)
  assert.equal(receivedSearch, 'marca')
  assert.equal(res.body?.data?.items?.length, 1)
  assert.equal(res.body?.data?.items?.[0]?.id, 'c1')
})

test('POST /api/clients creates client with campaigns', async () => {
  const clientService = {
    createClient: async ({ payload, userId }) => {
      assert.equal(userId, 'profile-1')
      assert.equal(payload.name, 'Cliente X')
      assert.equal(payload.product_campaigns.length, 1)
      return {
        ok: true,
        data: { client: { id: 'new-1', name: 'Cliente X', product_campaigns: [{ name: 'Campaña A' }] } }
      }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['create', 'Client']]),
    userProfileIdResolver: async () => 'profile-1',
    clientService
  })

  const res = await request(app)
    .post('/api/clients')
    .send({
      name: 'Cliente X',
      brand: 'Marca X',
      product_campaigns: [{ name: 'Campaña A' }]
    })

  assert.equal(res.statusCode, 201)
  assert.equal(res.body?.data?.client?.id, 'new-1')
})

test('PUT /api/clients/:id replaces product campaigns', async () => {
  const clientService = {
    updateClient: async (id, { payload }) => {
      assert.equal(id, 'c1')
      assert.equal(payload.product_campaigns.length, 2)
      return { ok: true, data: { client: { id: 'c1', product_campaign_count: 2 } } }
    }
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['update', 'Client']]),
    userProfileIdResolver: async () => 'profile-1',
    clientService
  })

  const res = await request(app)
    .put('/api/clients/c1')
    .send({
      name: 'Cliente X',
      brand: 'Marca X',
      product_campaigns: [{ name: 'A' }, { name: 'B' }]
    })

  assert.equal(res.statusCode, 200)
})

test('GET /api/clients/:id returns 404 when not found', async () => {
  const clientService = {
    getClientById: async () => ({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Cliente no encontrado.'
    })
  }
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([['read', 'Client']]),
    clientService
  })

  const res = await request(app).get('/api/clients/missing-id')
  assert.equal(res.statusCode, 404)
})
