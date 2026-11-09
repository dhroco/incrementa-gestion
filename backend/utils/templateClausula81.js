/**
 * Cláusula 8.1 (retiro, eliminación o despublicación de contenido): se elimina «con su producto
 * {{producto/campaña}}» de sus 5 párrafos y, en el párrafo 3, el artículo «la» antes del cliente. Así deja
 * de salir «Seiko con su producto Seiko». Nada más cambia: ni otras cláusulas, ni numeración, ni formato.
 *
 * Función pura sobre el `content_json`. Clasifica la cláusula de cada plantilla:
 *   (a) coincide exactamente con el texto original → se corrige;
 *   (b) coincide salvo espacios (p. ej. un espacio sobrante al inicio de un párrafo) → se corrige y
 *       queda EXACTAMENTE como el texto final esperado;
 *   (c) difiere en algo más (p. ej. México, que tiene otra redacción) o no es la cláusula → NO se toca.
 * Es idempotente: si ya está el texto final, no hace nada.
 */

const crypto = require('crypto')

const PHRASE = 'podrá solicitar al Influencer el retiro, eliminación o despublicación'
const CLIENT = '{{client_brand}}'
const PRODUCT = '{{client_product_campaign}}'
const WITH_PRODUCT = ' con su producto '

function paragraphText(node) {
  const parts = Array.isArray(node?.content) ? node.content : []
  return parts
    .map((n) => (n.type === 'text' ? n.text ?? '' : n.type === 'variable' ? `{{${n.attrs?.variableId}}}` : ''))
    .join('')
}

/** Espacios: recorta, junta espacios repetidos y quita los de antes de coma o punto. */
function normalizeSpaces(text) {
  return text.trim().replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1')
}

/** Localiza la cláusula: bloque «8.1 …» con la frase del retiro; tiene 5 párrafos seguidos. */
function findClause(blocks) {
  const index = blocks.findIndex((node) => node?.type === 'paragraph' && /^\s*8\.1\b/.test(paragraphText(node)) && paragraphText(node).includes(PHRASE))
  if (index < 0) return { index: -1 }
  const paragraphs = blocks.slice(index, index + 5)
  if (paragraphs.length !== 5 || paragraphs.some((node) => node?.type !== 'paragraph')) return { index, paragraphs: null }
  return { index, paragraphs }
}

/** «Dynamics» del párrafo 1: la variable de la empresa o el texto «Dynamics». */
function companyToken(firstParagraphText) {
  const match = /^\s*8\.1\s+(\{\{[a-z_0-9]+\}\}|Dynamics),/.exec(firstParagraphText)
  return match ? match[1] : null
}

