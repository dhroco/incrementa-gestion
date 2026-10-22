const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const migrationPath = require.resolve('../migrations/202610210001_supplier_name_parts')
const personNamePath = require.resolve('../utils/personName')

function loadMigration() {
  delete require.cache[migrationPath]
  return require('../migrations/202610210001_supplier_name_parts')
}

function matches(row, where) {
  if (!where) return true
  return Object.entries(where).every(([key, value]) => row[key] === value)
}

function fakeKnex({ persona = [], empresa = [], failBackup = false } = {}) {
  const tables = {
    supplier_persona_natural: persona.map((row) => ({ ...row })),
    supplier_empresa: empresa.map((row) => ({ ...row })),
    supplier_child_backup: []
  }
  const ops = []
  const schemaOps = []

  function knex(table) {
    const state = { where: null }
    const chain = {
      select() {
        return chain
      },
      where(criteria) {
        state.where = criteria
        return chain
      },
      insert(rows) {
        ops.push({ op: 'insert', table })
        if (table === 'supplier_child_backup' && failBackup) {
          return Promise.reject(new Error('backup failed'))
        }
        const list = Array.isArray(rows) ? rows : [rows]
        if (!tables[table]) tables[table] = []
        tables[table].push(...list.map((row) => ({ ...row })))
        return Promise.resolve()
      },
      update(payload) {
        ops.push({ op: 'update', table, payload: { ...payload } })
        const targets = (tables[table] || []).filter((row) => matches(row, state.where))
        for (const row of targets) Object.assign(row, payload)
        return Promise.resolve(targets.length)
      },
      then(resolve, reject) {
        const rows = (tables[table] || []).filter((row) => matches(row, state.where))
        return Promise.resolve(rows.map((row) => ({ ...row }))).then(resolve, reject)
      }
    }
    return chain
  }

  knex.schema = {
    alterTable(table, builderFn) {
      const builder = {
        text(column) {
          const spec = { op: 'add', table, column, nullable: false }
          schemaOps.push(spec)
          return {
            nullable() {
              spec.nullable = true
              return this
            }
          }
        },
        dropColumn(column) {
          schemaOps.push({ op: 'drop', table, column })
        }
      }
      builderFn(builder)
      return Promise.resolve()
    }
  }
  knex.ops = ops
  knex.schemaOps = schemaOps
  knex.tables = tables
  return knex
}

const personaOpen = {
  supplier_id: '11111111-1111-4111-8111-111111111111',
  full_name: 'María José Pérez Soto',
  first_names: null,
  last_name: null,
  maternal_last_name: null
}

const personaFilled = {
  supplier_id: '22222222-2222-4222-8222-222222222222',
  full_name: 'Ya Listo',
  first_names: 'Ya',
  last_name: 'Listo',
  maternal_last_name: null
}

const personaBlank = {
  supplier_id: '33333333-3333-4333-8333-333333333333',
  full_name: '   ',
  first_names: null,
  last_name: null,
  maternal_last_name: null
}

const empresaOpen = {
  supplier_id: '44444444-4444-4444-8444-444444444444',
  nombre_rep_legal: 'Ana de la Fuente Soto',
  rep_first_names: null,
  rep_last_name: null,
  rep_maternal_last_name: null
}

