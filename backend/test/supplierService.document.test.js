const test = require('node:test')
const assert = require('node:assert/strict')
const { SEED_IDENTITY_DOCUMENT_TYPES } = require('../utils/identityDocument')

const knexMod = require.resolve('../db/knex')
const serviceMod = require.resolve('../services/supplierService')
const originalKnex = require.cache[knexMod]

function makeTable(table, state) {
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
    whereIn() {
      return api
    },
    whereILike() {
      return api
    },
    orWhereILike(col, t) {
      state.ilikes = state.ilikes || []
      state.ilikes.push({ col, t })
      return api
    },
    orWhereRaw(sql, bindings) {
      state.raws = state.raws || []
      state.raws.push({ sql, bindings })
      return api
    },
    andWhere(fn) {
      if (typeof fn === 'function') fn(api)
      return api
    },
    orderBy() {
      return api
    },
    orderByRaw() {
      return api
    },
    first: async () => {
      if (table === 'supplier' || table === 'supplier as s') {
        const base = state.insertedSupplier
        if (!base) return null
        return {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          supplier_type: base.supplier_type,
          country_code: base.country_code,
          email: base.email ?? null,
          phone: base.phone ?? null,
          full_name: state.child?.full_name ?? null,
          document_type_code: state.child?.document_type_code ?? null,
          document_number: state.child?.document_number ?? null,
          document_validator_key:
            state.child?.document_type_code === 'RFC' ? 'pattern' : 'rut_cl',
          empresa_document_type_code:
            base.supplier_type === 'empresa' ? state.child?.document_type_code : null,
          empresa_document_number:
            base.supplier_type === 'empresa' ? state.child?.document_number : null,
          razon_social: state.child?.razon_social ?? null,
          rep_document_type_code: state.child?.rep_document_type_code ?? null,
          rep_document_number: state.child?.rep_document_number ?? null,
          rep_document_validator_key: state.child?.rep_document_type_code === 'RFC' ? 'pattern' : 'rut_cl'
        }
      }
      return null
    },
    insert(row) {
      if (table === 'supplier') state.insertedSupplier = { ...row }
      if (table === 'supplier_persona_natural' || table === 'supplier_empresa') state.child = { ...row }
      return {
        returning: async () => [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }],
        then(resolve, reject) {
          return Promise.resolve([]).then(resolve, reject)
        }
      }
    },
    update() {
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
  function db(table) {
    return makeTable(table, state)
  }
  db.transaction = async (fn) => {
    const trx = function trx(table) {
      return makeTable(table, state)
    }
    trx.fn = { now: () => new Date() }
    trx.raw = (sql) => sql
    return fn(trx)
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

const opts = { partial: false, documentTypes: SEED_IDENTITY_DOCUMENT_TYPES }

test('create without country is rejected', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      {
        supplier_type: 'persona_natural',
        full_name: 'Ana',
        rut: '12.345.678-5',
        email: 'ana@x.cl'
      },
      opts
    )
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /país/)
  } finally {
    restoreKnex()
  }
})

test('Chilean invalid RUT keeps the existing message without echo', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      {
        supplier_type: 'persona_natural',
        country_code: 'CL',
        full_name: 'Ana',
        rut: '123',
        email: 'ana@x.cl'
      },
      opts
    )
    assert.equal(result.ok, false)
    assert.equal(result.errors[0], 'El RUT ingresado no es válido.')
    assert.equal(result.errors.join(' ').includes('123'), false)
  } finally {
    restoreKnex()
  }
})

test('alias rut 12.345.678-5 stores canonical 12345678-5', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      {
        supplier_type: 'persona_natural',
        country_code: 'CL',
        full_name: 'Ana',
        rut: '12.345.678-5',
        email: 'ana@x.cl'
      },
      opts
    )
    assert.equal(result.ok, true)
    assert.equal(result.data.document_number, '12345678-5')
    assert.equal(result.data.document_type_code, 'RUT')
  } finally {
    restoreKnex()
  }
})

test('Mexican persona RFC is stored uppercase', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: {
        supplier_type: 'persona_natural',
        country_code: 'MX',
        full_name: 'Ana López',
        document_number: 'legf870121mga',
        email: 'ana@x.mx'
      },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.child.document_number, 'LEGF870121MGA')
    assert.equal(state.child.document_type_code, 'RFC')
    assert.equal(result.data.supplier.document_display, 'LEGF870121MGA')
  } finally {
    restoreKnex()
  }
})

test('Mexican persona RFC of 12 characters is rejected without echo', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      {
        supplier_type: 'persona_natural',
        country_code: 'MX',
        full_name: 'Ana',
        document_number: 'ABC010203AB1',
        email: 'ana@x.mx'
      },
      opts
    )
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /RFC ingresado no es válido/)
    assert.equal(result.errors.join(' ').includes('ABC010203AB1'), false)
  } finally {
    restoreKnex()
  }
})

test('Mexican empresa RFC 12 with persona-física representative 13 is accepted', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      {
        supplier_type: 'empresa',
        country_code: 'MX',
        razon_social: 'Marca SA',
        document_number: 'ABC010203AB1',
        rut_rep_legal: 'LEGF870121MGA',
        email: 'rep@x.mx'
      },
      opts
    )
    assert.equal(result.ok, true)
    assert.equal(result.data.document_number, 'ABC010203AB1')
    assert.equal(result.data.rep_document_number, 'LEGF870121MGA')
  } finally {
    restoreKnex()
  }
})

test('I3: catalog-only pattern type validates without a new registry key', () => {
  try {
    const { _validatePayload } = installKnex({})
    const types = [
      ...SEED_IDENTITY_DOCUMENT_TYPES,
      {
        code: 'CUIT',
        country_code: 'AR',
        label: 'CUIT',
        label_long: 'CUIT',
        validator_key: 'pattern',
        pattern: '^\\d{11}$',
        format_example: '20123456789'
      }
    ]
    const ok = _validatePayload(
      {
        supplier_type: 'persona_natural',
        country_code: 'AR',
        full_name: 'Ana',
        document_number: '20123456789',
        email: 'ana@x.ar'
      },
      { partial: false, documentTypes: types }
    )
    const bad = _validatePayload(
      {
        supplier_type: 'persona_natural',
        country_code: 'AR',
        full_name: 'Ana',
        document_number: '2012345678',
        email: 'ana@x.ar'
      },
      { partial: false, documentTypes: types }
    )
    assert.equal(ok.ok, true)
    assert.equal(ok.data.document_number, '20123456789')
    assert.equal(bad.ok, false)
    assert.equal(bad.errors.join(' ').includes('2012345678'), false)
  } finally {
    restoreKnex()
  }
})

test('listSuppliers searches dotted RUT, digit fragment and RFC fragment', async () => {
  const state = {}
  try {
    const { listSuppliers } = installKnex(state)
    await listSuppliers({ search: '12.345.678-5' })
    const cols = (state.ilikes || []).map((x) => x.col)
    assert.ok(cols.includes('spn.document_number'))
    assert.ok(cols.includes('se.document_number'))
    const compactSql = (state.raws || []).map((x) => x.sql).join(' ')
    assert.match(compactSql, /replace\(replace\(replace/)
    assert.ok((state.raws || []).some((x) => String(x.bindings).includes('123456785')))

    state.ilikes = []
    state.raws = []
    await listSuppliers({ search: 'LEGF870' })
    assert.ok((state.ilikes || []).some((x) => x.t.includes('LEGF870')))
    assert.ok((state.raws || []).some((x) => String(x.bindings).includes('LEGF870')))
  } finally {
    restoreKnex()
  }
})
