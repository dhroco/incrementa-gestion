const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

test('un error no controlado responde 500 en JSON, sin stack ni mensaje interno', async () => {
  const original = console.error
  console.error = () => {}
  try {
    const app = createApp({
      requireAuth: authOk,
      attachAbilityMiddleware: attachAbilityWithRules([['read', 'Contract']]),
      contractsQueryService: {
        listContracts: async () => {
          throw new Error('invalid input syntax for type uuid: "abc" select * from supplier')
        }
      }
    })
    const res = await request(app).get('/api/contracts')
    assert.equal(res.statusCode, 500)
    assert.match(res.headers['content-type'], /application\/json/)
    assert.equal(res.body?.error?.code, 'UNEXPECTED_ERROR')
    assert.equal(res.body?.error?.message, 'Ocurrió un error inesperado.')
    assert.ok(!res.text.includes('select * from supplier'))
    assert.ok(!res.text.includes('at '))
  } finally {
    console.error = original
  }
})
