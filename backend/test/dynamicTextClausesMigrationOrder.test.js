const test = require('node:test')
const assert = require('node:assert/strict')

const { up, down, rewriteDynamicTextClauses } = require('../migrations/202609290001_dynamic_text_clauses')

const BACKUP_NOTE = 'texto-dinamico-plantillas: 2.3 y cuenta con texto dinámico'

const CLAUSE_23_PARAGRAPHS = {
  "A": {
    "type": "paragraph",
    "attrs": {
      "textAlign": "justify"
    },
    "content": [
      {
        "text": "2.3 ",
        "type": "text",
        "marks": [
          {
            "type": "bold"
          }
        ]
      },
      {
        "text": "En concreto, los Servicios comprenden la generación y publicación de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "contrato",
          "label": "Cantidad de reels",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "cantidad_reels"
        }
      },
      {
        "text": " ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "contrato",
          "label": "Formato de reel",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "formato_reel"
        }
      },
      {
        "text": " en el perfil de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_red_social"
        }
      },
      {
        "text": " del Influencer y en el perfil oficial ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "client",
          "label": "Producto/Campaña",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "client_product_campaign"
        }
      },
      {
        "text": ".",
        "type": "text"
      }
    ]
  },
  "A_colaboracion": {
    "type": "paragraph",
    "attrs": {
      "textAlign": "justify"
    },
    "content": [
      {
        "text": "2.3 ",
        "type": "text",
        "marks": [
          {
            "type": "bold"
          }
        ]
      },
      {
        "text": "En concreto, los Servicios comprenden la generación y publicación de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "contrato",
          "label": "Cantidad de reels",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "cantidad_reels"
        }
      },
      {
        "text": " ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "contrato",
          "label": "Formato de reel",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "formato_reel"
        }
      },
      {
        "text": " en el perfil de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_red_social"
        }
      },
      {
        "text": " del Influencer y en el perfil oficial ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "client",
          "label": "Producto/Campaña",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "client_product_campaign"
        }
      },
      {
        "text": " bajo la colaboración pagada.",
        "type": "text"
      }
    ]
  },
  "MX": {
    "type": "paragraph",
    "attrs": {
      "textAlign": "justify"
    },
    "content": [
      {
        "text": "2.3 ",
        "type": "text",
        "marks": [
          {
            "type": "bold"
          }
        ]
      },
      {
        "text": "En concreto, los Servicios comprenden la generación y publicación de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "contrato",
          "label": "Cantidad de reels",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "cantidad_reels"
        }
      },
      {
        "text": " ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "contrato",
          "label": "Formato de reel",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "formato_reel"
        }
      },
      {
        "text": " en ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_red_social"
        }
      },
      {
        "text": ", que debe ser publicado tanto en el perfil de Instagram del Influencer, como en el de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "client",
          "label": "Marca",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "client_brand"
        }
      },
      {
        "text": ", bajo la modalidad de “colaboración pagada” identificando la cuenta ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "client",
          "label": "Cuenta marca",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "client_brand_account"
        }
      },
      {
        "text": ".",
        "type": "text"
      }
    ]
  },
  "PL": {
    "type": "paragraph",
    "attrs": {
      "textAlign": "justify"
    },
    "content": [
      {
        "text": "2.3 En concreto, los Servicios comprenden la generación y publicación de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "contrato",
          "label": "Cantidad de reels",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "cantidad_reels"
        }
      },
      {
        "text": " reel en el perfil de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_red_social"
        }
      },
      {
        "text": " del Influencer y en el perfil oficial ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "client",
          "label": "Cuenta marca",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "client_brand_account"
        }
      },
      {
        "text": ".",
        "type": "text"
      }
    ]
  }
}
const ACCOUNT_PARAGRAPHS = {
  "A_negrita": {
    "type": "paragraph",
    "attrs": {
      "textAlign": "justify"
    },
    "content": [
      {
        "text": "2.5 ",
        "type": "text",
        "marks": [
          {
            "type": "bold"
          }
        ]
      },
      {
        "text": "El Influencer deberá publicar el contenido en Instagram a través de su cuenta ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Cuenta Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_cuenta_social"
        }
      },
      {
        "text": " Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "empresa",
          "label": "Nombre Comercial",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "company_nombre_comercial"
        },
        "marks": [
          {
            "type": "bold"
          }
        ]
      },
      {
        "text": " para celebrar el presente Contrato.",
        "type": "text"
      }
    ]
  },
  "A": {
    "type": "paragraph",
    "attrs": {
      "textAlign": "justify"
    },
    "content": [
      {
        "text": "2.5 ",
        "type": "text",
        "marks": [
          {
            "type": "bold"
          }
        ]
      },
      {
        "text": "El Influencer deberá publicar el contenido en Instagram a través de su cuenta ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Cuenta Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_cuenta_social"
        }
      },
      {
        "text": " Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "empresa",
          "label": "Nombre Comercial",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "company_nombre_comercial"
        }
      },
      {
        "text": " para celebrar el presente Contrato.",
        "type": "text"
      }
    ]
  },
  "MX": {
    "type": "paragraph",
    "attrs": {
      "textAlign": "justify"
    },
    "content": [
      {
        "text": "2.5 ",
        "type": "text",
        "marks": [
          {
            "type": "bold"
          }
        ]
      },
      {
        "text": "El Influencer se obliga a publicar el contenido en Instagram a través de su cuenta ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Cuenta Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_cuenta_social"
        }
      },
      {
        "text": ". Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "empresa",
          "label": "Nombre Comercial",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "company_nombre_comercial"
        }
      },
      {
        "text": " para celebrar el presente Contrato.",
        "type": "text"
      }
    ]
  },
  "PL": {
    "type": "paragraph",
    "attrs": {
      "textAlign": "justify"
    },
    "content": [
      {
        "text": "2.6 El Influencer deberá publicar el contenido en ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_red_social"
        }
      },
      {
        "text": " a través de su cuenta  ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "proveedor",
          "label": "Cuenta Red Social",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "proveedor_cuenta_social"
        }
      },
      {
        "text": ". Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de ",
        "type": "text"
      },
      {
        "type": "variable",
        "attrs": {
          "bold": false,
          "group": "empresa",
          "label": "Nombre Comercial",
          "italic": false,
          "underline": false,
          "uppercase": false,
          "variableId": "company_nombre_comercial"
        }
      },
      {
        "text": " para celebrar el presente Contrato.",
        "type": "text"
      }
    ]
  }
}

