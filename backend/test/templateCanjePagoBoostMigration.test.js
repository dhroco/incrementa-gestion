const test = require('node:test')
const assert = require('node:assert/strict')

const fx = require('./fixtures/plantillas-canje-pago-boost.json')
const migration = require('../migrations/202611190001_template_canje_pago_boost')
const { addBoostToClause24, personeriaEscrituraPublica } = require('../utils/templateCanjePagoBoost')

const silent = async (fn) => {
  const original = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = original
  }
}

function fakeKnex({ templates, backups = [], drafts = [] }) {
  const state = { templates: templates.map((r) => structuredClone(r)), backups: [...backups], inserted: [], calls: [] }
  const knex = (table) => {
    if (table === 'template') {
      return {
        where(criteria) {
          const match = () => state.templates.find((t) => Object.entries(criteria).every(([k, v]) => t[k] === v))
          return {
            first: async () => (match() ? structuredClone(match()) : undefined),
            update: async (patch) => {
              state.calls.push(['update', match().code, Object.keys(patch).sort().join(',')])
              Object.assign(match(), patch)
            },
            del: async () => {
              state.calls.push(['delete', match().code])
              state.templates = state.templates.filter((t) => t !== match())
            }
          }
        },
        insert: async (row) => {
          state.calls.push(['insert', row.code])
          state.templates.push({ id: `new-${row.code}`, ...structuredClone(row) })
          state.inserted.push(row)
        }
      }
    }
    if (table === 'draft_document') {
      return { where: () => ({ first: async () => drafts[0] }) }
    }
    return {
      insert: async (row) => {
        state.calls.push(['backup', row.template_id])
        state.backups.push(structuredClone(row))
      },
      where: ({ note }) => ({
        select: async () => state.backups.filter((b) => b.note === note),
        del: async () => {
          state.backups = state.backups.filter((b) => b.note !== note)
        }
      })
    }
  }
  return { knex, state }
}

const row18 = (overrides = {}) => ({ id: 'id-18', code: 'CONTRATO_0018', content_json: structuredClone(fx.CONTRATO_0018), ...fx.meta_0018, ...overrides })

test('up agrega el boost a 0018 (con respaldo previo), la renombra y crea 0019', async () => {
  const { knex, state } = fakeKnex({ templates: [row18()] })
  await silent(() => migration.up(knex))
  const t18 = state.templates.find((t) => t.code === 'CONTRATO_0018')
  const t19 = state.templates.find((t) => t.code === 'CONTRATO_0019')
  const boosted = addBoostToClause24(fx.CONTRATO_0018).content
  assert.deepEqual(t18.content_json, boosted)
  assert.equal(t18.name, 'Contrato Empresa por un día con Canje más Pago con Boost')
  assert.deepEqual(t19.content_json, personeriaEscrituraPublica(boosted).content)
  assert.equal(t19.name, 'Contrato Empresa escritura pública con Canje más Pago con Boost')
  assert.equal(t19.supplier_type, 'empresa')
  assert.equal(t19.currency_code, 'CLP')
  assert.equal(t19.status, fx.meta_0018.status)
  assert.equal(t19.document_type_id, fx.meta_0018.document_type_id)
  assert.equal(state.backups.length, 1)
  assert.deepEqual(state.backups[0].content_json, fx.CONTRATO_0018)
  assert.equal(state.backups[0].note, 'plantillas-0018-0019')
  const firstUpdate = state.calls.findIndex((c) => c[0] === 'update')
  assert.equal(state.calls[firstUpdate - 1][0], 'backup')
})

test('up es idempotente y no pisa una 0019 editada', async () => {
  const { knex, state } = fakeKnex({ templates: [row18()] })
  await silent(() => migration.up(knex))
  const edited = state.templates.find((t) => t.code === 'CONTRATO_0019')
  edited.content_json.content.push({ type: 'paragraph' })
  const snapshot = structuredClone(edited.content_json)
  state.calls.length = 0
  await silent(() => migration.up(knex))
  assert.equal(state.calls.length, 0)
  assert.deepEqual(state.templates.find((t) => t.code === 'CONTRATO_0019').content_json, snapshot)
})

test('up aborta sin escribir si falta 0018 o su 2.4 no es la esperada', async () => {
  const none = fakeKnex({ templates: [] })
  await assert.rejects(() => silent(() => migration.up(none.knex)), /CONTRATO_0018 no existe/)
  const broken = row18()
  const i = broken.content_json.content.findIndex((p) => JSON.stringify(p).includes('2.4 '))
  broken.content_json.content[i].content.pop()
  const bad = fakeKnex({ templates: [broken] })
  await assert.rejects(() => silent(() => migration.up(bad.knex)), /cláusula 2\.4/)
  assert.equal(bad.state.calls.length, 0)
})

test('down restaura 0018 y borra 0019 si no tiene borradores', async () => {
  const { knex, state } = fakeKnex({ templates: [row18()] })
  await silent(() => migration.up(knex))
  await migration.down(knex)
  assert.deepEqual(state.templates.find((t) => t.code === 'CONTRATO_0018').content_json, fx.CONTRATO_0018)
  assert.equal(state.templates.find((t) => t.code === 'CONTRATO_0019'), undefined)
  assert.equal(state.backups.length, 0)
})

test('down no borra 0019 si ya tiene borradores', async () => {
  const { knex, state } = fakeKnex({ templates: [row18()], drafts: [{ id: 'd1' }] })
  await silent(() => migration.up(knex))
  await assert.rejects(() => migration.down(knex), /tiene borradores/)
  assert.ok(state.templates.find((t) => t.code === 'CONTRATO_0019'))
})