describe('supplier name parts migration', { concurrency: false }, () => {
test('migration exports up and down', () => {
  const { up, down } = loadMigration()
  assert.equal(typeof up, 'function')
  assert.equal(typeof down, 'function')
})

test('up backs up before fill and splits only rows with NULL parts', async () => {
  const knex = fakeKnex({
    persona: [personaOpen, personaFilled, personaBlank],
    empresa: [empresaOpen]
  })
  const { up } = loadMigration()
  await up(knex)

  const backupAt = knex.ops.findIndex((op) => op.op === 'insert' && op.table === 'supplier_child_backup')
  const updateAt = knex.ops.findIndex((op) => op.op === 'update')
  assert.ok(backupAt >= 0)
  assert.ok(updateAt > backupAt)

  const backups = knex.tables.supplier_child_backup
  assert.equal(backups.length, 2)
  assert.deepEqual(
    backups.map((row) => row.supplier_id).sort(),
    [personaOpen.supplier_id, empresaOpen.supplier_id].sort()
  )
  for (const backup of backups) {
    assert.equal(backup.note, 'supplier-name-parts')
    assert.ok(backup.child_kind === 'persona_natural' || backup.child_kind === 'empresa')
    assert.equal(backup.row_json.supplier_id, backup.supplier_id)
  }
  const personaBackup = backups.find((row) => row.child_kind === 'persona_natural')
  assert.equal(personaBackup.row_json.full_name, 'María José Pérez Soto')

  const filled = knex.tables.supplier_persona_natural.find(
    (row) => row.supplier_id === personaOpen.supplier_id
  )
  assert.equal(filled.full_name, 'María José Pérez Soto')
  assert.equal(filled.first_names, 'María José')
  assert.equal(filled.last_name, 'Pérez')
  assert.equal(filled.maternal_last_name, 'Soto')

  const skipped = knex.tables.supplier_persona_natural.find(
    (row) => row.supplier_id === personaFilled.supplier_id
  )
  assert.equal(skipped.first_names, 'Ya')
  assert.equal(skipped.last_name, 'Listo')
  assert.equal(
    knex.ops.filter((op) => op.op === 'update' && op.payload.full_name !== undefined).length,
    0
  )

  const empresa = knex.tables.supplier_empresa[0]
  assert.equal(empresa.nombre_rep_legal, 'Ana de la Fuente Soto')
  assert.equal(empresa.rep_first_names, 'Ana')
  assert.equal(empresa.rep_last_name, 'de la Fuente')
  assert.equal(empresa.rep_maternal_last_name, 'Soto')

  const added = knex.schemaOps.filter((op) => op.op === 'add')
  assert.equal(added.length, 6)
  assert.ok(added.every((op) => op.nullable === true))
})

test('backup failure writes no part columns', async () => {
  const knex = fakeKnex({ persona: [personaOpen], failBackup: true })
  const { up } = loadMigration()
  await assert.rejects(() => up(knex), /backup failed/)
  const row = knex.tables.supplier_persona_natural[0]
  assert.equal(row.first_names, null)
  assert.equal(row.last_name, null)
  assert.equal(row.maternal_last_name, null)
  assert.equal(knex.ops.some((op) => op.op === 'update'), false)
})

test('round-trip mismatch aborts and lists the supplier id', async () => {
  const real = require(personNamePath)
  const original = real.composeFullName
  real.composeFullName = () => 'no-coincide'
  const knex = fakeKnex({ persona: [{ ...personaOpen }] })
  try {
    delete require.cache[migrationPath]
    const { up } = require('../migrations/202610210001_supplier_name_parts')
    await assert.rejects(
      () => up(knex),
      (err) => err instanceof Error && err.message.includes(personaOpen.supplier_id)
    )
  } finally {
    real.composeFullName = original
    delete require.cache[migrationPath]
  }
  const row = knex.tables.supplier_persona_natural[0]
  assert.equal(row.first_names, null)
  assert.equal(row.last_name, null)
  assert.equal(row.maternal_last_name, null)
  assert.equal(knex.ops.some((op) => op.op === 'update'), false)
})

test('Down drops only the new columns', async () => {
  const knex = fakeKnex({
    persona: [personaOpen],
    empresa: [empresaOpen]
  })
  knex.tables.supplier_child_backup.push({
    supplier_id: personaOpen.supplier_id,
    child_kind: 'persona_natural',
    row_json: { ...personaOpen },
    note: 'supplier-name-parts'
  })
  const before = knex.tables.supplier_child_backup.length
  const { down } = loadMigration()
  await down(knex)

  const dropped = knex.schemaOps.filter((op) => op.op === 'drop').map((op) => `${op.table}.${op.column}`)
  assert.deepEqual(dropped.sort(), [
    'supplier_empresa.rep_first_names',
    'supplier_empresa.rep_last_name',
    'supplier_empresa.rep_maternal_last_name',
    'supplier_persona_natural.first_names',
    'supplier_persona_natural.last_name',
    'supplier_persona_natural.maternal_last_name'
  ].sort())
  assert.equal(knex.ops.some((op) => op.table === 'supplier_child_backup'), false)
  assert.equal(knex.tables.supplier_child_backup.length, before)
})
})
