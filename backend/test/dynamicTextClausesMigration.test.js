const test = require('node:test')
const assert = require('node:assert/strict')

const { rewriteDynamicTextClauses } = require('../migrations/202609290001_dynamic_text_clauses')

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

const OTHER_PARAGRAPH = {
  type: 'paragraph',
  attrs: { textAlign: 'left' },
  content: [{ type: 'text', text: 'Párrafo que no se reescribe.' }]
}

const REPORT_25 = {
  type: 'paragraph',
  attrs: { textAlign: 'justify' },
  content: [
    { text: '2.5 ', type: 'text', marks: [{ type: 'bold' }] },
    { text: 'El Influencer deberá entregar un reporte de resultados.', type: 'text' }
  ]
}

function plainText(paragraph) {
  return paragraph.content
    .map((node) => {
      if (node.type === 'text') return node.text
      if (node.type === 'variable') return `{{${node.attrs.variableId}}}`
      return ''
    })
    .join('')
}

function findVariable(paragraph, variableId) {
  return paragraph.content.find((node) => node.type === 'variable' && node.attrs?.variableId === variableId)
}

function documentWith(...paragraphs) {
  return {
    type: 'doc',
    content: [...paragraphs.map((paragraph) => structuredClone(paragraph)), structuredClone(OTHER_PARAGRAPH)]
  }
}

function assertInputUnchanged(input, snapshot) {
  assert.deepEqual(input, snapshot)
}

function assertOtherParagraph(output, input) {
  assert.deepEqual(output.content[output.content.length - 1], input.content[input.content.length - 1])
}

test('variant A rewrites clause 2.3 and keeps the bold commercial name', () => {
  const input = documentWith(CLAUSE_23_PARAGRAPHS.A, ACCOUNT_PARAGRAPHS.A_negrita)
  const reels = findVariable(input.content[0], 'cantidad_reels')
  reels.attrs.bold = true
  reels.attrs.italic = true
  reels.attrs.underline = true
  reels.attrs.uppercase = true
  const companyBefore = structuredClone(findVariable(input.content[1], 'company_nombre_comercial'))
  const campaignBefore = structuredClone(findVariable(input.content[0], 'client_product_campaign'))
  const snapshot = structuredClone(input)

  const output = rewriteDynamicTextClauses(input, 'CONTRATO_0001')

  assertInputUnchanged(input, snapshot)
  assert.equal(
    plainText(output.content[0]),
    '2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, en el o los perfiles del Influencer y en el perfil oficial {{client_product_campaign}}.'
  )
  const entregables = findVariable(output.content[0], 'servicios_entregables')
  assert.equal(entregables.attrs.group, 'contrato')
  assert.equal(entregables.attrs.label, 'Entregables (cláusula 2.3)')
  assert.equal(entregables.attrs.bold, true)
  assert.equal(entregables.attrs.italic, true)
  assert.equal(entregables.attrs.underline, true)
  assert.equal(entregables.attrs.uppercase, true)
  assert.equal(Object.prototype.hasOwnProperty.call(entregables, 'marks'), false)
  assert.deepEqual(findVariable(output.content[0], 'client_product_campaign'), campaignBefore)
  assert.deepEqual(output.content[0].attrs, { textAlign: 'justify' })
  assert.equal(output.content[0].content[0].text, '2.3 ')
  assert.deepEqual(output.content[0].content[0].marks, [{ type: 'bold' }])
  assert.equal(
    plainText(output.content[1]),
    '2.5 El Influencer deberá publicar el contenido a través de {{cuentas_publicacion}}. Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de {{company_nombre_comercial}} para celebrar el presente Contrato.'
  )
  assert.deepEqual(findVariable(output.content[1], 'company_nombre_comercial'), companyBefore)
  assert.deepEqual(findVariable(output.content[1], 'company_nombre_comercial').marks, [{ type: 'bold' }])
  assertOtherParagraph(output, input)
})

test('collaboration template keeps the closing words', () => {
  const input = documentWith(CLAUSE_23_PARAGRAPHS.A_colaboracion, ACCOUNT_PARAGRAPHS.A_negrita)
  const snapshot = structuredClone(input)
  const output = rewriteDynamicTextClauses(input, 'CONTRATO_0008')
  assertInputUnchanged(input, snapshot)
  assert.match(plainText(output.content[0]), /\{\{client_product_campaign\}\} bajo la colaboración pagada\.$/)
  assertOtherParagraph(output, input)
})

test('Mexican clause 2.3 drops the hardcoded network and keeps the obligation verb', () => {
  const input = documentWith(CLAUSE_23_PARAGRAPHS.MX, ACCOUNT_PARAGRAPHS.MX)
  const snapshot = structuredClone(input)
  const output = rewriteDynamicTextClauses(input, 'CONTRATO_0016')
  assertInputUnchanged(input, snapshot)
  const clause = plainText(output.content[0])
  assert.equal(
    clause,
    '2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, contenido que debe ser publicado tanto en el o los perfiles del Influencer, como en el de {{client_brand}}, bajo la modalidad de \u201Ccolaboración pagada\u201D identificando la cuenta {{client_brand_account}}.'
  )
  assert.equal(clause.includes('Instagram'), false)
  assert.equal(clause.includes('cantidad_reels'), false)
  assert.equal(clause.includes('formato_reel'), false)
  assert.equal(clause.includes('proveedor_red_social'), false)
  assert.equal(clause.includes('\u201C'), true)
  assert.equal(clause.includes('\u201D'), true)
  const account = plainText(output.content[1])
  assert.match(account, /se obliga a publicar el contenido a través de \{\{cuentas_publicacion\}\}\./)
  assert.equal(account.includes('Instagram'), false)
  assert.equal(account.includes('proveedor_cuenta_social'), false)
  assertOtherParagraph(output, input)
})

