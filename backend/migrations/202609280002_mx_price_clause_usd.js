/**
 * CONTRATO_0016 / CONTRATO_0017 en dólares y cláusula 3.1 reescrita.
 * Se corre después del deploy, cuando template.currency_code ya existe.
 */

const MX_CODES = ['CONTRATO_0016', 'CONTRATO_0017']
const BACKUP_NOTE = 'moneda-plantilla-usd: cláusula 3.1 en dólares'
const QUOTE_OPEN = '\u201C'
const QUOTE_CLOSE = '\u201D'

const OLD_NODE_3 =
  ' pagará al Influencer, corresponderá a una cantidad fija y única en moneda de curso legal en (Tipo de moneda País), de '
const NEW_NODE_3 =
  ' pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de '
const OLD_NODE_5 = ' '
const NEW_NODE_5 = ' ('
const OLD_NODE_7 =
  ` líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el ${QUOTE_OPEN}Precio${QUOTE_CLOSE}.`
const NEW_NODE_7 =
  ` dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el ${QUOTE_OPEN}Precio${QUOTE_CLOSE}.`

const EXPECTED_NODES = [
  { kind: 'boldText', text: '3.1 ' },
  { kind: 'text', text: 'El precio de los Servicios que ' },
  { kind: 'variable', variableId: 'company_nombre_comercial' },
  { kind: 'text', text: OLD_NODE_3 },
  { kind: 'variable', variableId: 'precio_numero' },
  { kind: 'text', text: OLD_NODE_5 },
  { kind: 'variable', variableId: 'precio_texto' },
  { kind: 'text', text: OLD_NODE_7 }
]

const TEXT_REPLACEMENTS = {
  3: NEW_NODE_3,
  5: NEW_NODE_5,
  7: NEW_NODE_7
}

function hasBoldMark(node) {
  return Array.isArray(node?.marks) && node.marks.some((mark) => mark?.type === 'bold')
}

function describeExpected(spec) {
  if (spec.kind === 'boldText') return `texto en negrita ${JSON.stringify(spec.text)}`
  if (spec.kind === 'text') return `texto ${JSON.stringify(spec.text)}`
  return `variable ${JSON.stringify(spec.variableId)}`
}

function describeNode(node) {
  if (!node || typeof node !== 'object') return 'un valor que no es un nodo'
  if (node.type === 'text') {
    const bold = hasBoldMark(node) ? ' en negrita' : ''
    return `texto${bold} ${JSON.stringify(node.text)}`
  }
  if (node.type === 'variable') {
    return `variable ${JSON.stringify(node.attrs?.variableId)}`
  }
  return `nodo de tipo ${JSON.stringify(node.type)}`
}

function nodeMatches(node, spec) {
  if (spec.kind === 'boldText') {
    return node?.type === 'text' && node.text === spec.text && hasBoldMark(node)
  }
  if (spec.kind === 'text') {
    return node?.type === 'text' && node.text === spec.text
  }
  return node?.type === 'variable' && node.attrs?.variableId === spec.variableId
}

function containsVariable(node, variableId) {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'variable' && node.attrs?.variableId === variableId) return true
  if (!Array.isArray(node.content)) return false
  return node.content.some((child) => containsVariable(child, variableId))
}

function collectParagraphs(node, found = []) {
  if (!node || typeof node !== 'object') return found
  if (node.type === 'paragraph') found.push(node)
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectParagraphs(child, found)
  }
  return found
}

function rewriteParagraph(paragraph) {
  const content = paragraph.content
  if (!Array.isArray(content) || content.length !== EXPECTED_NODES.length) {
    const count = Array.isArray(content) ? content.length : 'un contenido inválido'
    throw new Error(
      `El párrafo con precio_numero no calza: tiene ${count} nodos y se esperaban ${EXPECTED_NODES.length}.`
    )
  }

  for (let i = 0; i < EXPECTED_NODES.length; i += 1) {
    if (!nodeMatches(content[i], EXPECTED_NODES[i])) {
      throw new Error(
        `El nodo ${i} no calza: se esperaba ${describeExpected(EXPECTED_NODES[i])} y se encontró ${describeNode(content[i])}.`
      )
    }
  }

  const nextContent = content.map((node, index) => {
    if (!Object.prototype.hasOwnProperty.call(TEXT_REPLACEMENTS, index)) return node
    return { ...node, text: TEXT_REPLACEMENTS[index] }
  })
  return { ...paragraph, content: nextContent }
}

function replaceParagraph(node, target, replacement) {
  if (node === target) return replacement
  if (!node || typeof node !== 'object' || !Array.isArray(node.content)) return node
  let changed = false
  const content = node.content.map((child) => {
    const next = replaceParagraph(child, target, replacement)
    if (next !== child) changed = true
    return next
  })
  if (!changed) return node
  return { ...node, content }
}

function rewriteMxPriceClause(contentJson) {
  if (!contentJson || typeof contentJson !== 'object') {
    throw new Error('El content_json no calza: no es un documento.')
  }

  const paragraphs = collectParagraphs(contentJson).filter((paragraph) =>
    containsVariable(paragraph, 'precio_numero')
  )

  if (paragraphs.length !== 1) {
    if (paragraphs.length === 0) {
      throw new Error('No calza: no hay ningún párrafo con la variable precio_numero.')
    }
    throw new Error(
      `No calza: hay ${paragraphs.length} párrafos con la variable precio_numero y se esperaba uno.`
    )
  }

  const rewritten = rewriteParagraph(paragraphs[0])
  return replaceParagraph(contentJson, paragraphs[0], rewritten)
}

async function up(knex) {
  const mxTemplates = await knex('template').select('id', 'content_json').whereIn('code', MX_CODES)
  if (mxTemplates.length < MX_CODES.length) {
    console.warn(
      `moneda-plantilla-usd: se encontraron ${mxTemplates.length} de ${MX_CODES.length} plantillas (${MX_CODES.join(', ')}). Las que no existen no se marcan en USD ni se reescriben.`
    )
  }
  const rewritten = mxTemplates.map((template) => ({
    id: template.id,
    content_json: template.content_json,
    next: rewriteMxPriceClause(template.content_json)
  }))

  await knex('template').whereIn('code', MX_CODES).update({ currency_code: 'USD' })

  for (const template of rewritten) {
    await knex('template_content_backup').insert({
      template_id: template.id,
      content_json: template.content_json,
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
  await knex('template').whereIn('code', MX_CODES).update({ currency_code: 'CLP' })
}

module.exports = {
  up,
  down,
  rewriteMxPriceClause
}
