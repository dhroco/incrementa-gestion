const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-clausula-8-1.json')
const migration = require('../migrations/202611090001_template_clausula_8_1')
const { rewriteClausula81, hashWithoutClause } = require('../utils/templateClausula81')

const NOTE = 'plantillas-clausula-8-1'

function fakeKnex({ templates, backups = [] }) {
  const state = { templates: templates.map((r) => ({ ...r })), backups: backups.map((r) => ({ ...r })), calls: [] }
  const knex = (table) => {
    if (table === 'template') {
      return {
        select: async () => state.templates.map((r) => ({ id: r.id, code: r.code, content_json: structuredClone(r.content_json) })),
        where({ id }) {
          return {
            update: async (patch) => {
              state.calls.push(['update', id])
              Object.assign(state.templates.find((t) => t.id === id), patch)
            }
          }
        }
      }
    }
    return {
      insert: async (row) => {
        state.calls.push(['backup', row.template_id])
        state.backups.push({ ...row })
      },
      where({ note }) {
        return {
          select: async () => state.backups.filter((b) => b.note === note).map((b) => ({ ...b })),
          del: async () => {
            state.backups = state.backups.filter((b) => b.note !== note)
          }
        }
      }
    }
  }
  return { knex, state }
}

const CODES = Object.keys(fixtures)
const rows = (prefix = 'id') => CODES.map((code) => ({ id: `${prefix}-${code}`, code, content_json: structuredClone(fixtures[code]) }))
const silent = async (fn) => {
  const original = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = original
  }
}

test('up corrige solo las plantillas con la 8.1 original (a y b) y respalda antes de modificar', async () => {
  const { knex, state } = fakeKnex({ templates: rows() })
  await silent(() => migration.up(knex))
  const changed = state.calls.filter((c) => c[0] === 'update').map((c) => c[1].replace('id-', '')).sort()
  assert.deepEqual(changed, ['CONTRATO_0001', 'CONTRATO_0003', 'CONTRATO_0013'])
  assert.equal(state.backups.length, 3)
  for (const code of changed) {
    const row = state.templates.find((t) => t.code === code)
    assert.deepEqual(row.content_json, rewriteClausula81(fixtures[code]).content)
    assert.equal(hashWithoutClause(row.content_json), hashWithoutClause(fixtures[code]))
    assert.deepEqual(state.backups.find((b) => b.template_id === row.id).content_json, fixtures[code])
    assert.equal(state.backups.find((b) => b.template_id === row.id).note, NOTE)
  }
  for (const code of ['CONTRATO_0016', 'PL0001']) {
    assert.deepEqual(state.templates.find((t) => t.code === code).content_json, fixtures[code])
  }
  state.calls.forEach((c, i) => c[0] === 'update' && assert.equal(state.calls[i - 1][0], 'backup'))
})

test('funciona con ids distintos y es idempotente', async () => {
  const a = fakeKnex({ templates: rows('pre') })
  const b = fakeKnex({ templates: rows('prod') })
  await silent(() => migration.up(a.knex))
  await silent(() => migration.up(b.knex))
  assert.deepEqual(a.state.templates.map((t) => t.content_json), b.state.templates.map((t) => t.content_json))
  a.state.calls.length = 0
  await silent(() => migration.up(a.knex))
  assert.equal(a.state.calls.length, 0)
})

test('informa las plantillas excluidas sin fallar ni modificarlas', async () => {
  const lines = []
  const original = console.log
  console.log = (line) => lines.push(String(line))
  const { knex } = fakeKnex({ templates: rows() })
  try {
    await migration.up(knex)
  } finally {
    console.log = original
  }
  assert.ok(lines.some((l) => /corregidas: 3; excluidas \(no se tocan\): 2/.test(l)))
  assert.ok(lines.some((l) => /CONTRATO_0016/.test(l)))
  assert.ok(lines.some((l) => /PL0001/.test(l)))
})

test('sin plantillas no hace nada', async () => {
  const { knex, state } = fakeKnex({ templates: [] })
  await silent(() => migration.up(knex))
  assert.equal(state.calls.length, 0)
})

test('down restaura el contenido anterior y borra solo sus respaldos', async () => {
  const other = { id: 'o', template_id: 'id-CONTRATO_0001', content_json: { x: 1 }, note: 'otra' }
  const { knex, state } = fakeKnex({ templates: rows(), backups: [other] })
  await silent(() => migration.up(knex))
  await migration.down(knex)
  for (const code of CODES) assert.deepEqual(state.templates.find((t) => t.code === code).content_json, fixtures[code])
  assert.deepEqual(state.backups, [other])
})
