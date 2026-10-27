const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-clausula-1-1.json')
const { rewriteProductoClause11, TEMPLATE_CODES } = require('../utils/templateProductoVariable')
const { buildSubstitutionMap, applySubstitutionsToTipTapDoc } = require('../services/documentBuilderVariableContext')

function nodeText(node) {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') return `{{${node.attrs.variableId}}}`
  return (node.content ?? []).map(nodeText).join('')
}

test('hay un fixture real de la cláusula 1.1 por cada una de las 17 plantillas', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), [...TEMPLATE_CODES].sort())
})

test('en las 17 plantillas «Producto» del término definido pasa a la variable client_product_campaign', () => {
  for (const code of TEMPLATE_CODES) {
    const before = nodeText(fixtures[code].content[0])
    const { content, replaced } = rewriteProductoClause11(fixtures[code], code)
    const after = nodeText(content.content[0])
    assert.equal(replaced, 1, code)
    assert.match(before, /\(en adelante el “Producto” y “\{\{client_brand\}\}” respectivamente\)/, code)
    assert.match(after, /\(en adelante el “\{\{client_product_campaign\}\}” y “\{\{client_brand\}\}” respectivamente\)/, code)
    // Lo demás de la cláusula no cambia: deshaciendo el reemplazo se obtiene el texto original.
    assert.equal(after.replace('(en adelante el “{{client_product_campaign}}” y', '(en adelante el “Producto” y'), before, code)
  }
})

test('el nodo variable tiene el mismo formato que la variable de producto que ya usa la plantilla', () => {
  const { content } = rewriteProductoClause11(fixtures.CONTRATO_0001, 'CONTRATO_0001')
  const variables = content.content[0].content.filter((n) => n.type === 'variable' && n.attrs.variableId === 'client_product_campaign')
  assert.equal(variables.length, 2)
  assert.deepEqual(variables[0].attrs, variables[1].attrs)
  assert.deepEqual(variables[1].attrs, {
    bold: false,
    group: 'client',
    label: 'Producto/Campaña',
    italic: false,
    underline: false,
    uppercase: false,
    variableId: 'client_product_campaign'
  })
})

test('al generar, el término definido muestra el producto del cliente (plantilla chilena y mexicana)', () => {
  for (const code of ['CONTRATO_0001', 'CONTRATO_0009', 'CONTRATO_0016', 'CONTRATO_0017']) {
    const { content } = rewriteProductoClause11(fixtures[code], code)
    const map = buildSubstitutionMap(
      { supplier_type: 'persona_natural', full_name: 'Ana Pérez' },
      { short_name: 'Incrementa' },
      { name: 'Ford Motor Company Chile SpA', brand: 'Ford' },
      { client_product_campaign: 'Ford Expedition 2026' }
    )
    const text = nodeText(applySubstitutionsToTipTapDoc(content, map).content[0])
    assert.match(text, /\(en adelante el “Ford Expedition 2026” y “Ford” respectivamente\)/, code)
    assert.equal(/Producto”/.test(text), false, code)
  }
})

test('es idempotente y no modifica el contenido recibido', () => {
  for (const code of TEMPLATE_CODES) {
    const original = structuredClone(fixtures[code])
    const first = rewriteProductoClause11(fixtures[code], code)
    assert.deepEqual(fixtures[code], original)
    const second = rewriteProductoClause11(first.content, code)
    assert.equal(second.replaced, 0, code)
    assert.deepEqual(second.content, first.content, code)
  }
})

test('si la cláusula 1.1 no tiene el texto esperado, lanza un error', () => {
  const altered = structuredClone(fixtures.CONTRATO_0003)
  const para = altered.content[0]
  para.content = para.content.map((n) => (n.text ? { ...n, text: n.text.replace('“Producto”', '“Servicio”') } : n))
  assert.throws(() => rewriteProductoClause11(altered, 'CONTRATO_0003'), /1\.1/)
  assert.throws(() => rewriteProductoClause11(fixtures.CONTRATO_0003, 'PL0001'), /no está en la tabla/)
})
