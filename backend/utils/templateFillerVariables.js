/**
 * Reemplaza el texto de relleno de las plantillas de contrato por variables (nodos `variable`
 * de TipTap). Función pura: recibe el `content_json` y el código de la plantilla y devuelve el
 * contenido nuevo. No borra ni mueve cláusulas: solo reemplaza, dentro de un nodo de texto, el
 * fragmento exacto de relleno por un nodo `variable`. El texto fijo que sigue («días corridos»,
 * «horas efectivas», etc.) se queda en la plantilla.
 *
 * Es idempotente: un párrafo que ya trae la variable no se vuelve a tocar. Si un párrafo que
 * debería tener relleno no coincide con el texto esperado, lanza un error (la migración se
 * detiene sin modificar nada).
 */

const NOMBRES_NO_COMPETENCIA = /\(Cantidad en letras\) \(Cantidad en números\)/
const PLAZO_NO_COMPETENCIA_FIJO = /(?<=por un plazo de )30(?= días corridos)/

/** @type {Array<{ id: string, variableId: string, label: string, group: string, paragraphContains: string, patterns: RegExp[] }>} */
const RULES = [
  {
    id: 'no-competencia',
    variableId: 'dias_no_competencia',
    label: 'Días de no competencia',
    group: 'contrato',
    paragraphContains: 'no podrá publicar ni promocionar contenido para marcas',
    patterns: [NOMBRES_NO_COMPETENCIA, PLAZO_NO_COMPETENCIA_FIJO]
  },
  {
    id: 'activaciones-cantidad',
    variableId: 'activaciones_cantidad',
    label: 'Cantidad máxima de activaciones',
    group: 'contrato',
    paragraphContains: 'Las Activaciones Presenciales comprenderán un máximo de',
    patterns: [/\(Cantidad de veces en palabras\) \(Cantidad de veces en número\)/]
  },
  {
    id: 'activaciones-horas',
    variableId: 'activaciones_horas',
    label: 'Horas máximas por activación',
    group: 'contrato',
    paragraphContains: 'Las Activaciones Presenciales comprenderán un máximo de',
    patterns: [/\(Cantidad de horas en letras\) \(Cantidad de horas en números\)/]
  },
  {
    id: 'activaciones-antelacion',
    variableId: 'activaciones_antelacion_dias',
    label: 'Días de antelación para las activaciones',
    group: 'contrato',
    paragraphContains: 'con una antelación mínima de',
    // La segunda forma es la errata de CONTRATO_0017 (falta el «(» de «Cantidad de veces en números)»).
    patterns: [
      /\(Cantidad de veces en letras\) \(Cantidad de veces en números\)/,
      /\(Cantidad de veces en letras\) Cantidad de veces en números\)/
    ]
  },
  {
    id: 'vigencia',
    variableId: 'vigencia_meses',
    label: 'Vigencia del contrato (meses)',
    group: 'contrato',
    paragraphContains: 'tendrá una vigencia de',
    patterns: [/\(Cantidad en letras\) \(Cantidad en números\)/]
  },
  {
    id: 'cesion',
    variableId: 'meses_cesion',
    label: 'Plazo de cesión (meses)',
    group: 'contrato',
    paragraphContains: 'por un plazo máximo y determinado de',
    patterns: [/\(Número en letras\) \(Cantidad en números\)/]
  },
  {
    id: 'boost',
    variableId: 'dias_boost',
    label: 'Días de amplificación (boost)',
    group: 'contrato',
    paragraphContains: 'amplificación pagada (boost)',
    patterns: [/\(Número en letras\) \(Cantidad en números\)/]
  },
  {
    id: 'cliente',
    variableId: 'client_name',
    label: 'Nombre Cliente',
    group: 'client',
    paragraphContains: 'la cual fue desarrollado por su',
    patterns: [/\(Nombre cliente\)/]
  }
]

const FAMILIA_SIN_EVENTO = { dias_no_competencia: 1 }
const FAMILIA_CON_EVENTO = {
  dias_no_competencia: 2,
  activaciones_cantidad: 1,
  activaciones_horas: 1,
  activaciones_antelacion_dias: 1
}

/** Cuántos nodos de cada variable deben quedar, por plantilla, después de reescribir. */
const EXPECTED_VARIABLES = {
  CONTRATO_0001: FAMILIA_SIN_EVENTO,
  CONTRATO_0002: FAMILIA_SIN_EVENTO,
  CONTRATO_0003: FAMILIA_CON_EVENTO,
  CONTRATO_0004: FAMILIA_SIN_EVENTO,
  CONTRATO_0005: FAMILIA_SIN_EVENTO,
  CONTRATO_0006: FAMILIA_CON_EVENTO,
  CONTRATO_0007: FAMILIA_SIN_EVENTO,
  CONTRATO_0008: FAMILIA_SIN_EVENTO,
  CONTRATO_0009: FAMILIA_CON_EVENTO,
  CONTRATO_0010: FAMILIA_SIN_EVENTO,
  CONTRATO_0011: FAMILIA_SIN_EVENTO,
  CONTRATO_0012: FAMILIA_CON_EVENTO,
  CONTRATO_0013: FAMILIA_SIN_EVENTO,
  CONTRATO_0014: FAMILIA_SIN_EVENTO,
  CONTRATO_0015: FAMILIA_CON_EVENTO,
  CONTRATO_0016: {
    client_name: 1,
    dias_boost: 1,
    dias_no_competencia: 1,
    vigencia_meses: 1,
    meses_cesion: 1
  },
  CONTRATO_0017: {
    client_name: 1,
    dias_no_competencia: 1,
    activaciones_cantidad: 1,
    activaciones_horas: 1,
    activaciones_antelacion_dias: 1,
    vigencia_meses: 1,
    meses_cesion: 1
  }
}

