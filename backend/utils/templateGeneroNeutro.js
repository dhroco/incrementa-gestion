/**
 * Redacción sin género en las plantillas CONTRATO_0001 a CONTRATO_0017: la parte «persona» ya no queda con
 * género masculino o femenino fijo (un influencer mujer salía «domiciliado»). Son cambios de una frase dentro
 * de un nodo de texto, sin tocar nada más:
 *   - 2.1 «esta último prestará» → «el Influencer prestará» (todas)
 *   - «La personería de don {{rep}}» / «La personalidad de don {{rep}}» → sin «don» (todas)
 *   - persona natural chilena (0007 a 0015): «domiciliado para estos efectos» → «con domicilio para estos efectos»
 *   - persona natural mexicana (0016 y 0017): «domiciliada en» → «con domicilio en»
 *   - 0007 a 0009: «en adelante la “Influencer”» → «el “Influencer”» (igual que 0010 a 0015; el término va en otro nodo en negrita)
 * Función pura sobre el `content_json`. Si una frase ya no está (porque se editó a mano o ya estaba aplicada)
 * esa regla no hace nada; si una frase aparece más de una vez, se detiene sin modificar.
 */

const TEMPLATE_CODES = Array.from({ length: 17 }, (_, i) => `CONTRATO_${String(i + 1).padStart(4, '0')}`)
const n = (from, to) => TEMPLATE_CODES.slice(from - 1, to)

const RULES = [
  { name: '2.1 «esta último»', codes: TEMPLATE_CODES, find: ', esta último prestará', replace: ' el Influencer prestará' },
  { name: 'personería de don', codes: n(1, 15), find: 'La personería de don ', replace: 'La personería de ' },
  { name: 'personalidad de don', codes: n(16, 17), find: 'La personalidad de don ', replace: 'La personalidad de ' },
  { name: 'domiciliado', codes: n(7, 15), find: 'domiciliado para estos efectos', replace: 'con domicilio para estos efectos' },
  { name: 'domiciliada', codes: n(16, 17), find: 'domiciliada en ', replace: 'con domicilio en ' },
  { name: 'la «Influencer»', codes: n(7, 9), find: ' en adelante la “', replace: ' en adelante el “' }
]

function countOccurrences(text, find) {
  return text.split(find).length - 1
}

function walkTextNodes(node, visit) {
  if (!node || typeof node !== 'object') return
  if (node.type === 'text' && typeof node.text === 'string') visit(node)
  if (Array.isArray(node.content)) node.content.forEach((child) => walkTextNodes(child, visit))
}

/**
 * @param {object} contentJson
 * @param {string} code
 * @returns {{ content: object, replaced: number, applied: string[] }} `replaced` es el total de frases cambiadas
 */
function rewriteGeneroNeutro(contentJson, code) {
  if (!TEMPLATE_CODES.includes(code)) {
    throw new Error(`La plantilla ${code} no está en la tabla de plantillas con redacción por género.`)
  }
  const content = structuredClone(contentJson)
  const applied = []
  for (const rule of RULES.filter((r) => r.codes.includes(code))) {
    let total = 0
    const nodes = []
    walkTextNodes(content, (node) => {
      const hits = countOccurrences(node.text, rule.find)
      if (hits > 0) {
        total += hits
        nodes.push(node)
      }
    })
    if (total > 1) throw new Error(`${code}: la frase de «${rule.name}» aparece ${total} veces; se esperaba 1.`)
    if (total === 1) {
      nodes[0].text = nodes[0].text.replace(rule.find, rule.replace)
      applied.push(rule.name)
    }
  }
  return { content, replaced: applied.length, applied }
}

module.exports = { rewriteGeneroNeutro, TEMPLATE_CODES, RULES }
