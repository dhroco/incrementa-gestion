const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-pie-firma.json')
const migration = require('../migrations/202611130001_template_pie_firma_proveedor')
const { rewritePieFirma } = require('../utils/templatePieFirma')

const NOTE = 'plantillas-pie-firma'
const silent = async (fn) => {
  const original = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = original
  }
}

function fakeKnex({ templates, backups = [] }) {
  const state = { templates: templates.map((r) => ({ ...r })), backups: backups.map((r) => ({ ...r })), calls: [] }
  const knex = (table) => {
    if (table === 'template') {
      return {
        select() {
          return { whereIn: async (_c, codes) => state.templates.filter((r) => codes.includes(r.code)).map((r) => ({ id: r.id, code: r.code, content_json: structuredClone(r.content_json) })) }
        },
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

test('up corrige 0002 y 0007, deja la 0001 (ya editada) y México (0016) sin tocar, y respalda antes de modificar', async () => {
  const { knex, state } = fakeKnex({ templates: rows() })
  await silent(() => migration.up(knex))
  const changed = state.calls.filter((c) => c[0] === 'update').map((c) => c[1].replace('id-', '')).sort()
  assert.deepEqual(changed, ['CONTRATO_0002', 'CONTRATO_0007'])
  assert.equal(state.backups.length, 2)
  for (const code of changed) {
    const row = state.templates.find((t) => t.code === code)
    assert.deepEqual(row.content_json, rewritePieFirma(fixtures[code], code).content)
    assert.deepEqual(state.backups.find((b) => b.template_id === row.id).content_json, fixtures[code])
    assert.equal(state.backups.find((b) => b.template_id === row.id).note, NOTE)
  }
  for (const code of ['CONTRATO_0001', 'CONTRATO_0016']) {
    assert.deepEqual(state.templates.find((t) => t.code === code).content_json, fixtures[code], code)
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

test('informa las plantillas excluidas sin fallar y sin tocarlas', async () => {
  const broken = rows()
  const bad = broken.find((t) => t.code === 'CONTRATO_0007')
  bad.content_json.content.pop()
  const lines = []
  const original = console.log
  console.log = (line) => lines.push(String(line))
  const { knex, state } = fakeKnex({ templates: broken })
  try {
    await migration.up(knex)
  } finally {
    console.log = original
  }
  assert.ok(lines.some((l) => /corregidas: 1; excluidas \(no se tocan\): 1/.test(l)), lines.join(' | '))
  assert.ok(lines.some((l) => /CONTRATO_0007/.test(l)))
  assert.deepEqual(state.templates.find((t) => t.code === 'CONTRATO_0007').content_json, bad.content_json)
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
