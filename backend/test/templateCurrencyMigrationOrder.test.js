const test = require('node:test')
const assert = require('node:assert/strict')

const { up: upSchema, down: downSchema } = require('../migrations/202609280001_template_currency_code')
const { up: upData, down: downData } = require('../migrations/202609280002_mx_price_clause_usd')

const QUOTE_OPEN = '\u201C'
const QUOTE_CLOSE = '\u201D'
const BACKUP_NOTE = 'moneda-plantilla-usd: cláusula 3.1 en dólares'
const MX_CODES = ['CONTRATO_0016', 'CONTRATO_0017']

const PRICE_CONTENT = [
  { text: '3.1 ', type: 'text', marks: [{ type: 'bold' }] },
  { text: 'El precio de los Servicios que ', type: 'text' },
  { type: 'variable', attrs: { variableId: 'company_nombre_comercial' } },
  {
    text: ' pagará al Influencer, corresponderá a una cantidad fija y única en moneda de curso legal en (Tipo de moneda País), de ',
    type: 'text'
  },
  { type: 'variable', attrs: { variableId: 'precio_numero' } },
  { text: ' ', type: 'text' },
  { type: 'variable', attrs: { variableId: 'precio_texto' } },
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

function templates() {
  return [
    { id: 'id-16', code: 'CONTRATO_0016', content_json: priceDocument() },
    { id: 'id-17', code: 'CONTRATO_0017', content_json: priceDocument() },
    { id: 'id-cl', code: 'CONTRATO_0001', content_json: priceDocument() }
  ]
}

function sequenceKnex(initialTemplates) {
  const rows = initialTemplates.map((row) => ({
    ...row,
    content_json: structuredClone(row.content_json)
  }))
  const backups = []
  const schemaOps = []
  const raws = []
  let hasCurrencyColumn = false

  function matches(row, state) {
    if (state.where && !Object.entries(state.where).every(([key, value]) => row[key] === value)) {
      return false
    }
    if (state.whereIn) {
      const [column, values] = state.whereIn
      if (!values.includes(row[column])) return false
    }
    return true
  }

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
      insert(payload) {
        if (table === 'template_content_backup') backups.push({ ...payload })
        return Promise.resolve()
      },
      update(payload) {
        const target = table === 'template' ? rows : []
        for (const row of target) {
          if (!matches(row, state)) continue
          if (Object.prototype.hasOwnProperty.call(payload, 'content_json')) {
            row.content_json = structuredClone(payload.content_json)
          }
          if (Object.prototype.hasOwnProperty.call(payload, 'currency_code')) {
            row.currency_code = payload.currency_code
          }
        }
        return Promise.resolve(1)
      },
      del() {
        if (table === 'template_content_backup') {
          for (let i = backups.length - 1; i >= 0; i -= 1) {
            if (matches(backups[i], state)) backups.splice(i, 1)
          }
        }
        return Promise.resolve(1)
      },
      then(resolve, reject) {
        let result = []
        if (table === 'template') {
          result = rows.filter((row) => matches(row, state)).map((row) => ({
            ...row,
            content_json: structuredClone(row.content_json)
          }))
        } else if (table === 'template_content_backup') {
          result = backups.filter((row) => matches(row, state)).map((row) => ({
            ...row,
            content_json: structuredClone(row.content_json)
          }))
        }
        return Promise.resolve(result).then(resolve, reject)
      }
    }
    return chain
  }

  function columnBuilder() {
    const calls = []
    const column = {
      string(name, length) {
        calls.push({ method: 'string', name, length })
        return column
      },
      notNullable() {
        calls.push({ method: 'notNullable' })
        return column
      },
      defaultTo(value) {
        calls.push({ method: 'defaultTo', value })
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
      return table === 'template' && column === 'currency_code' ? hasCurrencyColumn : false
    },
    async alterTable(table, build) {
      const { calls, column } = columnBuilder()
      build(column)
      schemaOps.push({ op: 'alterTable', table, calls })
      const addsCurrency = calls.some((call) => call.method === 'string' && call.name === 'currency_code')
      const dropsCurrency = calls.some((call) => call.method === 'dropColumn' && call.name === 'currency_code')
      if (addsCurrency) {
        hasCurrencyColumn = true
        for (const row of rows) {
          if (row.currency_code == null) row.currency_code = 'CLP'
        }
      }
      if (dropsCurrency) {
        hasCurrencyColumn = false
        for (const row of rows) delete row.currency_code
      }
    }
  }
  knex.raw = async (sql) => {
    raws.push(String(sql))
  }
  knex.rows = rows
  knex.backups = backups
  knex.schemaOps = schemaOps
  knex.raws = raws
  knex.hasCurrencyColumn = () => hasCurrencyColumn
  return knex
}

