/**
 * Reescritura de la cláusula 2.3 (servicios_entregables) y de la cláusula de la
 * cuenta (cuentas_publicacion) en las 21 plantillas. El content_json previo
 * queda en template_content_backup. No se toca ninguna otra columna.
 */

const BACKUP_NOTE = 'texto-dinamico-plantillas: 2.3 y cuenta con texto dinámico'
const LABEL_ENTREGABLES = 'Entregables (cláusula 2.3)'
const LABEL_CUENTAS = 'Cuentas de publicación (cláusula 2.5)'

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

const TEXT_AFTER_ENTREGABLES_A = ', en el o los perfiles del Influencer y en el perfil oficial '
const TEXT_AFTER_ENTREGABLES_MX =
  ', contenido que debe ser publicado tanto en el o los perfiles del Influencer, como en el de '
const ACCOUNT_LEAD_A = 'El Influencer deberá publicar el contenido a través de '
const ACCOUNT_LEAD_MX = 'El Influencer se obliga a publicar el contenido a través de '
const ACCOUNT_LEAD_PL = '2.6 El Influencer deberá publicar el contenido a través de '
const ACCOUNT_AFTER =
  '. Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de '

const PLANS_23 = {
  A: { start: 2, end: 8, sourceIndex: 2, variableId: 'servicios_entregables', label: LABEL_ENTREGABLES, texts: [TEXT_AFTER_ENTREGABLES_A] },
  A_colaboracion: {
    start: 2,
    end: 8,
    sourceIndex: 2,
    variableId: 'servicios_entregables',
    label: LABEL_ENTREGABLES,
    texts: [TEXT_AFTER_ENTREGABLES_A]
  },
  MX: {
    start: 2,
    end: 8,
    sourceIndex: 2,
    variableId: 'servicios_entregables',
    label: LABEL_ENTREGABLES,
    texts: [TEXT_AFTER_ENTREGABLES_MX]
  },
  PL: {
    start: 1,
    end: 5,
    sourceIndex: 1,
    variableId: 'servicios_entregables',
    label: LABEL_ENTREGABLES,
    texts: [TEXT_AFTER_ENTREGABLES_A]
  }
}

const PLANS_ACCOUNT = {
  A: {
    start: 1,
    end: 4,
    sourceIndex: 2,
    variableId: 'cuentas_publicacion',
    label: LABEL_CUENTAS,
    lead: ACCOUNT_LEAD_A,
    includeAfter: true
  },
  A_negrita: {
    start: 1,
    end: 4,
    sourceIndex: 2,
    variableId: 'cuentas_publicacion',
    label: LABEL_CUENTAS,
    lead: ACCOUNT_LEAD_A,
    includeAfter: true
  },
  MX: {
    start: 1,
    end: 3,
    sourceIndex: 2,
    variableId: 'cuentas_publicacion',
    label: LABEL_CUENTAS,
    lead: ACCOUNT_LEAD_MX,
    includeAfter: false
  },
  PL: {
    start: 0,
    end: 4,
    sourceIndex: 1,
    variableId: 'cuentas_publicacion',
    label: LABEL_CUENTAS,
    lead: ACCOUNT_LEAD_PL,
    includeAfter: false
  }
}

function textNode(text) {
  return { text, type: 'text' }
}

function dynamicVariable(source, variableId, label) {
  const attrs = source?.attrs ?? {}
  return {
    type: 'variable',
    attrs: {
      bold: attrs.bold,
      group: 'contrato',
      label,
      italic: attrs.italic,
      underline: attrs.underline,
      uppercase: attrs.uppercase,
      variableId
    }
  }
}

function textMarks(node) {
  return Object.prototype.hasOwnProperty.call(node, 'marks') ? node.marks : null
}

function nodesMatch(actual, expected) {
  if (!actual || typeof actual !== 'object' || !expected || actual.type !== expected.type) return false
  if (actual.type === 'text') {
    return actual.text === expected.text && JSON.stringify(textMarks(actual)) === JSON.stringify(textMarks(expected))
  }
  if (actual.type === 'variable') {
    return actual.attrs?.variableId === expected.attrs?.variableId
  }
  return false
}

function paragraphMatches(paragraph, expected) {
  const content = paragraph?.content
  const expectedContent = expected?.content
  if (paragraph?.type !== 'paragraph' || !Array.isArray(content) || !Array.isArray(expectedContent)) return false
  if (content.length !== expectedContent.length) return false
  for (let i = 0; i < content.length; i += 1) {
    if (!nodesMatch(content[i], expectedContent[i])) return false
  }
  return true
}

function describeNode(node) {
  if (!node || typeof node !== 'object') return 'un valor que no es un nodo'
  if (node.type === 'text') {
    const marks =
      Array.isArray(node.marks) && node.marks.length > 0
        ? ` con marcas ${JSON.stringify(node.marks)}`
        : ' sin marcas'
    return `texto ${JSON.stringify(node.text)}${marks}`
  }
  if (node.type === 'variable') {
    return `variable ${JSON.stringify(node.attrs?.variableId ?? null)}`
  }
  return `nodo de tipo ${JSON.stringify(node.type)}`
}

