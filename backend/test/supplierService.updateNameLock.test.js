const test = require('node:test')
const assert = require('node:assert/strict')

const { SEED_IDENTITY_DOCUMENT_TYPES } = require('../utils/identityDocument')

const knexMod = require.resolve('../db/knex')
const serviceMod = require.resolve('../services/supplierService')
const originalKnex = require.cache[knexMod]

const EXISTING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function makeTable(table, state, ctx) {
  const api = {
    leftJoin() {
      return api
    },
    join() {
      return api
    },
    select() {
      return api
    },
    where() {
      return api
    },
    orderBy() {
      return api
    },
    forUpdate() {
      state.forUpdateCalls.push({ table, inTx: ctx.inTx })
      api._locked = true
      if (ctx.inTx) {
        const previous = state.lock
        let release
        const gate = new Promise((resolve) => { release = resolve })
        state.lock = gate
        ctx.hold(release)
        api._wait = previous
      }
      return api
    },
    first: async () => {
      if (table === 'identity_document_type') return SEED_IDENTITY_DOCUMENT_TYPES[0]
      if (table === 'supplier_persona_natural' || table === 'supplier_empresa') {
        if (api._locked && ctx.inTx) await api._wait
        const snapshot = { ...(state.child || {}) }
        state.childReads.push({ inTx: ctx.inTx, forUpdate: api._locked === true, snapshot })
        return snapshot
      }
      if (table === 'supplier' || table === 'supplier as s') {
        const child = state.child || {}
        const base = state.existing
        return {
          id: base.id,
          supplier_type: base.supplier_type,
          country_code: base.country_code,
          email: state.supplier?.email ?? base.email ?? null,
          phone: state.supplier?.phone ?? base.phone ?? null,
          full_name: child.full_name ?? null,
          first_names: child.first_names ?? null,
          last_name: child.last_name ?? null,
          maternal_last_name: child.maternal_last_name ?? null,
          document_type_code: child.document_type_code ?? 'RUT',
          document_number: child.document_number ?? '12345678-5',
          document_validator_key: 'rut_cl',
          address: child.address ?? null
        }
      }
      return null
    },
    update(row) {
      if (table === 'supplier') state.supplier = { ...(state.supplier || {}), ...row }
      if (table === 'supplier_persona_natural' || table === 'supplier_empresa') {
        state.child = { ...(state.child || {}), ...row }
      }
      return Promise.resolve(1)
    },
    del: async () => 0,
    then(resolve, reject) {
      if (table === 'identity_document_type') {
        return Promise.resolve(SEED_IDENTITY_DOCUMENT_TYPES).then(resolve, reject)
      }
      return Promise.resolve([]).then(resolve, reject)
    }
  }
  return api
}

function installKnex(state) {
  state.forUpdateCalls = state.forUpdateCalls || []
  state.childReads = state.childReads || []
  state.lock = state.lock || Promise.resolve()
  function db(table) {
    return makeTable(table, state, { inTx: false, hold() {} })
  }
  db.transaction = async (fn) => {
    let release = () => {}
    const ctx = {
      inTx: true,
      hold(next) { release = next }
    }
    const trx = function trx(table) {
      return makeTable(table, state, ctx)
    }
    trx.fn = { now: () => new Date() }
    trx.raw = (sql) => sql
    try {
      return await fn(trx)
    } finally {
      release()
    }
  }
  db.fn = { now: () => new Date() }
  db.raw = (sql) => sql
  require.cache[knexMod] = { id: knexMod, filename: knexMod, loaded: true, exports: { db } }
  delete require.cache[serviceMod]
  return require('../services/supplierService')
}

function restoreKnex() {
  if (originalKnex) require.cache[knexMod] = originalKnex
  else delete require.cache[knexMod]
  delete require.cache[serviceMod]
}

test('concurrent partial updates on different name parts do not overwrite each other', async () => {
  const state = {
    existing: {
      id: EXISTING_ID,
      supplier_type: 'persona_natural',
      country_code: 'CL',
      email: 'ana@x.cl',
      phone: null
    },
    child: {
      supplier_id: EXISTING_ID,
      full_name: 'Juan Pérez Soto',
      first_names: 'Juan',
      last_name: 'Pérez',
      maternal_last_name: 'Soto',
      document_type_code: 'RUT',
      document_number: '12345678-5'
    }
  }
  try {
    const { updateSupplier } = installKnex(state)
    const [byLastName, byFirstNames] = await Promise.all([
      updateSupplier(EXISTING_ID, { payload: { last_name: 'Gómez' }, userId: 'user-1' }),
      updateSupplier(EXISTING_ID, { payload: { first_names: 'María' }, userId: 'user-2' })
    ])
    assert.equal(byLastName.ok, true, byLastName.message)
    assert.equal(byFirstNames.ok, true, byFirstNames.message)
    assert.equal(state.child.first_names, 'María')
    assert.equal(state.child.last_name, 'Gómez')
    assert.equal(state.child.maternal_last_name, 'Soto')
    assert.equal(state.child.full_name, 'María Gómez Soto')

    const childLocks = state.forUpdateCalls.filter((call) => call.table === 'supplier_persona_natural')
    assert.equal(childLocks.length, 2)
    assert.equal(childLocks.every((call) => call.inTx), true)
    assert.equal(state.childReads.length, 2)
    assert.equal(state.childReads.every((read) => read.inTx && read.forUpdate), true)
    assert.equal(state.childReads[0].snapshot.first_names, 'Juan')
    assert.equal(state.childReads[0].snapshot.last_name, 'Pérez')
    const second = state.childReads[1].snapshot
    assert.equal(second.first_names === 'María' || second.last_name === 'Gómez', true)
  } finally {
    restoreKnex()
  }
})

test('text mode without full_name keeps the required message', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload({
      supplier_type: 'persona_natural',
      country_code: 'CL',
      rut: '12.345.678-5',
      email: 'ana@x.cl',
      full_name: ''
    }, { partial: false, documentTypes: SEED_IDENTITY_DOCUMENT_TYPES })
    assert.equal(result.ok, false)
    assert.equal(result.errors.includes('El nombre completo es obligatorio.'), true)
  } finally {
    restoreKnex()
  }
})