function build(d) {
  return {
    before: [
      `8.1 ${d}, en representación de ${CLIENT} con su producto ${PRODUCT}, podrá solicitar al Influencer el retiro, eliminación o despublicación de cualquier contenido generado en virtud del presente contrato, sin necesidad de expresar causa.`,
      `El Influencer se obliga a efectuar dicha eliminación dentro del plazo máximo de 24 (veinticuatro) horas contado desde la notificación escrita efectuada por ${CLIENT} con su producto ${PRODUCT} o ${d}, la cual podrá realizarse por correo electrónico o mensaje directo a través del medio habitual de comunicación entre las partes.`,
      `El ejercicio de este derecho por parte de la ${CLIENT} con su producto ${PRODUCT} o ${d} no implicará modificación del valor pactado ni compensación adicional, entendiéndose que la remuneración convenida cubre la totalidad de las gestiones asociadas al contenido, incluyendo su eventual eliminación.`,
      `En caso de incumplimiento de esta obligación, ${CLIENT} con su producto ${PRODUCT} o ${d} podrá poner término inmediato al contrato, sin perjuicio de ejercer las acciones legales correspondientes por los perjuicios causados, incluyendo la exigencia de cumplimiento forzado o la indemnización de daños y perjuicios que dicho incumplimiento pudiera generar.`,
      `No obstante, ${CLIENT} con su producto ${PRODUCT} conservará el derecho de uso, reproducción, difusión o almacenamiento del material para fines internos o publicitarios, de conformidad con la cláusula de Propiedad Intelectual.`
    ],
    after: [
      `8.1 ${d}, en representación de ${CLIENT}, podrá solicitar al Influencer el retiro, eliminación o despublicación de cualquier contenido generado en virtud del presente contrato, sin necesidad de expresar causa.`,
      `El Influencer se obliga a efectuar dicha eliminación dentro del plazo máximo de 24 (veinticuatro) horas contado desde la notificación escrita efectuada por ${CLIENT} o ${d}, la cual podrá realizarse por correo electrónico o mensaje directo a través del medio habitual de comunicación entre las partes.`,
      `El ejercicio de este derecho por parte de ${CLIENT} o ${d} no implicará modificación del valor pactado ni compensación adicional, entendiéndose que la remuneración convenida cubre la totalidad de las gestiones asociadas al contenido, incluyendo su eventual eliminación.`,
      `En caso de incumplimiento de esta obligación, ${CLIENT} o ${d} podrá poner término inmediato al contrato, sin perjuicio de ejercer las acciones legales correspondientes por los perjuicios causados, incluyendo la exigencia de cumplimiento forzado o la indemnización de daños y perjuicios que dicho incumplimiento pudiera generar.`,
      `No obstante, ${CLIENT} conservará el derecho de uso, reproducción, difusión o almacenamiento del material para fines internos o publicitarios, de conformidad con la cláusula de Propiedad Intelectual.`
    ]
  }
}

