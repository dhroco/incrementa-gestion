const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const { SEED_IDENTITY_DOCUMENT_TYPES } = require('../utils/identityDocument')

const knexMod = require.resolve('../db/knex')
const serviceMod = require.resolve('../services/supplierService')
const originalKnex = require.cache[knexMod]

const PROFILE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const NEW_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const EXISTING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const PART_KEYS = [
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
      if (table === 'supplier_persona_natural' || table === 'supplier_empresa') return state.child || null
      if (table === 'supplier' || table === 'supplier as s') {
        const base = state.existing || (state.insertedSupplier
          ? { id: NEW_ID, supplier_type: state.insertedSupplier.supplier_type }
          : null)
        if (!base) return null
        const child = state.child || {}
        return {
          id: base.id,
          supplier_type: base.supplier_type,
          country_code: state.insertedSupplier?.country_code ?? base.country_code ?? 'CL',
          email: state.insertedSupplier?.email ?? base.email ?? null,
          phone: base.phone ?? null,
          full_name: child.full_name ?? null,
          first_names: child.first_names ?? null,
          last_name: child.last_name ?? null,
          maternal_last_name: child.maternal_last_name ?? null,
          document_type_code: child.document_type_code ?? 'RUT',
          document_number: child.document_number ?? '12345678-5',
          document_validator_key: 'rut_cl',
          razon_social: child.razon_social ?? null
        }
      }
      return null
    },
    insert(row) {
      state.inserts = state.inserts || []
      state.inserts.push(table)
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

function createMockServer() {
  const tools = new Map()
  return {
    tool(name, description, schema, handler) {
      tools.set(name, { description, schema, handler })
    },
    getTool(name) {
      return tools.get(name)
    }
  }
}

function parseToolJson(result) {
  assert.equal(result.content.length, 1)
  assert.equal(result.content[0].type, 'text')
  return JSON.parse(result.content[0].text)
}

async function register(state) {
  const { registerMcpTools } = await import('../mcpTools.mjs')
  const supplierService = installKnex(state)
  const server = createMockServer()
  registerMcpTools(server, {
    db: () => ({
      select() {
        return this
      },
      orderBy() {
        return this
      },
      then(resolve) {
        return Promise.resolve(resolve([]))
      }
    }),
    supplierService,
    clientService: {},
    standardTemplatesService: {},
    documentBuilderService: {},
    contractsQueryService: {},
    contractSigningService: {},
    storageService: {},
    getUserProfileIdByUserId: async () => PROFILE_ID
  })
  return server
}

const personaBase = {
  supplier_type: 'persona_natural',
  country_code: 'CL',
  rut: '12.345.678-5',
  email: 'ana@x.cl'
}

describe('MCP supplier name parts', { concurrency: false }, () => {
test('MCP supplier tools accept optional name parts and still accept a full name', async () => {
  const state = {}
  try {
    const server = await register(state)
    const createTool = server.getTool('crear_proveedor')
    const updateTool = server.getTool('actualizar_proveedor')
    for (const key of PART_KEYS) {
      assert.ok(createTool.description.includes(key))
      assert.ok(updateTool.description.includes(key))
    }
    assert.match(createTool.description, /opcional/i)
    assert.match(updateTool.description, /opcional/i)

    const fromParts = parseToolJson(
      await createTool.handler({
        payload: {
          ...personaBase,
          first_names: 'María José',
          last_name: 'Pérez',
          maternal_last_name: 'Soto'
        }
      })
    )
    assert.equal(fromParts.ok, true)
    assert.equal(state.child.full_name, 'María José Pérez Soto')

    const fromName = parseToolJson(
      await createTool.handler({
        payload: { ...personaBase, full_name: 'Juan Pérez' }
      })
    )
    assert.equal(fromName.ok, true)
    assert.equal(state.child.full_name, 'Juan Pérez')
    assert.equal(state.child.first_names, 'Juan')
    assert.equal(state.child.last_name, 'Pérez')
    assert.equal(state.child.maternal_last_name, null)
  } finally {
    restoreKnex()
  }
})

test('actualizar_proveedor with only last_name recomposes full_name', async () => {
  const state = {
    existing: {
      id: EXISTING_ID,
      supplier_type: 'persona_natural',
      country_code: 'CL',
      email: 'ana@x.cl'
    },
    child: {
      full_name: 'Juan Pérez',
      first_names: 'Juan',
      last_name: 'Pérez',
      maternal_last_name: null,
      document_type_code: 'RUT',
      document_number: '12345678-5'
    }
  }
  try {
    const server = await register(state)
    const updateTool = server.getTool('actualizar_proveedor')
    const result = parseToolJson(
      await updateTool.handler({
        id: EXISTING_ID,
        payload: { last_name: 'Soto' }
      })
    )
    assert.equal(result.ok, true)
    assert.equal(state.child.last_name, 'Soto')
    assert.equal(state.child.full_name, 'Juan Soto')
  } finally {
    restoreKnex()
  }
})

test('incomplete MCP name parts return the service error and do not insert', async () => {
  const state = {}
  try {
    const server = await register(state)
    const createTool = server.getTool('crear_proveedor')
    const result = parseToolJson(
      await createTool.handler({
        payload: {
          ...personaBase,
          first_names: 'Ana'
        }
      })
    )
    assert.equal(result.ok, false)
    assert.equal(result.message, 'El apellido paterno es obligatorio.')
    assert.equal(state.inserts, undefined)
  } finally {
    restoreKnex()
  }
})
})
