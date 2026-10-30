const test = require('node:test')
const assert = require('node:assert/strict')

const knexPath = require.resolve('../db/knex')

function makeDb(initial) {
  const state = {
    client: { ...initial.client },
    campaigns: initial.campaigns.map((c) => ({ ...c })),
    updates: [],
    deletes: 0,
    inserts: 0
  }
  const table = (name, store) => {
    if (name === 'client') {
      return {
        select: () => ({ where: () => ({ first: async () => ({ ...state.client }) }) }),
        where: () => ({
          update: async (patch) => {
            state.updates.push(patch)
            Object.assign(state.client, patch)
          }
        })
      }
    }
    return {
      where: () => ({
        select: () => ({ orderBy: async () => state.campaigns.map((c) => ({ ...c })) }),
        delete: async () => {
          state.deletes++
          state.campaigns = []
        }
      }),
      insert: async (rows) => {
        state.inserts++
        state.campaigns = rows.map((r, i) => ({ id: `n${i}`, client_id: 'c1', ...r }))
      }
    }
  }
  const db = (name) => table(name)
  db.fn = { now: () => 'now()' }
  db.transaction = async (fn) => {
    const trx = (name) => table(name)
    trx.fn = db.fn
    return fn(trx)
  }
  return { db, state }
}

function loadService(db) {
  delete require.cache[require.resolve('../services/clientService')]
  require.cache[knexPath] = { id: knexPath, filename: knexPath, loaded: true, exports: { db } }
  return require('../services/clientService')
}

const INITIAL = {
  client: { id: 'c1', name: 'Soprole SA', brand: 'Soprole', brand_account: '@soprole' },
  campaigns: [
    { id: 'p1', client_id: 'c1', name: 'Yoghurt', sort_order: 0 },
    { id: 'p2', client_id: 'c1', name: 'Leche', sort_order: 1 }
  ]
}

test('actualizar solo la marca conserva la cuenta y las campañas', async () => {
  const { db, state } = makeDb(INITIAL)
  const service = loadService(db)
  const result = await service.updateClient('c1', { payload: { brand: 'Soprole Chile' }, userId: 'u1' })
  assert.equal(result.ok, true)
  assert.equal(state.client.brand, 'Soprole Chile')
  assert.equal(state.client.brand_account, '@soprole')
  assert.equal(state.client.name, 'Soprole SA')
  assert.equal(state.deletes, 0)
  assert.deepEqual(result.data.client.product_campaigns.map((c) => c.name), ['Yoghurt', 'Leche'])
})

test('enviar product_campaigns reemplaza la lista completa', async () => {
  const { db, state } = makeDb(INITIAL)
  const service = loadService(db)
  const result = await service.updateClient('c1', { payload: { product_campaigns: [{ name: 'Queso' }] }, userId: 'u1' })
  assert.equal(result.ok, true)
  assert.equal(state.deletes, 1)
  assert.deepEqual(result.data.client.product_campaigns.map((c) => c.name), ['Queso'])
  assert.equal(state.client.brand_account, '@soprole')
})

test('brand_account vacío o null sí borra la cuenta (decisión explícita)', async () => {
  for (const value of ['', null]) {
    const { db, state } = makeDb(INITIAL)
    const service = loadService(db)
    await service.updateClient('c1', { payload: { brand_account: value }, userId: 'u1' })
    assert.equal(state.client.brand_account, null, String(value))
    assert.equal(state.client.brand, 'Soprole')
  }
})

test('el formulario completo (PUT con todos los campos) sigue reemplazando todo', async () => {
  const { db, state } = makeDb(INITIAL)
  const service = loadService(db)
  await service.updateClient('c1', {
    payload: { name: 'Otro', brand: 'Otra', brand_account: '', product_campaigns: [] },
    userId: 'u1'
  })
  assert.deepEqual(
    { name: state.client.name, brand: state.client.brand, brand_account: state.client.brand_account },
    { name: 'Otro', brand: 'Otra', brand_account: null }
  )
  assert.equal(state.campaigns.length, 0)
})

test('un nombre o marca vacío enviado explícitamente sigue siendo error; cliente inexistente da 404', async () => {
  const { db } = makeDb(INITIAL)
  const service = loadService(db)
  const bad = await service.updateClient('c1', { payload: { brand: '  ' }, userId: 'u1' })
  assert.equal(bad.ok, false)
  assert.equal(bad.code, 'VALIDATION_ERROR')

  const missing = loadService(Object.assign((n) => ({ select: () => ({ where: () => ({ first: async () => undefined }) }) }), { fn: {}, transaction: async () => {} }))
  const nf = await missing.updateClient('x', { payload: { brand: 'A' } })
  assert.equal(nf.status, 404)
})
