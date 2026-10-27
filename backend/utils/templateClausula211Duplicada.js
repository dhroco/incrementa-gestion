/**
 * En CONTRATO_0003, 0006, 0009, 0012 y 0015 la cláusula 2.11 repite la obligación de no competencia
 * de la 2.8. Se elimina la 2.11 (la 2.8 queda tal cual) y las cláusulas 2.12 a 2.16 pasan a ser 2.11 a 2.15.
 * Función pura sobre el `content_json`: verifica el texto exacto de ambas cláusulas y la numeración
 * correlativa antes de modificar, es idempotente y lanza un error si algo no coincide.
 */

const TEMPLATE_CODES = ['CONTRATO_0003', 'CONTRATO_0006', 'CONTRATO_0009', 'CONTRATO_0012', 'CONTRATO_0015']

const CLAUSE_2_8 =
  '2.8 Las Partes acuerdan que el Influencer no podrá publicar ni promocionar contenido para marcas, productos o servicios que sean competencia de {{client_brand}} durante la vigencia del Contrato y por un plazo de {{dias_no_competencia}} días corridos contados desde la fecha de publicación de los Servicios por parte del Influencer.'

/** La 2.11 solo cambia en el nombre de la empresa del final: variable o «Dynamics». */
const CLAUSE_2_11 =
  /^2\.11 Las Partes acuerdan que el Influencer no podrá publicar ni promocionar contenido para marcas, productos o servicios que sean competencia de \{\{client_brand\}\} durante la vigencia del Contrato y por un plazo de \{\{dias_no_competencia\}\} días naturales contados desde la fecha de publicación de los Servicios por parte del Influencer, salvo autorización previa y por escrito de (?:\{\{company_nombre_comercial\}\}|Dynamics)\.$/

const LAST_NUMBER_BEFORE = 16
const NUMBER = /^2\.(\d+)(?=\s)/

function paragraphText(node) {
  const parts = Array.isArray(node.content) ? node.content : []
  return parts
    .map((n) => (n.type === 'text' ? n.text ?? '' : n.type === 'variable' ? `{{${n.attrs?.variableId}}}` : ''))
    .join('')
}

/** Párrafos numerados «2.N …» de la cláusula 2, con su posición y número. */
function numberedClause2(content) {
  return content
    .map((node, index) => {
      if (!node || node.type !== 'paragraph') return null
      const match = NUMBER.exec(paragraphText(node))
      return match ? { index, number: Number(match[1]) } : null
    })
    .filter(Boolean)
}

function isSequence(items, from, to) {
  return items.length === to - from + 1 && items.every((item, i) => item.number === from + i)
}

/** Cambia el número al inicio del párrafo; el número vive en el primer nodo de texto (en negrita). */
function renumber(node, from, to, code) {
  const first = node.content?.[0]
  const prefix = `2.${from}`
  if (!first || first.type !== 'text' || typeof first.text !== 'string' || !new RegExp(`^${prefix.replace('.', '\\.')}\\s`).test(first.text)) {
    throw new Error(`${code}: la cláusula 2.${from} no empieza con su número en el primer texto.`)
  }
  const next = structuredClone(node)
  next.content[0].text = `2.${to}${first.text.slice(prefix.length)}`
  return next
}

/**
 * @param {object} contentJson
 * @param {string} code
 * @returns {{ content: object, removed: number }} `removed` es 0 si ya estaba aplicado
 */
function removeDuplicateClause211(contentJson, code) {
  if (!TEMPLATE_CODES.includes(code)) {
    throw new Error(`La plantilla ${code} no está en la tabla de plantillas con la cláusula 2.11 repetida.`)
  }
  const content = structuredClone(contentJson)
  const blocks = content.content ?? []
  const numbered = numberedClause2(blocks)

  const clause28 = numbered.find((item) => item.number === 8)
  if (!clause28 || paragraphText(blocks[clause28.index]) !== CLAUSE_2_8) {
    throw new Error(`${code}: la cláusula 2.8 no tiene el texto de no competencia esperado.`)
  }

  const already = isSequence(numbered, 1, LAST_NUMBER_BEFORE - 1)
  if (already) {
    const duplicates = numbered.filter((item) => CLAUSE_2_11.test(paragraphText(blocks[item.index]).replace(/^2\.\d+/, '2.11')))
    if (duplicates.length === 0) return { content, removed: 0 }
    throw new Error(`${code}: la numeración ya llega a 2.15 pero queda una cláusula repetida de no competencia.`)
  }

  if (!isSequence(numbered, 1, LAST_NUMBER_BEFORE)) {
    throw new Error(`${code}: la numeración de la cláusula 2 no es correlativa de 2.1 a 2.${LAST_NUMBER_BEFORE}.`)
  }
  const clause211 = numbered.find((item) => item.number === 11)
  if (!CLAUSE_2_11.test(paragraphText(blocks[clause211.index]))) {
    throw new Error(`${code}: la cláusula 2.11 no es la repetición esperada de la 2.8.`)
  }

  const renumbered = new Map(
    numbered.filter((item) => item.number > 11).map((item) => [item.index, renumber(blocks[item.index], item.number, item.number - 1, code)])
  )
  content.content = blocks.flatMap((node, index) => {
    if (index === clause211.index) return []
    return [renumbered.get(index) ?? node]
  })
  return { content, removed: 1 }
}

module.exports = { removeDuplicateClause211, TEMPLATE_CODES }
