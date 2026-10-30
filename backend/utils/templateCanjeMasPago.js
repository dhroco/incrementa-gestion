/**
 * Plantillas «Canje más Pago» (CONTRATO_0013, 0014 y 0015, personas naturales): las cláusulas 3.1 a 3.3 solo
 * contemplaban el canje. Pasan a tener el canje y el pago en dinero (variables pago_dinero_numero y
 * pago_dinero_texto), la regla del saldo no canjeado solo para el canje y el pago contra boleta de honorarios.
 * Función pura sobre el `content_json`: verifica el texto exacto de las tres cláusulas antes de reemplazarlas,
 * es idempotente y lanza un error si algo no coincide.
 */

const TEMPLATE_CODES = ['CONTRATO_0013', 'CONTRATO_0014', 'CONTRATO_0015']

const CLAUSE_3_3_OLD =
  '3.3 {{company_nombre_comercial}} deberá pagar al Influencer, a través de {{proveedor_nombre}}, el Precio dentro de los 30 días corridos siguientes a la recepción de la factura correspondiente, siempre y cuando haya recibido el informe de resultados indicado en la cláusula 2.6 y los Comentarios referidos en la cláusula 2.7.'

const CLAUSE_3_2_NEW =
  '3.2 Las Partes acuerdan que, si dentro de un mes el Influencer no ha canjeado el tope del canje indicado en la cláusula anterior, la parte del Precio correspondiente al canje se tendrá como totalmente pagada respecto de ese mes, independientemente que exista un saldo en favor del Influencer.'

const OLD_TEXTS = {
  canje: [
    '3.1 El pago del Precio se realizará mediante el canje de productos de la marca {{client_brand}}, por un monto de {{precio_numero}} ({{precio_texto}}).',
    '3.2 Las Partes acuerdan que, si dentro de un mes el Influencer no ha canjeado el tope indicado en la cláusula anterior, el Precio se tendrá como totalmente pagado respecto de ese mes, independientemente que exista un saldo en favor del Influencer.',
    CLAUSE_3_3_OLD
  ],
  fijo: [
    '3.1 El precio de los Servicios que {{company_nombre_comercial}} pagará al Influencer, corresponderá a una cantidad fija y única, en pesos chilenos, de {{precio_numero}} {{precio_texto}} líquido, en adelante, el “Precio”.',
    '3.2 Con todo, el pago del Precio se realizará mediante el canje de productos de la marca {{client_brand}}.',
    CLAUSE_3_3_OLD
  ]
}
const OLD_BY_CODE = { CONTRATO_0013: 'canje', CONTRATO_0014: 'canje', CONTRATO_0015: 'fijo' }

const VARIABLES = {
  client_brand: { group: 'client', label: 'Marca' },
  precio_numero: { group: 'contrato', label: 'Precio' },
  precio_texto: { group: 'contrato', label: 'Precio en texto' },
  pago_dinero_numero: { group: 'contrato', label: 'Pago en dinero' },
  pago_dinero_texto: { group: 'contrato', label: 'Pago en dinero en texto' },
  company_nombre_comercial: { group: 'empresa', label: 'Nombre Comercial' },
  proveedor_nombre: { group: 'proveedor', label: 'Nombre / Razón Social' }
}

const text = (value) => ({ type: 'text', text: value })
const number = (value) => ({ type: 'text', text: value, marks: [{ type: 'bold' }] })
const variable = (variableId) => ({
  type: 'variable',
  attrs: { bold: false, ...VARIABLES[variableId], italic: false, underline: false, uppercase: false, variableId }
})

const NEW_CONTENT = [
  [
    number('3.1 '),
    text('El Precio de los Servicios se compone de: (i) el canje de productos de la marca '),
    variable('client_brand'),
    text(', por un monto de '),
    variable('precio_numero'),
    text(' ('),
    variable('precio_texto'),
    text(' pesos); y (ii) un pago en dinero de '),
    variable('pago_dinero_numero'),
    text(' ('),
    variable('pago_dinero_texto'),
    text(' pesos) líquido.')
  ],
  [number('3.2 '), text(CLAUSE_3_2_NEW.slice('3.2 '.length))],
  [
    number('3.3 '),
    variable('company_nombre_comercial'),
    text(' deberá pagar al Influencer, a través de '),
    variable('proveedor_nombre'),
    text(
      ', el pago en dinero dentro de los 30 días corridos siguientes a la recepción de la boleta de honorarios electrónica correspondiente, siempre y cuando haya recibido el informe de resultados indicado en la cláusula 2.6 y los Comentarios referidos en la cláusula 2.7.'
    )
  ]
]

function paragraphText(node) {
  const parts = Array.isArray(node.content) ? node.content : []
  return parts
    .map((n) => (n.type === 'text' ? n.text ?? '' : n.type === 'variable' ? `{{${n.attrs?.variableId}}}` : ''))
    .join('')
}

const NEW_TEXTS = NEW_CONTENT.map((content) => paragraphText({ content }))

function clauseIndexes(blocks, code) {
  return ['3.1', '3.2', '3.3'].map((number) => {
    const indexes = blocks
      .map((node, i) => (node?.type === 'paragraph' && paragraphText(node).startsWith(`${number} `) ? i : -1))
      .filter((i) => i >= 0)
    if (indexes.length !== 1) throw new Error(`${code}: se esperaba 1 cláusula ${number} y hay ${indexes.length}.`)
    return indexes[0]
  })
}

/**
 * @param {object} contentJson
 * @param {string} code
 * @returns {{ content: object, replaced: number }} `replaced` es 0 si ya estaba aplicado
 */
function rewriteCanjeMasPago(contentJson, code) {
  if (!TEMPLATE_CODES.includes(code)) {
    throw new Error(`La plantilla ${code} no está en la tabla de plantillas «Canje más Pago».`)
  }
  const content = structuredClone(contentJson)
  const blocks = content.content ?? []
  const indexes = clauseIndexes(blocks, code)
  if (indexes[1] !== indexes[0] + 1 || indexes[2] !== indexes[1] + 1) {
    throw new Error(`${code}: las cláusulas 3.1 a 3.3 no son tres párrafos seguidos.`)
  }

  const current = indexes.map((i) => paragraphText(blocks[i]))
  if (current.every((t, i) => t === NEW_TEXTS[i])) return { content, replaced: 0 }

  const expected = OLD_TEXTS[OLD_BY_CODE[code]]
  expected.forEach((t, i) => {
    if (current[i] !== t) throw new Error(`${code}: la cláusula 3.${i + 1} no tiene el texto esperado.`)
  })

  indexes.forEach((blockIndex, i) => {
    blocks[blockIndex] = { ...blocks[blockIndex], content: structuredClone(NEW_CONTENT[i]) }
  })
  return { content, replaced: 1 }
}

module.exports = { rewriteCanjeMasPago, TEMPLATE_CODES, NEW_TEXTS }
