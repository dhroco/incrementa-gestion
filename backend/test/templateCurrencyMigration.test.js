const test = require('node:test')
const assert = require('node:assert/strict')

const { up: upSchema } = require('../migrations/202609280001_template_currency_code')
const { rewriteMxPriceClause, up, down } = require('../migrations/202609280002_mx_price_clause_usd')
const { tipTapDocToPlainTextAsync } = require('../utils/tipTapPlainText')

const QUOTE_OPEN = '\u201C'
const QUOTE_CLOSE = '\u201D'

const PRICE_CONTENT = [
  { text: '3.1 ', type: 'text', marks: [{ type: 'bold' }] },
  { text: 'El precio de los Servicios que ', type: 'text' },
  {
    type: 'variable',
    attrs: {
      bold: false,
      group: 'empresa',
      label: 'Nombre Comercial',
      italic: false,
      underline: false,
      uppercase: false,
      variableId: 'company_nombre_comercial'
    }
  },
  {
    text: ' pagará al Influencer, corresponderá a una cantidad fija y única en moneda de curso legal en (Tipo de moneda País), de ',
    type: 'text'
  },
  {
    type: 'variable',
    attrs: {
      bold: false,
      group: 'contrato',
      label: 'Precio',
      italic: false,
      underline: false,
      uppercase: false,
      variableId: 'precio_numero'
    }
  },
  { text: ' ', type: 'text' },
  {
    type: 'variable',
    attrs: {
      bold: false,
      group: 'contrato',
      label: 'Precio en texto',
      italic: false,
      underline: false,
      uppercase: false,
      variableId: 'precio_texto'
    }
  },
  {
    text: ` líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el ${QUOTE_OPEN}Precio${QUOTE_CLOSE}.`,
    type: 'text'
  }
]

const OTHER_PARAGRAPH = {
  type: 'paragraph',
  content: [{ type: 'text', text: 'Párrafo que no cambia.' }]
}

function priceDocument() {
  return {
    type: 'doc',
    content: [
      OTHER_PARAGRAPH,
      { type: 'paragraph', content: PRICE_CONTENT.map((node) => ({ ...node })) }
    ]
  }
}

function priceParagraphOf(doc) {
  return doc.content.find(
    (node) =>
      node.type === 'paragraph' &&
      node.content.some((child) => child.type === 'variable' && child.attrs?.variableId === 'precio_numero')
  )
}

test('Clause nodes rewritten and input unchanged', () => {
  const doc = priceDocument()
  const before = structuredClone(doc)

  const result = rewriteMxPriceClause(doc)
  const paragraph = priceParagraphOf(result)

  assert.equal(
    paragraph.content[3].text,
    ' pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de '
  )
  assert.equal(paragraph.content[5].text, ' (')
  assert.equal(
    paragraph.content[7].text,
    ` dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el ${QUOTE_OPEN}Precio${QUOTE_CLOSE}.`
  )

  for (const index of [0, 1, 2, 4, 6]) {
    assert.deepEqual(paragraph.content[index], before.content[1].content[index])
  }
  assert.deepEqual(result.content[0], before.content[0])
  assert.deepEqual(doc, before)
})

test('Plain text is the US dollar clause', async () => {
  const result = rewriteMxPriceClause(priceDocument())
  const plain = await tipTapDocToPlainTextAsync({
    type: 'doc',
    content: [priceParagraphOf(result)]
  })
  const filled = plain
    .replaceAll('{{precio_numero}}', 'US$1,290')
    .replaceAll('{{precio_texto}}', 'mil doscientos noventa')

  assert.equal(
    filled,
    `3.1 El precio de los Servicios que {{company_nombre_comercial}} pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de US$1,290 (mil doscientos noventa dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el ${QUOTE_OPEN}Precio${QUOTE_CLOSE}.`
  )
})

test('Mismatch throws', () => {
  const rewritten = rewriteMxPriceClause(priceDocument())
  assert.throws(
    () => rewriteMxPriceClause(rewritten),
    (err) => err instanceof Error && /nodo 3/.test(err.message)
  )

  assert.throws(
    () =>
      rewriteMxPriceClause({
        type: 'doc',
        content: [OTHER_PARAGRAPH]
      }),
    (err) => err instanceof Error && /no hay ningún párrafo con la variable precio_numero/.test(err.message)
  )

  const duplicated = priceDocument()
  duplicated.content.push(structuredClone(duplicated.content[1]))
  assert.throws(
    () => rewriteMxPriceClause(duplicated),
    (err) => err instanceof Error && /hay 2 párrafos con la variable precio_numero/.test(err.message)
  )
})

