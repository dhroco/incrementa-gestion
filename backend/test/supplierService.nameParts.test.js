const test = require('node:test')
const assert = require('node:assert/strict')

const { SEED_IDENTITY_DOCUMENT_TYPES } = require('../utils/identityDocument')

const knexMod = require.resolve('../db/knex')
const serviceMod = require.resolve('../services/supplierService')
const controllerMod = require.resolve('../controllers/supplierController')
const originalKnex = require.cache[knexMod]

const NEW_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const EXISTING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const NAME_PART_KEYS = [
  'first_names',
  'last_name',
  'maternal_last_name',
  'rep_first_names',
  'rep_last_name',
  'rep_maternal_last_name'
]

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
    orWhereRaw() {
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
      if (table === 'identity_document_type') return SEED_IDENTITY_DOCUMENT_TYPES[0]
      if (table === 'supplier_persona_natural' || table === 'supplier_empresa') {
        return state.child || null
      }
      if (table === 'supplier' || table === 'supplier as s') {
        const base = state.existing || (state.insertedSupplier
          ? {
              id: NEW_ID,
              supplier_type: state.insertedSupplier.supplier_type,
              country_code: state.insertedSupplier.country_code
            }
          : null)
        if (!base) return null
        const child = state.child || {}
        const isEmpresa = base.supplier_type === 'empresa'
        return {
          id: base.id,
          supplier_type: base.supplier_type,
          country_code:
            state.updatedSupplier?.country_code ??
            state.insertedSupplier?.country_code ??
            base.country_code ??
            'CL',
          email: state.updatedSupplier?.email ?? state.insertedSupplier?.email ?? base.email ?? null,
          phone: state.updatedSupplier?.phone ?? state.insertedSupplier?.phone ?? base.phone ?? null,
          full_name: isEmpresa ? null : (child.full_name ?? null),
          first_names: isEmpresa ? null : (child.first_names ?? null),
          last_name: isEmpresa ? null : (child.last_name ?? null),
          maternal_last_name: isEmpresa ? null : (child.maternal_last_name ?? null),
          document_type_code: child.document_type_code ?? null,
          document_number: child.document_number ?? null,
          document_validator_key: 'rut_cl',
          address: child.address ?? null,
          razon_social: isEmpresa ? (child.razon_social ?? null) : null,
          empresa_document_type_code: isEmpresa ? (child.document_type_code ?? null) : null,
          empresa_document_number: isEmpresa ? (child.document_number ?? null) : null,
          nombre_rep_legal: isEmpresa ? (child.nombre_rep_legal ?? null) : null,
          rep_first_names: isEmpresa ? (child.rep_first_names ?? null) : null,
          rep_last_name: isEmpresa ? (child.rep_last_name ?? null) : null,
          rep_maternal_last_name: isEmpresa ? (child.rep_maternal_last_name ?? null) : null,
          rep_document_type_code: child.rep_document_type_code ?? null,
          rep_document_number: child.rep_document_number ?? null,
          rep_document_validator_key: 'rut_cl'
        }
      }
      return null
    },
    insert(row) {
      if (table === 'supplier') state.insertedSupplier = { ...row }
      if (table === 'supplier_persona_natural' || table === 'supplier_empresa') state.child = { ...row }
      return {
        returning: async () => [{ id: NEW_ID }],
        then(resolve, reject) {
          return Promise.resolve([]).then(resolve, reject)
        }
      }
    },
    update(row) {
      if (table === 'supplier') {
        state.updatedSupplier = { ...(state.updatedSupplier || {}), ...row }
      }
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
      if (table === 'supplier as s') {
        return Promise.resolve(state.listRows || []).then(resolve, reject)
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
  delete require.cache[controllerMod]
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

const personaContact = {
  country_code: 'CL',
  rut: '12.345.678-5',
  email: 'ana@x.cl'
}

const empresaContact = {
  supplier_type: 'empresa',
  country_code: 'CL',
  razon_social: 'Acme SpA',
  rut_empresa: '76.543.210-3',
  email: 'rep@acme.cl'
}

test('create persona natural from parts composes full_name', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: {
        supplier_type: 'persona_natural',
        ...personaContact,
        first_names: 'María José',
        last_name: 'Pérez',
        maternal_last_name: 'Soto'
      },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.child.full_name, 'María José Pérez Soto')
    assert.equal(state.child.first_names, 'María José')
    assert.equal(state.child.last_name, 'Pérez')
    assert.equal(state.child.maternal_last_name, 'Soto')
  } finally {
    restoreKnex()
  }
})