test('PL clause 2.3 keeps the unbolded opening and the account clause is 2.6', () => {
  const input = documentWith(CLAUSE_23_PARAGRAPHS.PL, ACCOUNT_PARAGRAPHS.PL)
  const snapshot = structuredClone(input)
  const output = rewriteDynamicTextClauses(input, 'PL0001')
  assertInputUnchanged(input, snapshot)
  assert.equal(
    plainText(output.content[0]),
    '2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, en el o los perfiles del Influencer y en el perfil oficial {{client_brand_account}}.'
  )
  assert.equal(Object.prototype.hasOwnProperty.call(output.content[0].content[0], 'marks'), false)
  const account = plainText(output.content[1])
  assert.match(
    account,
    /^2\.6 El Influencer deberá publicar el contenido a través de \{\{cuentas_publicacion\}\}\. Esta condición es un elemento esencial/
  )
  assert.equal(JSON.stringify(output.content[1]).includes('proveedor_red_social'), false)
  assert.equal(JSON.stringify(output.content[1]).includes('proveedor_cuenta_social'), false)
  const cuentas = findVariable(output.content[1], 'cuentas_publicacion')
  assert.equal(cuentas.attrs.group, 'contrato')
  assert.equal(cuentas.attrs.label, 'Cuentas de publicación (cláusula 2.5)')
  assert.equal(Object.prototype.hasOwnProperty.call(cuentas, 'marks'), false)
  assertOtherParagraph(output, input)
})

test('account clause A uses publication accounts and leaves the commercial name unmarked', () => {
  const input = documentWith(CLAUSE_23_PARAGRAPHS.A, ACCOUNT_PARAGRAPHS.A)
  const cuenta = findVariable(input.content[1], 'proveedor_cuenta_social')
  cuenta.attrs.bold = true
  cuenta.attrs.italic = false
  cuenta.attrs.underline = true
  cuenta.attrs.uppercase = false
  const snapshot = structuredClone(input)
  const output = rewriteDynamicTextClauses(input, 'CONTRATO_0010')
  assertInputUnchanged(input, snapshot)
  assert.equal(
    plainText(output.content[1]),
    '2.5 El Influencer deberá publicar el contenido a través de {{cuentas_publicacion}}. Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de {{company_nombre_comercial}} para celebrar el presente Contrato.'
  )
  const cuentas = findVariable(output.content[1], 'cuentas_publicacion')
  assert.equal(cuentas.attrs.variableId, 'cuentas_publicacion')
  assert.equal(cuentas.attrs.group, 'contrato')
  assert.equal(cuentas.attrs.label, 'Cuentas de publicación (cláusula 2.5)')
  assert.equal(cuentas.attrs.bold, true)
  assert.equal(cuentas.attrs.italic, false)
  assert.equal(cuentas.attrs.underline, true)
  assert.equal(cuentas.attrs.uppercase, false)
  assert.equal(Object.prototype.hasOwnProperty.call(findVariable(output.content[1], 'company_nombre_comercial'), 'marks'), false)
  assertOtherParagraph(output, input)
})

test('CONTRATO_0017 rewrites only clause 2.3', () => {
  const input = documentWith(CLAUSE_23_PARAGRAPHS.MX, REPORT_25)
  const reportBefore = structuredClone(input.content[1])
  const snapshot = structuredClone(input)
  const output = rewriteDynamicTextClauses(input, 'CONTRATO_0017')
  assertInputUnchanged(input, snapshot)
  assert.match(plainText(output.content[0]), /\{\{servicios_entregables\}\}/)
  assert.equal(plainText(output.content[0]).includes('Instagram'), false)
  assert.deepEqual(output.content[1], reportBefore)
  assertOtherParagraph(output, input)
})

test('a rewritten document throws and leaves the input unchanged', () => {
  const input = documentWith(CLAUSE_23_PARAGRAPHS.A, ACCOUNT_PARAGRAPHS.A_negrita)
  const rewritten = rewriteDynamicTextClauses(input, 'CONTRATO_0001')
  const snapshot = structuredClone(rewritten)
  assert.throws(
    () => rewriteDynamicTextClauses(rewritten, 'CONTRATO_0001'),
    (err) => {
      assert.equal(err instanceof Error, true)
      assert.match(err.message, /CONTRATO_0001/)
      assert.match(err.message, /cantidad_reels/)
      assert.match(err.message, /servicios_entregables/)
      return true
    }
  )
  assert.deepEqual(rewritten, snapshot)
})

test('an unknown code throws', () => {
  const input = documentWith(CLAUSE_23_PARAGRAPHS.A, ACCOUNT_PARAGRAPHS.A_negrita)
  const snapshot = structuredClone(input)
  assert.throws(
    () => rewriteDynamicTextClauses(input, 'CONTRATO_9999'),
    (err) => {
      assert.equal(err instanceof Error, true)
      assert.match(err.message, /CONTRATO_9999/)
      return true
    }
  )
  assert.deepEqual(input, snapshot)
})