const TEMPLATE_CODES = [
  'CONTRATO_0001',
  'CONTRATO_0002',
  'CONTRATO_0003',
  'CONTRATO_0004',
  'CONTRATO_0005',
  'CONTRATO_0006',
  'CONTRATO_0007',
  'CONTRATO_0008',
  'CONTRATO_0009',
  'CONTRATO_0010',
  'CONTRATO_0011',
  'CONTRATO_0012',
  'CONTRATO_0013',
  'CONTRATO_0014',
  'CONTRATO_0015',
  'CONTRATO_0016',
  'CONTRATO_0017',
  'PL0001',
  'PL0002',
  'PL0003',
  'PL0004'
]

const CODE_VARIANTS = {}

function assignVariants(codes, clause23, account) {
  for (const code of codes) CODE_VARIANTS[code] = { clause23, account }
}

assignVariants(
  [
    'CONTRATO_0001',
    'CONTRATO_0002',
    'CONTRATO_0003',
    'CONTRATO_0004',
    'CONTRATO_0005',
    'CONTRATO_0006',
    'CONTRATO_0007',
    'CONTRATO_0009'
  ],
  'A',
  'A_negrita'
)
assignVariants(['CONTRATO_0008'], 'A_colaboracion', 'A_negrita')
assignVariants(
  ['CONTRATO_0010', 'CONTRATO_0011', 'CONTRATO_0012', 'CONTRATO_0013', 'CONTRATO_0014', 'CONTRATO_0015'],
  'A',
  'A'
)
assignVariants(['CONTRATO_0016'], 'MX', 'MX')
assignVariants(['CONTRATO_0017'], 'MX', null)
assignVariants(['PL0001', 'PL0002', 'PL0003', 'PL0004'], 'PL', 'PL')

function contentFor(code) {
  const variant = CODE_VARIANTS[code]
  const content = [structuredClone(CLAUSE_23_PARAGRAPHS[variant.clause23])]
  if (variant.account) content.push(structuredClone(ACCOUNT_PARAGRAPHS[variant.account]))
  content.push({
    type: 'paragraph',
    content: [{ type: 'text', text: `extra ${code}` }]
  })
  return { type: 'doc', content }
}