test('parts win over a different full_name', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: {
        supplier_type: 'persona_natural',
        ...personaContact,
        first_names: 'Ana',
        last_name: 'Soto',
        full_name: 'Otro Nombre'
      },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.child.full_name, 'Ana Soto')
    assert.equal(state.child.full_name === 'Otro Nombre', false)
    assert.equal(state.child.maternal_last_name, null)
  } finally {
    restoreKnex()
  }
})

test('incomplete persona parts are rejected and nothing is inserted', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: {
        supplier_type: 'persona_natural',
        ...personaContact,
        first_names: 'Ana'
      },
      userId: 'user-1'
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 400)
    assert.equal(result.message, 'El apellido paterno es obligatorio.')
    assert.equal(state.insertedSupplier, undefined)
  } finally {
    restoreKnex()
  }
})

test('missing given names are rejected', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: {
        supplier_type: 'persona_natural',
        ...personaContact,
        last_name: 'Soto'
      },
      userId: 'user-1'
    })
    assert.equal(result.ok, false)
    assert.equal(result.message, 'Los nombres son obligatorios.')
    assert.equal(state.insertedSupplier, undefined)
  } finally {
    restoreKnex()
  }
})

test('Create persona natural with only the composed name', async () => {
  const state = {}
  try {
    const service = installKnex(state)
    delete require.cache[controllerMod]
    const { createSupplierController } = require('../controllers/supplierController')
    const controller = createSupplierController({
      service,
      getUserProfileIdByUserId: async () => 'profile-1'
    })
    const res = mockRes()
    await controller.postCreate(
      {
        auth: { userId: 'user-1' },
        body: {
          supplier_type: 'persona_natural',
          ...personaContact,
          full_name: '  Juan  Pérez  '
        }
      },
      res
    )
    assert.equal(res.statusCode, 201)
    assert.equal(state.child.full_name, 'Juan  Pérez')
    assert.equal(state.child.first_names, 'Juan')
    assert.equal(state.child.last_name, 'Pérez')
    assert.equal(state.child.maternal_last_name, null)
  } finally {
    restoreKnex()
  }
})

test('partial last_name update recomposes full_name', async () => {
  const state = {
    existing: {
      id: EXISTING_ID,
      supplier_type: 'persona_natural',
      country_code: 'CL',
      email: 'ana@x.cl'
    },
    child: {
      supplier_id: EXISTING_ID,
      full_name: 'Juan Pérez',
      first_names: 'Juan',
      last_name: 'Pérez',
      maternal_last_name: null,
      document_type_code: 'RUT',
      document_number: '12345678-5'
    }
  }
  try {
    const { updateSupplier } = installKnex(state)
    const result = await updateSupplier(EXISTING_ID, {
      payload: { last_name: 'Soto' },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.child.last_name, 'Soto')
    assert.equal(state.child.first_names, 'Juan')
    assert.equal(state.child.full_name, 'Juan Soto')
    assert.equal(result.data.supplier.full_name, 'Juan Soto')
  } finally {
    restoreKnex()
  }
})

test('create empresa with representative parts leaves maternal surname NULL', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: {
        ...empresaContact,
        rep_first_names: 'Ana',
        rep_last_name: 'Soto'
      },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.child.nombre_rep_legal, 'Ana Soto')
    assert.equal(state.child.rep_first_names, 'Ana')
    assert.equal(state.child.rep_last_name, 'Soto')
    assert.equal(state.child.rep_maternal_last_name, null)
  } finally {
    restoreKnex()
  }
})

