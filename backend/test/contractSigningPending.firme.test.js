const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')

const { createApp } = require('../app')
const { createContractSigningService } = require('../services/contractSigningService')
const { attachAbilityWithRules } = require('./testAbilityHelpers')

function pendingDb(rows) {
  const calls = []
  function chain() {
    const api = {
      join() {
        calls.push('join')
        return api
      },
      leftJoin() {
        calls.push('leftJoin')
        return api
      },
      whereNotIn(_column, values) {
        calls.push({ whereNotIn: values })
        return api
      },
      select(...args) {
        calls.push({ select: args.flat() })
        return api
      },
      orderBy() {
        calls.push('orderBy')
        return api
      },
      then(resolve, reject) {
        return Promise.resolve(rows).then(resolve, reject)
      }
    }
    return api
  }
  const db = () => chain()
  db.raw = (sql) => sql
  db.calls = calls
  return db
}

const naturalRow = {
  id: 'draft-natural',
  supplier_type: 'persona_natural',
  supplier_name: 'Ana Pérez Soto',
  first_names: 'Ana María',
  last_name: 'Pérez',
  maternal_last_name: 'Soto',
  document_number: '12345678-5',
  rep_document_number: '99999999-9',
  supplier_email: 'ana@ejemplo.cl',
  file_name: 'a.pdf',
  gcs_path: 'contratos/a.pdf',
  contract_overrides: {}
}

const companyRow = {
  id: 'draft-empresa',
  supplier_type: 'empresa',
  supplier_name: 'Acme SpA',
  document_number: '76000000-1',
  rep_first_names: 'Luis',
  rep_last_name: 'Rojas',
  rep_maternal_last_name: 'Díaz',
  rep_document_number: '11111111-1',
  supplier_email: 'rep@empresa.cl',
  file_name: 'b.pdf',
  gcs_path: 'contratos/b.pdf',
  contract_overrides: {}
}

test('Natural person suggestion uses the supplier parts', async () => {
  const db = pendingDb([naturalRow])
  const service = createContractSigningService({ db, storageService: {}, emailService: {} })
  const result = await service.listPendingSignature()
  const suggestion = result.data.items[0].signee_suggestion
  assert.equal(suggestion.first_names, 'Ana María')
  assert.equal(suggestion.last_name, 'Pérez')
  assert.equal(suggestion.maternal_last_name, 'Soto')
  assert.equal(suggestion.document_number, '12345678-5')
  assert.equal(suggestion.email, 'ana@ejemplo.cl')
  const excluded = db.calls.find((call) => call.whereNotIn)
  assert.ok(excluded.whereNotIn.includes('in_signature'))
  assert.deepEqual(
    db.calls.filter((call) => typeof call === 'string'),
    ['join', 'leftJoin', 'leftJoin', 'leftJoin', 'leftJoin', 'join', 'orderBy']
  )
})

test('Company suggestion uses the legal representative', async () => {
  const db = pendingDb([companyRow])
  const service = createContractSigningService({ db, storageService: {}, emailService: {} })
  const result = await service.listPendingSignature()
  const suggestion = result.data.items[0].signee_suggestion
  assert.equal(suggestion.first_names, 'Luis')
  assert.equal(suggestion.last_name, 'Rojas')
  assert.equal(suggestion.maternal_last_name, 'Díaz')
  assert.equal(suggestion.document_number, '11111111-1')
  assert.notEqual(suggestion.document_number, companyRow.document_number)
  assert.equal(suggestion.email, 'rep@empresa.cl')
})

test('Missing Firme service reports internal mode', async () => {
  const db = pendingDb([naturalRow])
  const contractSigningService = createContractSigningService({ db, storageService: {}, emailService: {} })
  const app = createApp({
    requireAuth: (req, _res, next) => {
      req.auth = { userId: 'u1', email: 'a@b.cl' }
      next()
    },
    attachAbilityMiddleware: attachAbilityWithRules([['sign', 'Contract']]),
    contractSigningService
  })
  const res = await request(app).get('/api/contracts/pending-signature')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.data.items[0].signing_mode, 'internal')
  assert.equal(typeof res.body.meta.email_enabled, 'boolean')
  const excluded = db.calls.find((call) => call.whereNotIn)
  assert.ok(excluded.whereNotIn.includes('in_signature'))
})