function templates() {
  return TEMPLATE_CODES.map((code, index) => ({
    id: `id-${code}`,
    code,
    name: `Plantilla ${code}`,
    currency_code: 'USD',
    content_json: contentFor(code),
    sort: index
  }))
}

function sequenceKnex(initialTemplates) {
  const rows = initialTemplates.map((row) => ({
    ...row,
    content_json: structuredClone(row.content_json)
  }))
  const backups = []

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
        if (table === 'template_content_backup') {
          backups.push({
            ...payload,
            content_json: structuredClone(payload.content_json)
          })
        }
        return Promise.resolve()
      },
      update(payload) {
        if (table === 'template') {
          for (const row of rows) {
            if (!matches(row, state)) continue
            if (Object.prototype.hasOwnProperty.call(payload, 'content_json')) {
              row.content_json = structuredClone(payload.content_json)
            }
            for (const key of Object.keys(payload)) {
              if (key !== 'content_json') row[key] = payload[key]
            }
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

  knex.rows = rows
  knex.backups = backups
  return knex
}

test('up backs up the previous content and stores the rewrite only after all 21 match', async () => {
  const originals = new Map(templates().map((row) => [row.id, structuredClone(row)]))
  const knex = sequenceKnex(templates())
  knex.backups.push({
    template_id: 'other',
    content_json: { type: 'doc', content: [] },
    note: 'otra nota'
  })

  await up(knex)

  assert.equal(knex.backups.filter((backup) => backup.note === BACKUP_NOTE).length, 21)
  assert.equal(knex.backups.some((backup) => backup.note === 'otra nota'), true)
  for (const code of TEMPLATE_CODES) {
    const row = knex.rows.find((item) => item.code === code)
    const original = originals.get(row.id)
    const backup = knex.backups.find((item) => item.template_id === row.id && item.note === BACKUP_NOTE)
    assert.equal(backup.note, BACKUP_NOTE)
    assert.deepEqual(backup.content_json, original.content_json)
    assert.deepEqual(row.content_json, rewriteDynamicTextClauses(original.content_json, code))
    assert.equal(row.currency_code, 'USD')
    assert.equal(row.name, original.name)
  }
})

test('up throws the missing codes and does not insert or update', async () => {
  const present = templates().filter((row) => row.code !== 'CONTRATO_0008')
  const originals = new Map(present.map((row) => [row.id, structuredClone(row.content_json)]))
  const knex = sequenceKnex(present)

  await assert.rejects(() => up(knex), (err) => {
    assert.equal(err instanceof Error, true)
    assert.match(err.message, /CONTRATO_0008/)
    return true
  })

  assert.equal(knex.backups.length, 0)
  for (const row of knex.rows) {
    assert.deepEqual(row.content_json, originals.get(row.id))
    assert.equal(row.currency_code, 'USD')
  }
})

test('up does not write when a later rewrite fails', async () => {
  const initial = templates()
  initial[initial.length - 1].content_json = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ya reescrita' }] }]
  }
  const originals = new Map(initial.map((row) => [row.id, structuredClone(row.content_json)]))
  const knex = sequenceKnex(initial)

  await assert.rejects(() => up(knex), (err) => {
    assert.match(err.message, /PL0004/)
    return true
  })

  assert.equal(knex.backups.length, 0)
  for (const row of knex.rows) {
    assert.deepEqual(row.content_json, originals.get(row.id))
    assert.equal(row.currency_code, 'USD')
    assert.equal(row.name.startsWith('Plantilla '), true)
  }
})

test('down restores content_json from the note and deletes those rows only', async () => {
  const originals = new Map(templates().map((row) => [row.id, structuredClone(row)]))
  const knex = sequenceKnex(templates())
  knex.backups.push({
    template_id: 'other',
    content_json: { type: 'doc', content: [] },
    note: 'otra nota'
  })

  await up(knex)
  await down(knex)

  assert.deepEqual(
    knex.backups.map((backup) => backup.note),
    ['otra nota']
  )
  for (const code of TEMPLATE_CODES) {
    const row = knex.rows.find((item) => item.code === code)
    const original = originals.get(row.id)
    assert.deepEqual(row.content_json, original.content_json)
    assert.equal(row.currency_code, 'USD')
    assert.equal(row.name, original.name)
  }
})