function describeMismatch(paragraph, expected) {
  const content = Array.isArray(paragraph?.content) ? paragraph.content : []
  const expectedContent = expected.content
  const limit = Math.min(content.length, expectedContent.length)
  for (let i = 0; i < limit; i += 1) {
    if (!nodesMatch(content[i], expectedContent[i])) {
      return `el nodo ${i} no calza: se esperaba ${describeNode(expectedContent[i])} y se encontró ${describeNode(content[i])}`
    }
  }
  const count = Array.isArray(paragraph?.content) ? paragraph.content.length : 'un contenido inválido'
  return `tiene ${count} nodos y se esperaban ${expectedContent.length}`
}

function prefixLength(paragraph, expected) {
  const content = Array.isArray(paragraph?.content) ? paragraph.content : []
  const expectedContent = expected.content
  let i = 0
  while (i < content.length && i < expectedContent.length && nodesMatch(content[i], expectedContent[i])) i += 1
  return i
}

function collectParagraphs(node, found = []) {
  if (!node || typeof node !== 'object') return found
  if (node.type === 'paragraph') found.push(node)
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectParagraphs(child, found)
  }
  return found
}

function takeParagraph(doc, expected, code, clauseLabel) {
  const paragraphs = collectParagraphs(doc)
  const matches = paragraphs.filter((paragraph) => paragraphMatches(paragraph, expected))
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    throw new Error(
      `${code}: la cláusula ${clauseLabel} no calza: hay ${matches.length} párrafos que coinciden y se esperaba uno.`
    )
  }

  let best = null
  let bestScore = 0
  for (const paragraph of paragraphs) {
    const score = prefixLength(paragraph, expected)
    if (score > bestScore) {
      best = paragraph
      bestScore = score
    }
  }

  if (!best || bestScore === 0) {
    throw new Error(`${code}: la cláusula ${clauseLabel} no calza: ningún párrafo coincide con el esperado.`)
  }

  throw new Error(`${code}: la cláusula ${clauseLabel} no calza: ${describeMismatch(best, expected)}.`)
}

function spliceParagraph(paragraph, plan) {
  const content = paragraph.content
  const built = []
  if (plan.lead) built.push(textNode(plan.lead))
  built.push(dynamicVariable(content[plan.sourceIndex], plan.variableId, plan.label))
  if (plan.includeAfter) built.push(textNode(ACCOUNT_AFTER))
  if (plan.texts) {
    for (const text of plan.texts) built.push(textNode(text))
  }

  const next = structuredClone(paragraph)
  next.content = [
    ...content.slice(0, plan.start).map((node) => structuredClone(node)),
    ...built,
    ...content.slice(plan.end).map((node) => structuredClone(node))
  ]
  return next
}

function replaceNode(node, target, replacement) {
  if (node === target) return replacement
  if (!node || typeof node !== 'object' || !Array.isArray(node.content)) return node
  let changed = false
  const content = node.content.map((child) => {
    const next = replaceNode(child, target, replacement)
    if (next !== child) changed = true
    return next
  })
  if (!changed) return node
  return { ...node, content }
}

function rewriteDynamicTextClauses(contentJson, code) {
  const variant = CODE_VARIANTS[code]
  if (!variant) {
    throw new Error(`El código ${code} no está en la tabla de plantillas de texto dinámico.`)
  }

  const draft = structuredClone(contentJson)
  const clause23 = takeParagraph(draft, CLAUSE_23_PARAGRAPHS[variant.clause23], code, '2.3')
  const rewritten23 = spliceParagraph(clause23, PLANS_23[variant.clause23])
  let result = replaceNode(draft, clause23, rewritten23)

  if (variant.account) {
    const accountParagraph = takeParagraph(result, ACCOUNT_PARAGRAPHS[variant.account], code, 'de la cuenta')
    const rewrittenAccount = spliceParagraph(accountParagraph, PLANS_ACCOUNT[variant.account])
    result = replaceNode(result, accountParagraph, rewrittenAccount)
  }

  return result
}

async function up(knex) {
  const rows = await knex('template').select('id', 'code', 'content_json').whereIn('code', TEMPLATE_CODES)
  const found = new Set(rows.map((row) => row.code))
  const missing = TEMPLATE_CODES.filter((code) => !found.has(code))
  if (missing.length > 0) {
    throw new Error(
      `Faltan las plantillas ${missing.join(', ')} para reescribir la cláusula 2.3 y la cuenta.`
    )
  }

  const pending = rows.map((row) => ({
    id: row.id,
    previous: row.content_json,
    next: rewriteDynamicTextClauses(row.content_json, row.code)
  }))

  for (const template of pending) {
    await knex('template_content_backup').insert({
      template_id: template.id,
      content_json: template.previous,
      note: BACKUP_NOTE
    })
    await knex('template').where({ id: template.id }).update({ content_json: template.next })
  }
}

async function down(knex) {
  const backups = await knex('template_content_backup').where({ note: BACKUP_NOTE }).select('*')
  for (const backup of backups) {
    await knex('template').where({ id: backup.template_id }).update({ content_json: backup.content_json })
  }
  await knex('template_content_backup').where({ note: BACKUP_NOTE }).del()
}

module.exports = {
  up,
  down,
  rewriteDynamicTextClauses
}