const TEMPLATE_CODES = Object.keys(EXPECTED_VARIABLES)

const LEFTOVER_PLACEHOLDER = /\((?:Cantidad|Número|Nombre cliente)[^)]*\)|Cantidad de veces en números\)/

function isParagraph(node) {
  return node && typeof node === 'object' && node.type === 'paragraph' && Array.isArray(node.content)
}

function paragraphText(paragraph) {
  return paragraph.content
    .map((node) => {
      if (node.type === 'text') return node.text ?? ''
      if (node.type === 'variable') return `{{${node.attrs?.variableId}}}`
      return ''
    })
    .join('')
}

function variableNode(rule) {
  return {
    type: 'variable',
    attrs: {
      bold: false,
      group: rule.group,
      label: rule.label,
      italic: false,
      underline: false,
      uppercase: false,
      variableId: rule.variableId
    }
  }
}

function paragraphHasVariable(paragraph, variableId) {
  return paragraph.content.some((node) => node.type === 'variable' && node.attrs?.variableId === variableId)
}

function textNodeWithSameMarks(source, text) {
  const node = { type: 'text', text }
  if (source.marks) node.marks = structuredClone(source.marks)
  return node
}

/** Aplica una regla a un párrafo. Devuelve el párrafo nuevo y cuántas veces reemplazó. */
function applyRule(paragraph, rule, code) {
  const hits = []
  paragraph.content.forEach((node, index) => {
    if (node.type !== 'text' || typeof node.text !== 'string') return
    for (const pattern of rule.patterns) {
      const match = pattern.exec(node.text)
      if (match) hits.push({ index, match })
    }
  })

  if (hits.length > 1) {
    throw new Error(
      `${code}: el párrafo «${paragraphText(paragraph).slice(0, 60)}…» tiene ${hits.length} coincidencias para ${rule.variableId}; se esperaba 1.`
    )
  }

  if (hits.length === 0) {
    if (paragraphHasVariable(paragraph, rule.variableId)) return { paragraph, replaced: 0 }
    throw new Error(
      `${code}: el párrafo «${paragraphText(paragraph).slice(0, 60)}…» no tiene el texto de relleno esperado para ${rule.variableId}.`
    )
  }

  const { index, match } = hits[0]
  const node = paragraph.content[index]
  const before = node.text.slice(0, match.index)
  const after = node.text.slice(match.index + match[0].length)
  const replacement = []
  if (before !== '') replacement.push(textNodeWithSameMarks(node, before))
  replacement.push(variableNode(rule))
  if (after !== '') replacement.push(textNodeWithSameMarks(node, after))

  const content = [...paragraph.content.slice(0, index), ...replacement, ...paragraph.content.slice(index + 1)]
  return { paragraph: { ...paragraph, content }, replaced: 1 }
}

function rewriteNode(node, code, stats) {
  if (!node || typeof node !== 'object') return node
  if (isParagraph(node)) {
    let current = node
    for (const rule of RULES) {
      if (!paragraphText(current).includes(rule.paragraphContains)) continue
      // Solo se exige relleno en los párrafos donde la regla aplica para esta plantilla.
      const expected = EXPECTED_VARIABLES[code]?.[rule.variableId]
      if (!expected) continue
      const hasPattern = current.content.some(
        (n) => n.type === 'text' && rule.patterns.some((p) => p.test(n.text ?? ''))
      )
      if (!hasPattern && !paragraphHasVariable(current, rule.variableId)) continue
      const result = applyRule(current, rule, code)
      current = result.paragraph
      stats.replaced += result.replaced
    }
    return current
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((child) => rewriteNode(child, code, stats)) }
  }
  return node
}

function countVariables(node, counts = {}) {
  if (!node || typeof node !== 'object') return counts
  if (node.type === 'variable' && node.attrs?.variableId) {
    counts[node.attrs.variableId] = (counts[node.attrs.variableId] ?? 0) + 1
  }
  if (Array.isArray(node.content)) node.content.forEach((child) => countVariables(child, counts))
  return counts
}

function findLeftover(node) {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'text' && typeof node.text === 'string' && LEFTOVER_PLACEHOLDER.test(node.text)) {
    return node.text.match(LEFTOVER_PLACEHOLDER)[0]
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const found = findLeftover(child)
      if (found) return found
    }
  }
  return null
}

/**
 * @param {object} contentJson
 * @param {string} code — código de la plantilla (CONTRATO_0001 a CONTRATO_0017)
 * @returns {{ content: object, replaced: number }} `replaced` es 0 si ya estaba aplicado
 */
function rewriteFillerVariables(contentJson, code) {
  const expected = EXPECTED_VARIABLES[code]
  if (!expected) {
    throw new Error(`La plantilla ${code} no está en la tabla de plantillas con texto de relleno.`)
  }

  const stats = { replaced: 0 }
  const content = rewriteNode(structuredClone(contentJson), code, stats)

  const counts = countVariables(content)
  for (const [variableId, count] of Object.entries(expected)) {
    if ((counts[variableId] ?? 0) !== count) {
      throw new Error(
        `${code}: se esperaban ${count} variable(s) ${variableId} y quedaron ${counts[variableId] ?? 0}.`
      )
    }
  }
  const leftover = findLeftover(content)
  if (leftover) throw new Error(`${code}: quedó texto de relleno sin reemplazar: «${leftover}».`)

  return { content, replaced: stats.replaced }
}

module.exports = {
  rewriteFillerVariables,
  TEMPLATE_CODES,
  EXPECTED_VARIABLES,
  RULES
}