function fakeKnex(rows) {
  const updates = []

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
      then(resolve, reject) {
        const result = state.table === 'template' ? rows : []
        return Promise.resolve(result).then(resolve, reject)
      }
    }
    return chain
  }

  knex.schema = {
    hasColumn: async () => true
  }
  knex.updates = updates
  return knex
}

function mexicanRows() {
  return [
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', content_json: priceDocument() },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', content_json: priceDocument() }
  ]
}

test('Mexican templates tagged USD', async () => {
  const knex = fakeKnex(mexicanRows())
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args.map(String).join(' '))
  }
  try {
    await up(knex)
  } finally {
    console.warn = originalWarn
  }

  const currencyUpdates = knex.updates.filter((entry) =>
    Object.prototype.hasOwnProperty.call(entry.payload, 'currency_code')
  )
  assert.equal(currencyUpdates.length, 1)
  assert.deepEqual(currencyUpdates[0].payload, { currency_code: 'USD' })
  assert.deepEqual(currencyUpdates[0].whereIn, ['code', ['CONTRATO_0016', 'CONTRATO_0017']])
  assert.equal(warnings.length, 0)
})

test('Migration warns when fewer than two Mexican templates', async () => {
  const knex = fakeKnex([])
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args.map(String).join(' '))
  }
  try {
    await up(knex)
  } finally {
    console.warn = originalWarn
  }

  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /CONTRATO_0016/)
  assert.match(warnings[0], /CONTRATO_0017/)
  assert.match(warnings[0], /0 de 2/)
})

test('Extra price-paragraph node is rejected', () => {
  const doc = priceDocument()
  priceParagraphOf(doc).content.push({ type: 'text', text: ' de más' })
  assert.throws(
    () => rewriteMxPriceClause(doc),
    (err) => err instanceof Error && /tiene 9 nodos y se esperaban 8/.test(err.message)
  )
})

test('Clause number without bold is rejected', () => {
  const doc = priceDocument()
  priceParagraphOf(doc).content[0] = { type: 'text', text: '3.1 ' }
  assert.throws(
    () => rewriteMxPriceClause(doc),
    (err) => err instanceof Error && /El nodo 0 no calza/.test(err.message) && /negrita/.test(err.message)
  )
})

test('Swapped price variable ids are rejected', () => {
  const doc = priceDocument()
  const content = priceParagraphOf(doc).content
  content[4] = {
    ...content[4],
    attrs: { ...content[4].attrs, variableId: 'precio_texto' }
  }
  content[6] = {
    ...content[6],
    attrs: { ...content[6].attrs, variableId: 'precio_numero' }
  }
  assert.throws(
    () => rewriteMxPriceClause(doc),
    (err) => err instanceof Error && /El nodo 4 no calza/.test(err.message) && /precio_numero/.test(err.message)
  )
})

const BACKUP_NOTE = 'moneda-plantilla-usd: cláusula 3.1 en dólares'
const MX_CODES = ['CONTRATO_0016', 'CONTRATO_0017']

function recordingKnex({ templates, backups = [], hasCurrencyColumn }) {
  const updates = []
  const inserts = []
  const deletes = []
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
      insert(payload) {
        inserts.push({ table, payload })
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
        deletes.push({ table: state.table, where: state.where, whereIn: state.whereIn })
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
      schemaOps.push({ op: 'hasColumn', table, column, result: hasCurrencyColumn })
      return table === 'template' && column === 'currency_code' ? hasCurrencyColumn : false
    },
    async alterTable(table, build) {
      const { calls, column } = columnBuilder()
      build(column)
      schemaOps.push({ op: 'alterTable', table, calls })
    }
  }
  knex.raw = async (sql) => {
    raws.push(sql)
    return Promise.resolve()
  }
  knex.updates = updates
  knex.inserts = inserts
  knex.deletes = deletes
  knex.raws = raws
  knex.schemaOps = schemaOps
  return knex
}

function mxTemplates() {
  return [
    { id: 'id-16', code: 'CONTRATO_0016', content_json: priceDocument() },
    { id: 'id-17', code: 'CONTRATO_0017', content_json: priceDocument() },
    { id: 'id-cl', code: 'CONTRATO_0001', content_json: priceDocument() }
  ]
}