/** Defectos que no pueden aparecer en el texto final. */
function defects(text) {
  const found = []
  if (/ {2,}/.test(text)) found.push('espacios dobles')
  if (/\s[,.;]/.test(text)) found.push('espacio antes de coma o punto')
  if (/[A-Za-zÁÉÍÓÚáéíóúñ]\{\{|\}\}[A-Za-zÁÉÍÓÚáéíóúñ]|,\{\{/.test(text)) found.push('variable pegada a una palabra')
  if (/en representación de en representación de/.test(text)) found.push('«en representación de» duplicado')
  if (/\bo o\b/.test(text)) found.push('«o o»')
  if (/con su producto/.test(text)) found.push('«con su producto»')
  return found
}

/** Quita «con su producto {{producto}}» de un párrafo, a nivel de nodos y sin tocar formato. */
function removeProductPhrase(paragraph) {
  const nodes = paragraph.content.map((node) => structuredClone(node))
  const out = []
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const isProduct = node.type === 'variable' && node.attrs?.variableId === 'client_product_campaign'
    if (isProduct) {
      const previous = out[out.length - 1]
      if (previous?.type === 'text' && previous.text.endsWith(WITH_PRODUCT)) {
        previous.text = previous.text.slice(0, -WITH_PRODUCT.length)
        if (previous.text === '') out.pop()
        continue
      }
      return null
    }
    out.push(node)
  }
  return { ...paragraph, content: out }
}

/** Párrafo 3: «por parte de la {{cliente}}» → «por parte de {{cliente}}». */
function removeArticle(paragraph) {
  const nodes = paragraph.content.map((node) => structuredClone(node))
  for (let i = 1; i < nodes.length; i++) {
    const isClient = nodes[i].type === 'variable' && nodes[i].attrs?.variableId === 'client_brand'
    const previous = nodes[i - 1]
    if (isClient && previous.type === 'text' && previous.text.endsWith('por parte de la ')) {
      previous.text = previous.text.slice(0, -'la '.length)
      return { ...paragraph, content: nodes }
    }
  }
  return null
}

/** Espacios sobrantes (clase b) a nivel de nodos: inicio de párrafo y espacios repetidos dentro de un texto. */
function cleanSpaces(paragraph) {
  const nodes = paragraph.content.map((node) => structuredClone(node))
  if (nodes[0]?.type === 'text') nodes[0].text = nodes[0].text.replace(/^\s+/, '')
  const last = nodes[nodes.length - 1]
  if (last?.type === 'text') last.text = last.text.replace(/\s+$/, '')
  for (const node of nodes) if (node.type === 'text') node.text = node.text.replace(/ {2,}/g, ' ')
  return { ...paragraph, content: nodes }
}

/** Hash del contenido de la plantilla SIN la cláusula 8.1 (sus 5 párrafos): debe ser igual antes y después. */
function hashWithoutClause(contentJson) {
  const blocks = contentJson.content ?? []
  const { index, paragraphs } = findClause(blocks)
  const rest = paragraphs ? blocks.filter((_, i) => i < index || i >= index + 5) : blocks
  return crypto.createHash('sha256').update(JSON.stringify({ ...contentJson, content: rest })).digest('hex')
}

/**
 * @param {object} contentJson
 * @returns {{ content: object, status: 'applied'|'already'|'excluded', category: 'a'|'b'|'c'|null, reason?: string,
 *   replaced: number, before?: string[], after?: string[], current?: string[] }}
 */
function rewriteClausula81(contentJson) {
  const content = structuredClone(contentJson)
  const blocks = content.content ?? []
  const { index, paragraphs } = findClause(blocks)
  if (index < 0) return { content, status: 'excluded', category: 'c', replaced: 0, reason: 'no tiene una cláusula 8.1 con la frase del retiro de contenido' }
  if (!paragraphs) return { content, status: 'excluded', category: 'c', replaced: 0, reason: 'la cláusula 8.1 no tiene 5 párrafos seguidos' }

  const current = paragraphs.map(paragraphText)
  const d = companyToken(current[0])
  if (!d) return { content, status: 'excluded', category: 'c', replaced: 0, reason: 'el párrafo 1 no empieza con «8.1 {empresa},»', current }
  const { before, after } = build(d)

  if (current.every((text, i) => text === after[i])) return { content, status: 'already', category: null, replaced: 0, before, after, current }

  let category = null
  if (current.every((text, i) => text === before[i])) category = 'a'
  else if (current.every((text, i) => normalizeSpaces(text) === normalizeSpaces(before[i]))) category = 'b'
  if (!category) return { content, status: 'excluded', category: 'c', replaced: 0, reason: 'el texto difiere del original en algo más que espacios', before, after, current }

  const rewritten = []
  for (let i = 0; i < 5; i++) {
    let paragraph = category === 'b' ? cleanSpaces(paragraphs[i]) : paragraphs[i]
    paragraph = removeProductPhrase(paragraph)
    if (paragraph && i === 2) paragraph = removeArticle(paragraph)
    if (!paragraph) return { content, status: 'excluded', category: 'c', replaced: 0, reason: `no se pudo quitar la frase en el párrafo ${i + 1} sin salir de los nodos esperados`, before, after, current }
    rewritten.push(paragraph)
  }

  const result = rewritten.map(paragraphText)
  const wrong = result.findIndex((text, i) => text !== after[i])
  if (wrong >= 0) return { content, status: 'excluded', category: 'c', replaced: 0, reason: `el párrafo ${wrong + 1} no queda exactamente como el texto final esperado`, before, after, current }
  const bad = result.flatMap((text, i) => defects(text).map((defect) => `P${i + 1}: ${defect}`))
  if (bad.length) return { content, status: 'excluded', category: 'c', replaced: 0, reason: `el resultado tendría defectos (${bad.join('; ')})`, before, after, current }

  rewritten.forEach((paragraph, i) => {
    blocks[index + i] = paragraph
  })
  return { content, status: 'applied', category, replaced: 1, before, after, current }
}

module.exports = { rewriteClausula81, hashWithoutClause, findClause, paragraphText, defects, build, PHRASE }