test('blank nombre_rep_legal stores NULL parts', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: { ...empresaContact, nombre_rep_legal: '   ' },
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.child.nombre_rep_legal, null)
    assert.equal(state.child.rep_first_names, null)
    assert.equal(state.child.rep_last_name, null)
    assert.equal(state.child.rep_maternal_last_name, null)
  } finally {
    restoreKnex()
  }
})

test('create empresa without a representative stores NULL names', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: empresaContact,
      userId: 'user-1'
    })
    assert.equal(result.ok, true)
    assert.equal(state.child.nombre_rep_legal, null)
    assert.equal(state.child.rep_first_names, null)
    assert.equal(state.child.rep_last_name, null)
    assert.equal(state.child.rep_maternal_last_name, null)
  } finally {
    restoreKnex()
  }
})

test('incomplete representative parts are rejected and nothing is inserted', async () => {
  const state = {}
  try {
    const { createSupplier } = installKnex(state)
    const result = await createSupplier({
      payload: {
        ...empresaContact,
        rep_first_names: 'Ana'
      },
      userId: 'user-1'
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 400)
    assert.equal(result.message, 'El apellido paterno es obligatorio.')
    assert.equal(state.insertedSupplier, undefined)
  } finally {
    restoreKnex()
  }
})

test('Detail includes all six parts', async () => {
  const state = {
    existing: {
      id: EXISTING_ID,
      supplier_type: 'persona_natural',
      country_code: 'CL'
    },
    child: {
      full_name: 'María José Pérez Soto',
      first_names: 'María José',
      last_name: 'Pérez',
      maternal_last_name: null
    }
  }
  try {
    const { getSupplierById } = installKnex(state)
    const persona = await getSupplierById(EXISTING_ID)
    assert.equal(persona.ok, true)
    const personaSupplier = persona.data.supplier
    assert.equal(personaSupplier.full_name, 'María José Pérez Soto')
    assert.equal(personaSupplier.first_names, 'María José')
    assert.equal(personaSupplier.last_name, 'Pérez')
    assert.equal(personaSupplier.maternal_last_name, null)
    assert.equal(personaSupplier.rep_first_names, null)
    assert.equal(personaSupplier.rep_last_name, null)
    assert.equal(personaSupplier.rep_maternal_last_name, null)
    for (const key of NAME_PART_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(personaSupplier, key), true)
    }

    state.existing = {
      id: EXISTING_ID,
      supplier_type: 'empresa',
      country_code: 'CL'
    }
    state.child = {
      razon_social: 'Acme SpA',
      nombre_rep_legal: null,
      rep_first_names: null,
      rep_last_name: null,
      rep_maternal_last_name: null,
      document_type_code: 'RUT',
      document_number: '76543210-3'
    }
    const empresa = await getSupplierById(EXISTING_ID)
    const empresaSupplier = empresa.data.supplier
    assert.equal(empresaSupplier.nombre_rep_legal, null)
    for (const key of NAME_PART_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(empresaSupplier, key), true)
      assert.equal(empresaSupplier[key], null)
    }
  } finally {
    restoreKnex()
  }
})

test('List shape is unchanged', async () => {
  const state = {
    listRows: [
      {
        id: EXISTING_ID,
        supplier_type: 'persona_natural',
        country_code: 'CL',
        full_name: 'Juan Pérez',
        razon_social: null,
        first_names: 'Juan',
        last_name: 'Pérez',
        maternal_last_name: null,
        rep_first_names: 'No',
        rep_last_name: 'Debe',
        rep_maternal_last_name: 'Salir',
        document_type_code: 'RUT',
        document_number: '12345678-5',
        document_validator_key: 'rut_cl'
      }
    ]
  }
  try {
    const { listSuppliers } = installKnex(state)
    const result = await listSuppliers({ search: '' })
    assert.equal(result.ok, true)
    const item = result.data.items[0]
    assert.equal(item.full_name, 'Juan Pérez')
    assert.equal(item.display_name, 'Juan Pérez')
    for (const key of NAME_PART_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(item, key), false)
    }
  } finally {
    restoreKnex()
  }
})
