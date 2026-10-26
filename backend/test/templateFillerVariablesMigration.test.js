const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-relleno.json')
const migration = require('../migrations/202610260001_template_filler_variables')
const { rewriteFillerVariables, TEMPLATE_CODES } = require('../utils/templateFillerVariables')

const NOTE = 'plantillas-variables-relleno'

function fakeKnex({ templates, backups = [] }) {
  const state = {
    templates: templates.map((row) => ({ ...row })),
    backups: backups.map((row) => ({ ...row })),
    calls: []
  }
  const knex = (table) => {
    if (table === 'template') {
      return {
        select() {
          return {
            whereIn: async (_column, codes) =>
              state.templates.filter((row) => codes.includes(row.code)).map((row) => ({ ...row }))
          }
        },
        where({ id }) {
          return {
            update: async (patch) => {
              state.calls.push(['update', id])
              const row = state.templates.find((t) => t.id === id)
              Object.assign(row, patch)
            }
          }
        }
      }
    }
    if (table === 'template_content_backup') {
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
    throw new Error(`Tabla inesperada: ${table}`)
  }
  return { knex, state }
}

function rowsFor(codes, idPrefix = 'id') {
  return codes.map((code) => ({ id: `${idPrefix}-${code}`, code, content_json: structuredClone(fixtures[code]) }))
}

test('up reescribe las 17 plantillas buscando por código y respalda el contenido anterior', async () => {
  const { knex, state } = fakeKnex({ templates: rowsFor(TEMPLATE_CODES) })
  await migration.up(knex)

  assert.equal(state.backups.length, 17)
  for (const code of TEMPLATE_CODES) {
    const row = state.templates.find((t) => t.code === code)
    assert.deepEqual(row.content_json, rewriteFillerVariables(fixtures[code], code).content)
    const backup = state.backups.find((b) => b.template_id === row.id)
    assert.equal(backup.note, NOTE)
    assert.deepEqual(backup.content_json, fixtures[code])
  }
  // Cada respaldo se inserta antes de modificar la plantilla.
  state.calls.forEach((call, index) => {
    if (call[0] === 'update') {
      assert.equal(state.calls[index - 1][0], 'backup')
      assert.equal(state.calls[index - 1][1], call[1])
    }
  })
})

test('funciona aunque los ids difieran entre ambientes y falten plantillas ajenas a la tabla', async () => {
  const pre = fakeKnex({ templates: [...rowsFor(TEMPLATE_CODES, 'preprod'), { id: 'x', code: 'PL0001', content_json: { type: 'doc', content: [] } }] })
  const prod = fakeKnex({ templates: rowsFor(TEMPLATE_CODES, 'prod') })
  await migration.up(pre.knex)
  await migration.up(prod.knex)
  const norm = (state) => state.templates.filter((t) => t.code.startsWith('CONTRATO_')).map((t) => t.content_json)
  assert.deepEqual(norm(pre.state), norm(prod.state))
  assert.deepEqual(pre.state.templates.find((t) => t.code === 'PL0001').content_json, { type: 'doc', content: [] })
})

test('es idempotente: una segunda ejecución no respalda ni modifica nada', async () => {
  const { knex, state } = fakeKnex({ templates: rowsFor(TEMPLATE_CODES) })
  await migration.up(knex)
  const afterFirst = structuredClone(state.templates)
  const backupsFirst = state.backups.length
  state.calls.length = 0

  await migration.up(knex)
  assert.equal(state.calls.length, 0)
  assert.equal(state.backups.length, backupsFirst)
  assert.deepEqual(state.templates, afterFirst)
})

test('si una plantilla no coincide con el texto esperado, se detiene sin modificar ninguna', async () => {
  const templates = rowsFor(TEMPLATE_CODES)
  const bad = templates.find((t) => t.code === 'CONTRATO_0017')
  const clause = bad.content_json.content.find((p) => p.content.some((n) => n.text?.includes('tendrá una vigencia de')))
  clause.content = clause.content.map((n) =>
    n.text ? { ...n, text: n.text.replace('(Cantidad en letras) (Cantidad en números)', '(Plazo)') } : n
  )
  const { knex, state } = fakeKnex({ templates })

  await assert.rejects(() => migration.up(knex), /vigencia_meses/)
  assert.equal(state.calls.length, 0)
  assert.equal(state.backups.length, 0)
})

test('si no existe ninguna de las plantillas, falla con un mensaje claro', async () => {
  const { knex } = fakeKnex({ templates: [{ id: 'x', code: 'PL0001', content_json: { type: 'doc', content: [] } }] })
  await assert.rejects(() => migration.up(knex), /No se encontró ninguna/)
})

test('solo respalda y modifica las plantillas que cambian', async () => {
  const done = rowsFor(['CONTRATO_0001']).map((row) => ({
    ...row,
    content_json: rewriteFillerVariables(row.content_json, row.code).content
  }))
  const { knex, state } = fakeKnex({ templates: [...done, ...rowsFor(['CONTRATO_0003'])] })
  await migration.up(knex)
  assert.equal(state.backups.length, 1)
  assert.equal(state.backups[0].template_id, 'id-CONTRATO_0003')
})

test('down restaura el contenido anterior y borra solo sus respaldos', async () => {
  const other = { id: 'b-other', template_id: 'id-CONTRATO_0001', content_json: { type: 'doc', content: ['otro'] }, note: 'otra-migracion' }
  const { knex, state } = fakeKnex({ templates: rowsFor(TEMPLATE_CODES), backups: [other] })
  await migration.up(knex)
  await migration.down(knex)

  for (const code of TEMPLATE_CODES) {
    assert.deepEqual(state.templates.find((t) => t.code === code).content_json, fixtures[code])
  }
  assert.deepEqual(state.backups, [other])
})
