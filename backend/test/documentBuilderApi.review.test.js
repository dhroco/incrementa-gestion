const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('../app')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function authOk(req, _res, next) {
  req.auth = { userId: 'u1', email: 'a@b.cl' }
  next()
}

test('The review route uses the document builder ability', async () => {
  const app = createApp({
    requireAuth: authOk,
    attachAbilityMiddleware: attachAbilityWithRules([])
  })
  const res = await request(app)
    .post('/api/document-builder/review?companyId=c1')
    .send({ supplierId: '', template: {} })
  assert.equal(res.statusCode, 403)
  assert.equal(res.body?.status, 'forbidden')
})
