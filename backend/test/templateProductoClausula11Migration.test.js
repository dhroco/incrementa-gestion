const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-clausula-1-1.json')
const migration = require('../migrations/202610260002_template_producto_clausula_1_1')
const { rewriteProductoClause11, TEMPLATE_CODES } = require('../utils/templateProductoVariable')

const NOTE = 'plantillas-producto-clausula-1-1'

function fakeKnex({ templates, backups = [] }) {
  const state = { templates: templates.map((r) => ({ ...r })), backups: backups.map((r) => ({ ...r })), calls: [] }
  const knex = (table) => {
    if (table === 'template') {
      return {
        select() {
          return { whereIn: async (_c, codes) => state.templates.filter((r) => codes.includes(r.code)).map((r) => ({ ...r })) }
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

const rows = (prefix = 'id') => TEMPLATE_CODES.map((code) => ({ id: `${prefix}-${code}`, code, content_json: structuredClone(fixtures[code]) }))

test('up reescribe las 17 plantillas por código y respalda antes de modificar', async () => {
  const { knex, state } = fakeKnex({ templates: rows() })
  await migration.up(knex)
  assert.equal(state.backups.length, 17)
  for (const code of TEMPLATE_CODES) {
    const row = state.templates.find((t) => t.code === code)
    assert.deepEqual(row.content_json, rewriteProductoClause11(fixtures[code], code).content)
    assert.deepEqual(state.backups.find((b) => b.template_id === row.id).content_json, fixtures[code])
  }
  state.calls.forEach((c, i) => c[0] === 'update' && assert.equal(state.calls[i - 1][0], 'backup'))
})

test('funciona con ids distintos, es idempotente y no toca plantillas ajenas', async () => {
  const a = fakeKnex({ templates: [...rows('pre'), { id: 'x', code: 'PL0001', content_json: { type: 'doc', content: [] } }] })
  const b = fakeKnex({ templates: rows('prod') })
  await migration.up(a.knex)
  await migration.up(b.knex)
  const only = (s) => s.templates.filter((t) => t.code.startsWith('CONTRATO_')).map((t) => t.content_json)
  assert.deepEqual(only(a.state), only(b.state))
  a.state.calls.length = 0
  await migration.up(a.knex)
  assert.equal(a.state.calls.length, 0)
})

test('si una plantilla no coincide, se detiene sin modificar ninguna', async () => {
  const templates = rows()
  const bad = templates.find((t) => t.code === 'CONTRATO_0017')
  bad.content_json.content[0].content = bad.content_json.content[0].content.map((n) => (n.text ? { ...n, text: n.text.replace('“Producto”', '“Servicio”') } : n))
  const { knex, state } = fakeKnex({ templates })
  await assert.rejects(() => migration.up(knex), /1\.1/)
  assert.equal(state.calls.length, 0)
  assert.equal(state.backups.length, 0)
})

test('si no hay ninguna de las plantillas, falla con un mensaje claro', async () => {
  const { knex } = fakeKnex({ templates: [{ id: 'x', code: 'PL0001', content_json: { type: 'doc', content: [] } }] })
  await assert.rejects(() => migration.up(knex), /No se encontró ninguna/)
})

test('down restaura el contenido anterior y borra solo sus respaldos', async () => {
  const other = { id: 'o', template_id: 'id-CONTRATO_0001', content_json: { x: 1 }, note: 'otra' }
  const { knex, state } = fakeKnex({ templates: rows(), backups: [other] })
  await migration.up(knex)
  await migration.down(knex)
  for (const code of TEMPLATE_CODES) assert.deepEqual(state.templates.find((t) => t.code === code).content_json, fixtures[code])
  assert.deepEqual(state.backups, [other])
})
