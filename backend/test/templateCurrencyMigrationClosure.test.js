const test = require('node:test')
const assert = require('node:assert/strict')

const { down } = require('../migrations/202609280001_template_currency_code')
const { up } = require('../migrations/202609280002_mx_price_clause_usd')

const QUOTE_OPEN = '\u201C'
const QUOTE_CLOSE = '\u201D'

const PRICE_CONTENT = [
  { text: '3.1 ', type: 'text', marks: [{ type: 'bold' }] },
  { text: 'El precio de los Servicios que ', type: 'text' },
  {
    type: 'variable',
    attrs: { variableId: 'company_nombre_comercial' }
  },
  {
    text: ' pagará al Influencer, corresponderá a una cantidad fija y única en moneda de curso legal en (Tipo de moneda País), de ',
    type: 'text'
  },
  {
    type: 'variable',
    attrs: { variableId: 'precio_numero' }
  },
  { text: ' ', type: 'text' },
  {
    type: 'variable',
    attrs: { variableId: 'precio_texto' }
  },
  {
    text: ` líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el ${QUOTE_OPEN}Precio${QUOTE_CLOSE}.`,
    type: 'text'
  }
]

function priceDocument() {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: PRICE_CONTENT.map((node) => ({ ...node })) }]
  }
}

function mismatchedPriceDocument() {
  const doc = priceDocument()
  doc.content[0].content[3] = {
    ...doc.content[0].content[3],
    text: ' párrafo de precio que no calza '
  }
  return doc
}

function recordingKnex({ templates = [], backups = [], hasCurrencyColumn = true } = {}) {
  const updates = []
  const raws = []
  const schemaOps = []

  function knex(table) {
    const state = { table, whereIn: null, where: null }
    const chain = {
      select() {
        return chain
      },
      whereIn(column, values) {
        state.whereIn = [column, values]
        return chain
      },
      where(criteria) {
        state.where = criteria
        return chain
      },
      insert() {
        return Promise.resolve()
      },
      update(payload) {
        updates.push({
          table: state.table,
          whereIn: state.whereIn,
          where: state.where,
          payload
        })
        return Promise.resolve(1)
      },
      del() {
        return Promise.resolve(1)
      },
      then(resolve, reject) {
        let result = []
        if (state.table === 'template') {
          result = templates.filter((row) => {
            if (!state.whereIn) return true
            const [column, values] = state.whereIn
            return values.includes(row[column])
          })
        } else if (state.table === 'template_content_backup') {
          result = backups.filter((row) => {
            if (!state.where) return true
            return Object.entries(state.where).every(([key, value]) => row[key] === value)
          })
        }
        return Promise.resolve(result).then(resolve, reject)
      }
    }
    return chain
  }

  function columnBuilder() {
    const calls = []
    const column = {
      string() {
        return column
      },
      notNullable() {
        return column
      },
      defaultTo() {
        return column
      },
      dropColumn(name) {
        calls.push({ method: 'dropColumn', name })
        return column
      }
    }
    return { calls, column }
  }

  knex.schema = {
    async hasColumn(table, column) {
      schemaOps.push({ op: 'hasColumn', table, column })
      return table === 'template' && column === 'currency_code' ? hasCurrencyColumn : false
    },
    async alterTable(table, build) {
      const { calls, column } = columnBuilder()
      build(column)
      schemaOps.push({ op: 'alterTable', table, calls })
    }
  }
  knex.raw = async (sql) => {
    raws.push(String(sql))
  }
  knex.updates = updates
  knex.raws = raws
  knex.schemaOps = schemaOps
  return knex
}

function usdTargets(updates) {
  const targets = []
  for (const update of updates) {
    if (update.payload?.currency_code !== 'USD') continue
    if (update.where?.code) targets.push(update.where.code)
    if (update.where?.id) targets.push(update.where.id)
    if (Array.isArray(update.whereIn?.[1])) targets.push(...update.whereIn[1])
  }
  return targets
}

test('Mismatching Mexican price paragraph is not marked USD', async () => {
  const knex = recordingKnex({
    templates: [
      { id: 'id-16', code: 'CONTRATO_0016', content_json: priceDocument() },
      { id: 'id-17', code: 'CONTRATO_0017', content_json: mismatchedPriceDocument() }
    ]
  })

  await assert.rejects(
    () => up(knex),
    (err) => err instanceof Error && /no calza/.test(err.message)
  )

  const targets = usdTargets(knex.updates)
  assert.equal(targets.includes('CONTRATO_0017'), false)
  assert.equal(targets.includes('id-17'), false)
})

test('down drops currency_code and its check constraint', async () => {
  const knex = recordingKnex({ hasCurrencyColumn: true })

  await down(knex)

  const sql = knex.raws.map((entry) => entry.replace(/\s+/g, ' ').trim()).join('\n')
  assert.match(sql, /DROP CONSTRAINT IF EXISTS template_currency_code_check/)

  const alter = knex.schemaOps.find((op) => op.op === 'alterTable' && op.table === 'template')
  assert.ok(alter)
  assert.deepEqual(alter.calls, [{ method: 'dropColumn', name: 'currency_code' }])
})
