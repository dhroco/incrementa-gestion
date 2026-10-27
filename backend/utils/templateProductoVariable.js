/**
 * En la cláusula 1.1 de las plantillas CONTRATO_0001 a CONTRATO_0017, el término definido
 * «(en adelante el “Producto” y “{{client_brand}}” respectivamente)» lleva la variable del
 * producto (client_product_campaign) en lugar de la palabra «Producto». Función pura sobre el
 * `content_json`: reemplaza solo esa palabra, dentro de su nodo de texto; no toca nada más.
 * Es idempotente y lanza un error si la cláusula no tiene el texto esperado.
 */

const TEMPLATE_CODES = Array.from({ length: 17 }, (_, i) => `CONTRATO_${String(i + 1).padStart(4, '0')}`)

const TERM = /(?<=\(en adelante el “)Producto(?=” y “)/
const VARIABLE_ID = 'client_product_campaign'

const PRODUCT_VARIABLE = {
  type: 'variable',
  attrs: {
    bold: false,
    group: 'client',
    label: 'Producto/Campaña',
    italic: false,
    underline: false,
    uppercase: false,
    variableId: VARIABLE_ID
  }
}

function paragraphText(paragraph) {
  return paragraph.content
    .map((node) => (node.type === 'text' ? node.text ?? '' : node.type === 'variable' ? `{{${node.attrs?.variableId}}}` : ''))
    .join('')
}

/** Párrafo de la cláusula 1.1 que define «el Producto» (es el único que lo hace). */
function isClause11(node) {
  return (
    node &&
    node.type === 'paragraph' &&
    Array.isArray(node.content) &&
    paragraphText(node).startsWith('1.1 ') &&
    /\(en adelante el “(?:Producto|\{\{client_product_campaign\}\})” y “/.test(paragraphText(node))
  )
}

function rewriteParagraph(paragraph, code) {
  const hits = []
  paragraph.content.forEach((node, index) => {
    if (node.type !== 'text' || typeof node.text !== 'string') return
    const match = TERM.exec(node.text)
    if (match) hits.push({ index, match })
  })
  if (hits.length > 1) throw new Error(`${code}: la cláusula 1.1 tiene ${hits.length} apariciones de «Producto» en el término definido; se esperaba 1.`)
  if (hits.length === 0) {
    const already = /\(en adelante el “\{\{client_product_campaign\}\}” y “/.test(paragraphText(paragraph))
    if (already) return { paragraph, replaced: 0 }
    throw new Error(`${code}: la cláusula 1.1 no tiene el término definido «Producto» esperado.`)
  }
  const { index, match } = hits[0]
  const node = paragraph.content[index]
  const before = node.text.slice(0, match.index)
  const after = node.text.slice(match.index + match[0].length)
  const marks = node.marks ? { marks: structuredClone(node.marks) } : {}
  const replacement = [
    ...(before !== '' ? [{ type: 'text', text: before, ...marks }] : []),
    structuredClone(PRODUCT_VARIABLE),
    ...(after !== '' ? [{ type: 'text', text: after, ...marks }] : [])
  ]
  const content = [...paragraph.content.slice(0, index), ...replacement, ...paragraph.content.slice(index + 1)]
  return { paragraph: { ...paragraph, content }, replaced: 1 }
}

/**
 * @param {object} contentJson
 * @param {string} code
 * @returns {{ content: object, replaced: number }} `replaced` es 0 si ya estaba aplicado
 */
function rewriteProductoClause11(contentJson, code) {
  if (!TEMPLATE_CODES.includes(code)) {
    throw new Error(`La plantilla ${code} no está en la tabla de plantillas con la cláusula 1.1 de «Producto».`)
  }
  const content = structuredClone(contentJson)
  const indexes = (content.content ?? []).map((node, i) => (isClause11(node) ? i : -1)).filter((i) => i >= 0)
  if (indexes.length !== 1) {
    throw new Error(`${code}: se esperaba 1 cláusula 1.1 con el término «Producto» y hay ${indexes.length}.`)
  }
  const result = rewriteParagraph(content.content[indexes[0]], code)
  content.content[indexes[0]] = result.paragraph
  return { content, replaced: result.replaced }
}

module.exports = { rewriteProductoClause11, TEMPLATE_CODES }
