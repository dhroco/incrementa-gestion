const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-canje-mas-pago.json')
const { rewriteCanjeMasPago, TEMPLATE_CODES } = require('../utils/templateCanjeMasPago')
const { preprocessMissingFieldOverrides } = require('../services/documentBuilderService')
const { buildSubstitutionMap, applySubstitutionsToTipTapDoc } = require('../services/documentBuilderVariableContext')

function nodeText(node) {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') return `{{${node.attrs.variableId}}}`
  return (node.content ?? []).map(nodeText).join('')
}

const clause = (doc, number) => doc.content.map(nodeText).find((t) => t.startsWith(`${number} `))

test('las tres plantillas «Canje más Pago» son las únicas que se reescriben', () => {
  assert.deepEqual(TEMPLATE_CODES, ['CONTRATO_0013', 'CONTRATO_0014', 'CONTRATO_0015'])
  assert.throws(() => rewriteCanjeMasPago(fixtures.CONTRATO_0010, 'CONTRATO_0010'), /no está en la tabla/)
})

test('3.1 trae el canje y el pago en dinero con sus letras', () => {
  for (const code of TEMPLATE_CODES) {
    const { content, replaced } = rewriteCanjeMasPago(fixtures[code], code)
    assert.equal(replaced, 1, code)
    assert.equal(
      clause(content, '3.1'),
      '3.1 El Precio de los Servicios se compone de: (i) el canje de productos de la marca {{client_brand}}, por un monto de {{precio_numero}} ({{precio_texto}} pesos); y (ii) un pago en dinero de {{pago_dinero_numero}} ({{pago_dinero_texto}} pesos) líquido.',
      code
    )
  }
})

test('3.2 aplica la regla del saldo solo al canje y 3.3 paga el pago en dinero contra boleta de honorarios', () => {
  for (const code of TEMPLATE_CODES) {
    const { content } = rewriteCanjeMasPago(fixtures[code], code)
    assert.match(clause(content, '3.2'), /no ha canjeado el tope del canje indicado en la cláusula anterior, la parte del Precio correspondiente al canje se tendrá como totalmente pagada/, code)
    assert.match(clause(content, '3.3'), /, el pago en dinero dentro de los 30 días corridos siguientes a la recepción de la boleta de honorarios electrónica correspondiente,/, code)
    assert.equal(/factura/.test(clause(content, '3.3')), false, code)
    assert.match(clause(content, '3.3'), /cláusula 2\.6 y los Comentarios referidos en la cláusula 2\.7\.$/, code)
  }
})

test('solo cambian los tres párrafos de la 3: el resto de la plantilla queda idéntico', () => {
  for (const code of TEMPLATE_CODES) {
    const before = fixtures[code].content
    const { content } = rewriteCanjeMasPago(fixtures[code], code)
    assert.equal(content.content.length, before.length, code)
    const changed = content.content.map((n, i) => (JSON.stringify(n) === JSON.stringify(before[i]) ? -1 : i)).filter((i) => i >= 0)
    assert.equal(changed.length, 3, code)
    assert.deepEqual(changed, [changed[0], changed[0] + 1, changed[0] + 2], code)
    assert.deepEqual(content.content.slice(0, changed[0]), before.slice(0, changed[0]), code)
    assert.equal(content.content[changed[0]].attrs?.textAlign, before[changed[0]].attrs?.textAlign, code)
  }
})

test('los nodos variable nuevos tienen el mismo formato que los demás', () => {
  const { content } = rewriteCanjeMasPago(fixtures.CONTRATO_0013, 'CONTRATO_0013')
  const nodes = content.content.flatMap((n) => n.content ?? []).filter((n) => n.type === 'variable')
  const cash = nodes.filter((n) => n.attrs.variableId.startsWith('pago_dinero'))
  assert.deepEqual(
    cash.map((n) => n.attrs),
    [
      { bold: false, group: 'contrato', label: 'Pago en dinero', italic: false, underline: false, uppercase: false, variableId: 'pago_dinero_numero' },
      { bold: false, group: 'contrato', label: 'Pago en dinero en texto', italic: false, underline: false, uppercase: false, variableId: 'pago_dinero_texto' }
    ]
  )
})

test('es idempotente y no modifica el objeto de entrada', () => {
  for (const code of TEMPLATE_CODES) {
    const input = structuredClone(fixtures[code])
    const once = rewriteCanjeMasPago(input, code)
    assert.deepEqual(input, fixtures[code], code)
    const twice = rewriteCanjeMasPago(once.content, code)
    assert.equal(twice.replaced, 0, code)
    assert.deepEqual(twice.content, once.content, code)
  }
})

test('falla si alguna de las tres cláusulas no tiene el texto esperado', () => {
  const doc = structuredClone(fixtures.CONTRATO_0013)
  const p = doc.content.find((n) => nodeText(n).startsWith('3.3 '))
  p.content = p.content.map((n) => (n.type === 'text' ? { ...n, text: n.text.replace('30 días', '45 días') } : n))
  assert.throws(() => rewriteCanjeMasPago(doc, 'CONTRATO_0013'), /3\.3/)
})

test('caso de Simón Hermosilla (Seiko): $520.000 de canje y $40.000 en dinero, ambos con sus letras', () => {
  const { content } = rewriteCanjeMasPago(fixtures.CONTRATO_0013, 'CONTRATO_0013')
  const overrides = preprocessMissingFieldOverrides({ precio_numero: '520000', pago_dinero_numero: '40000' }, { currencyCode: 'CLP' })
  assert.equal(overrides.precio_texto, 'quinientos veinte mil')
  assert.equal(overrides.pago_dinero_texto, 'cuarenta mil')
  const map = buildSubstitutionMap(
    { supplier_type: 'persona_natural', full_name: 'Simón Hermosilla Parischewsky' },
    { short_name: 'Incrementa' },
    { name: 'Seiko', brand: 'Seiko' },
    overrides
  )
  assert.equal(
    clause(applySubstitutionsToTipTapDoc(content, map), '3.1'),
    '3.1 El Precio de los Servicios se compone de: (i) el canje de productos de la marca Seiko, por un monto de $520.000 (quinientos veinte mil pesos); y (ii) un pago en dinero de $40.000 (cuarenta mil pesos) líquido.'
  )
})
