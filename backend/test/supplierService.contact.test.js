const test = require('node:test')
const assert = require('node:assert/strict')

const knexMod = require.resolve('../db/knex')
const serviceMod = require.resolve('../services/supplierService')

const NEW_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const EXISTING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

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
    orWhereILike() {
      return api
    },
    andWhere() {
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
        const base = state.existing || (state.insertedSupplier
          ? { id: NEW_ID, supplier_type: state.insertedSupplier.supplier_type }
          : null)
        if (!base) return null
        return {
          id: base.id,
          supplier_type: base.supplier_type,
          email: state.updatedSupplier?.email ?? state.insertedSupplier?.email ?? base.email ?? null,
          phone: state.updatedSupplier?.phone ?? state.insertedSupplier?.phone ?? base.phone ?? null,
          full_name: state.child?.full_name ?? 'Ana Gómez',
          rut_body: state.child?.rut_body ?? '12345678',
          rut_dv: state.child?.rut_dv ?? '5',
          address: state.child?.address ?? null
        }
      }
      return null
    },
    insert(row) {
      if (table === 'supplier') state.insertedSupplier = { ...row }
      if (table === 'supplier_persona_natural') state.child = { ...row }
      const thenable = {
        returning: async () => [{ id: NEW_ID }],
        then(resolve, reject) {
          return Promise.resolve([]).then(resolve, reject)
        }
      }
      return thenable
    },
    update(row) {
      if (table === 'supplier') {
        state.updatedSupplier = { ...(state.updatedSupplier || {}), ...row }
      }
      if (table === 'supplier_persona_natural') {
        state.child = { ...(state.child || {}), ...row }
      }
      return Promise.resolve(1)
    },
    del: async () => 0,
    then(resolve, reject) {
      return Promise.resolve([]).then(resolve, reject)
    }
  }
  return api
}

function makeDb(state) {
  function db(table) {
    return makeTable(table, state)
  }
  db.transaction = async (fn) => {
    const trx = function trx(table) {
      return makeTable(table, state)
    }
    trx.fn = { now: () => new Date() }
    return fn(trx)
  }
  db.fn = { now: () => new Date() }
  db.raw = (sql) => sql
  return db
}

function installKnex(state) {
  const db = makeDb(state)
  require.cache[knexMod] = {
    id: knexMod,
    filename: knexMod,
    loaded: true,
    exports: { db }
  }
  delete require.cache[serviceMod]
  return require('../services/supplierService')
}

function restoreKnex() {
  if (originalKnex) require.cache[knexMod] = originalKnex
  else delete require.cache[knexMod]
  delete require.cache[serviceMod]
}

const personaBase = {
  supplier_type: 'persona_natural',
  full_name: 'Ana Gómez',
  rut: '12.345.678-5'
}

test('validatePayload requires email on create', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(personaBase, { partial: false })
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /correo es obligatorio/)
    assert.equal(result.errors.join(' ').includes('@'), false)
  } finally {
    restoreKnex()
  }
})

test('validatePayload rejects invalid email without echoing the value', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      { ...personaBase, email: 'no-es-un-correo' },
      { partial: false }
    )
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /formato válido/)
    assert.equal(result.errors.join(' ').includes('no-es-un-correo'), false)
  } finally {
    restoreKnex()
  }
})

test('validatePayload lowercases email on create', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      { ...personaBase, email: 'Ana.Gomez@Agencia.CL' },
      { partial: false }
    )
    assert.equal(result.ok, true)
    assert.equal(result.data.email, 'ana.gomez@agencia.cl')
  } finally {
    restoreKnex()
  }
})

test('validatePayload allows the same email on two creates', () => {
  try {
    const { _validatePayload } = installKnex({})
    const a = _validatePayload({ ...personaBase, email: 'agencia@x.cl' }, { partial: false })
    const b = _validatePayload(
      { ...personaBase, full_name: 'Otra', email: 'agencia@x.cl' },
      { partial: false }
    )
    assert.equal(a.ok, true)
    assert.equal(b.ok, true)
  } finally {
    restoreKnex()
  }
})