function rowByCode(knex, code) {
  return knex.rows.find((row) => row.code === code)
}

function assertDollarClause(doc) {
  const paragraph = doc.content[0]
  assert.equal(
    paragraph.content[3].text,
    ' pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de '
  )
  assert.equal(paragraph.content[5].text, ' (')
  assert.equal(
    paragraph.content[7].text,
    ` dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el ${QUOTE_OPEN}Precio${QUOTE_CLOSE}.`
  )
}

test('A then B adds CLP column before marking Mexican templates USD', async () => {
  const originals = new Map(templates().map((row) => [row.id, structuredClone(row.content_json)]))
  const knex = sequenceKnex(templates())

  await upSchema(knex)

  assert.equal(knex.hasCurrencyColumn(), true)
  assert.deepEqual(knex.schemaOps[0].calls, [
    { method: 'string', name: 'currency_code', length: 3 },
    { method: 'notNullable' },
    { method: 'defaultTo', value: 'CLP' }
  ])
  assert.match(
    knex.raws.join(' ').replace(/\s+/g, ' '),
    /ADD CONSTRAINT template_currency_code_check CHECK \(currency_code IN \('CLP', 'USD'\)\)/
  )
  for (const row of knex.rows) {
    assert.equal(row.currency_code, 'CLP')
    assert.deepEqual(row.content_json, originals.get(row.id))
  }
  assert.equal(knex.backups.length, 0)

  await upData(knex)

  assert.equal(rowByCode(knex, 'CONTRATO_0016').currency_code, 'USD')
  assert.equal(rowByCode(knex, 'CONTRATO_0017').currency_code, 'USD')
  assert.equal(rowByCode(knex, 'CONTRATO_0001').currency_code, 'CLP')
  assertDollarClause(rowByCode(knex, 'CONTRATO_0016').content_json)
  assertDollarClause(rowByCode(knex, 'CONTRATO_0017').content_json)
  assert.deepEqual(rowByCode(knex, 'CONTRATO_0001').content_json, originals.get('id-cl'))
  assert.deepEqual(
    knex.backups.map((backup) => backup.template_id).sort(),
    ['id-16', 'id-17']
  )
  for (const backup of knex.backups) {
    assert.equal(backup.note, BACKUP_NOTE)
    assert.deepEqual(backup.content_json, originals.get(backup.template_id))
  }
})

test('Rollback runs B down and then A down', async () => {
  const originals = new Map(templates().map((row) => [row.id, structuredClone(row.content_json)]))
  const knex = sequenceKnex(templates())

  await upSchema(knex)
  await upData(knex)
  await downData(knex)

  assert.equal(knex.hasCurrencyColumn(), true)
  assert.equal(
    knex.schemaOps.some((op) => op.calls.some((call) => call.method === 'dropColumn')),
    false
  )
  assert.equal(
    knex.raws.some((sql) => /DROP CONSTRAINT/.test(sql)),
    false
  )
  assert.equal(knex.backups.length, 0)
  for (const code of MX_CODES) {
    const row = rowByCode(knex, code)
    assert.equal(row.currency_code, 'CLP')
    assert.deepEqual(row.content_json, originals.get(row.id))
  }
  assert.deepEqual(rowByCode(knex, 'CONTRATO_0001').content_json, originals.get('id-cl'))

  await downSchema(knex)

  assert.equal(knex.hasCurrencyColumn(), false)
  assert.match(
    knex.raws.join(' ').replace(/\s+/g, ' '),
    /DROP CONSTRAINT IF EXISTS template_currency_code_check/
  )
  const drop = knex.schemaOps.find((op) => op.calls.some((call) => call.method === 'dropColumn'))
  assert.deepEqual(drop.calls, [{ method: 'dropColumn', name: 'currency_code' }])
  for (const row of knex.rows) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'currency_code'), false)
  }
})
