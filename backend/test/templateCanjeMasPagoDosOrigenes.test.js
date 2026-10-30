const test = require('node:test')
const assert = require('node:assert/strict')

const prod = require('./fixtures/plantillas-canje-mas-pago.json')
const preprod = require('./fixtures/plantillas-canje-mas-pago-preprod.json')
const { rewriteCanjeMasPago, TEMPLATE_CODES } = require('../utils/templateCanjeMasPago')

function nodeText(node) {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') return `{{${node.attrs.variableId}}}`
  return (node.content ?? []).map(nodeText).join('')
}

test('pre-prod (redacción original de 0013 y 0014) y producción (editada a mano) parten de textos distintos', () => {
  const clause31 = (doc) => doc.content.map(nodeText).find((t) => t.startsWith('3.1 '))
  assert.notEqual(clause31(preprod.CONTRATO_0013), clause31(prod.CONTRATO_0013))
  assert.equal(clause31(preprod.CONTRATO_0013), clause31(preprod.CONTRATO_0015))
})

test('desde cualquiera de las dos redacciones de partida el resultado es el mismo', () => {
  for (const code of TEMPLATE_CODES) {
    const fromProd = rewriteCanjeMasPago(prod[code], code)
    const fromPreprod = rewriteCanjeMasPago(preprod[code], code)
    assert.equal(fromPreprod.replaced, 1, code)
    assert.deepEqual(fromPreprod.content.content.map(nodeText), fromProd.content.content.map(nodeText), code)
  }
})

test('las dos redacciones de partida tienen el mismo número de bloques que el resultado', () => {
  for (const code of TEMPLATE_CODES) {
    assert.equal(rewriteCanjeMasPago(preprod[code], code).content.content.length, preprod[code].content.length, code)
  }
})