test('validatePayload omits email on partial update when not sent', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      { full_name: 'Ana Gómez' },
      { partial: true, existingType: 'persona_natural' }
    )
    assert.equal(result.ok, true)
    assert.equal(result.data.email, undefined)
  } finally {
    restoreKnex()
  }
})

test('validatePayload stores empty email as null on update', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      { email: '  ' },
      { partial: true, existingType: 'persona_natural' }
    )
    assert.equal(result.ok, true)
    assert.equal(result.data.email, null)
  } finally {
    restoreKnex()
  }
})

test('validatePayload keeps foreign phone as typed', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      { ...personaBase, email: 'ana@x.cl', phone: '+52 55 1234 5678' },
      { partial: false }
    )
    assert.equal(result.ok, true)
    assert.equal(result.data.phone, '+52 55 1234 5678')
  } finally {
    restoreKnex()
  }
})

test('validatePayload rejects phone with letters without echoing the value', () => {
  try {
    const { _validatePayload } = installKnex({})
    const result = _validatePayload(
      { ...personaBase, email: 'ana@x.cl', phone: 'abc-1234' },
      { partial: false }
    )
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /teléfono no tiene un formato válido/)
    assert.equal(result.errors.join(' ').includes('abc-1234'), false)
  } finally {
    restoreKnex()
  }
})

test('createSupplier persists lowercased email and typed phone', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: { ...personaBase, email: 'Ana.Gomez@Agencia.CL', phone: '+52 55 1234 5678' },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.insertedSupplier.email, 'ana.gomez@agencia.cl')
    assert.equal(state.insertedSupplier.phone, '+52 55 1234 5678')
    assert.equal(result.data.supplier.email, 'ana.gomez@agencia.cl')
    assert.equal(result.data.supplier.phone, '+52 55 1234 5678')
  } finally {
    restoreKnex()
  }
})

test('createSupplier rejects missing email with 400', async () => {
  try {
    const { createSupplier } = installKnex({})
    const result = await createSupplier({ payload: personaBase, userId: 'user-1' })
    assert.equal(result.ok, false)
    assert.equal(result.status, 400)
    assert.equal(result.code, 'VALIDATION_ERROR')
    assert.match(result.message, /correo es obligatorio/)
  } finally {
    restoreKnex()
  }
})

test('createSupplier allows two suppliers with the same email', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const a = await createSupplier({
      payload: { ...personaBase, email: 'agencia@x.cl' },
      userId: 'user-1'
    })
    const b = await createSupplier({
      payload: { ...personaBase, full_name: 'Otra Persona', email: 'agencia@x.cl' },
      userId: 'user-1'
    })
    assert.equal(a.ok, true)
    assert.equal(b.ok, true)
  } finally {
    restoreKnex()
  }
})

test('updateSupplier persists email-only payload on the base table', async () => {
  const state = {
    existing: { id: EXISTING_ID, supplier_type: 'persona_natural', email: null, phone: null }
  }
  try {
    const { updateSupplier } = installKnex(state)
    const result = await updateSupplier(EXISTING_ID, {
      payload: { email: 'nuevo@x.cl' },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.updatedSupplier.email, 'nuevo@x.cl')
    assert.equal(result.data.supplier.email, 'nuevo@x.cl')
  } finally {
    restoreKnex()
  }
})

test('updateSupplier omitting email on legacy supplier keeps NULL', async () => {
  const state = {
    existing: { id: EXISTING_ID, supplier_type: 'persona_natural', email: null, phone: null }
  }
  try {
    const { updateSupplier } = installKnex(state)
    const result = await updateSupplier(EXISTING_ID, {
      payload: { address: 'Calle Nueva 1' },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.updatedSupplier.email, undefined)
    assert.equal(result.data.supplier.email, null)
  } finally {
    restoreKnex()
  }
})