function contentUpdatesOf(knex) {
  return knex.updates.filter((entry) => Object.prototype.hasOwnProperty.call(entry.payload, 'content_json'))
}

function assertDollarClause(doc) {
  const paragraph = priceParagraphOf(doc)
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

test('up persists the rewritten price clause', async () => {
  const templates = mxTemplates()
  const originals = new Map(templates.map((row) => [row.id, structuredClone(row.content_json)]))
  const knex = recordingKnex({ templates, hasCurrencyColumn: true })

  await up(knex)

  const contentUpdates = contentUpdatesOf(knex)
  assert.equal(contentUpdates.length, 2)
  for (const update of contentUpdates) {
    assert.ok(MX_CODES.includes(templates.find((row) => row.id === update.where.id).code))
    assertDollarClause(update.payload.content_json)
    assert.notDeepEqual(update.payload.content_json, originals.get(update.where.id))
  }
})

test('backup stores the original content_json', async () => {
  const templates = mxTemplates()
  const originals = new Map(templates.map((row) => [row.id, structuredClone(row.content_json)]))
  const knex = recordingKnex({ templates, hasCurrencyColumn: true })

  await up(knex)

  const backupInserts = knex.inserts.filter((entry) => entry.table === 'template_content_backup')
  assert.equal(backupInserts.length, 2)
  for (const insert of backupInserts) {
    assert.equal(insert.payload.note, BACKUP_NOTE)
    assert.deepEqual(insert.payload.content_json, originals.get(insert.payload.template_id))
  }
})

test('up rewrites only CONTRATO_0016 and CONTRATO_0017', async () => {
  const knex = recordingKnex({ templates: mxTemplates(), hasCurrencyColumn: true })

  await up(knex)

  const ids = contentUpdatesOf(knex).map((entry) => entry.where.id).sort()
  assert.deepEqual(ids, ['id-16', 'id-17'])
  const backedUp = knex.inserts.map((entry) => entry.payload.template_id).sort()
  assert.deepEqual(backedUp, ['id-16', 'id-17'])
})

test('new currency column defaults to CLP and checks only CLP or USD', async () => {
  const knex = recordingKnex({ templates: mxTemplates(), hasCurrencyColumn: false })

  await upSchema(knex)

  const alter = knex.schemaOps.find((op) => op.op === 'alterTable')
  assert.equal(alter.table, 'template')
  assert.deepEqual(alter.calls, [
    { method: 'string', name: 'currency_code', length: 3 },
    { method: 'notNullable' },
    { method: 'defaultTo', value: 'CLP' }
  ])

  assert.equal(knex.raws.length, 1)
  const sql = String(knex.raws[0]).replace(/\s+/g, ' ').trim()
  assert.equal(
    sql,
    "ALTER TABLE template ADD CONSTRAINT template_currency_code_check CHECK (currency_code IN ('CLP', 'USD'))"
  )
})

test('down restores this change backups and deletes only that note', async () => {
  const original = priceDocument()
  const other = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'respaldo ajeno' }] }] }
  const knex = recordingKnex({
    templates: [],
    hasCurrencyColumn: true,
    backups: [
      { template_id: 'id-16', content_json: original, note: BACKUP_NOTE },
      {
        template_id: 'id-99',
        content_json: other,
        note: 'identificador-tributario-por-pais: cédula de identidad → RFC'
      }
    ]
  })

  await down(knex)

  const restored = contentUpdatesOf(knex)
  assert.equal(restored.length, 1)
  assert.deepEqual(restored[0].where, { id: 'id-16' })
  assert.deepEqual(restored[0].payload.content_json, original)

  assert.equal(knex.deletes.length, 1)
  assert.equal(knex.deletes[0].table, 'template_content_backup')
  assert.deepEqual(knex.deletes[0].where, { note: BACKUP_NOTE })
})

test('Migration warns when exactly one Mexican template exists', async () => {
  const knex = fakeKnex([{ id: 'id-16', content_json: priceDocument() }])
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args.map(String).join(' '))
  }
  try {
    await up(knex)
  } finally {
    console.warn = originalWarn
  }

  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /1 de 2/)
  assert.match(warnings[0], /CONTRATO_0016/)
  assert.match(warnings[0], /CONTRATO_0017/)
})
