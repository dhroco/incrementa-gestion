const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')

const fixtures = require('./fixtures/plantillas-pie-firma.json')
const { rewritePieFirma, TEMPLATE_CODES, EXTRA_SPACE_PARAGRAPHS } = require('../utils/templatePieFirma')

function nodeText(node) {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') return `{{${node.attrs.variableId}}}`
  return (node.content ?? []).map(nodeText).join('')
}

const isEmpty = (node, align) => node.type === 'paragraph' && !(node.content && node.content.length) && (node.attrs?.textAlign ?? null) === align
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

test('las plantillas con pie de firma son CONTRATO_0001 a 0015; México (0016 y 0017) no entra', () => {
  assert.equal(TEMPLATE_CODES.length, 15)
  assert.equal(TEMPLATE_CODES[0], 'CONTRATO_0001')
  assert.equal(TEMPLATE_CODES.at(-1), 'CONTRATO_0015')
  assert.throws(() => rewritePieFirma(fixtures.CONTRATO_0016, 'CONTRATO_0016'), /no está en la tabla/)
})

test('empresa (0002) y persona natural (0007): se agregan 5 párrafos vacíos y el pie del influencer queda vacío', () => {
  for (const code of ['CONTRATO_0002', 'CONTRATO_0007']) {
    const before = fixtures[code].content
    const result = rewritePieFirma(fixtures[code], code)
    assert.equal(result.status, 'applied', code)
    assert.deepEqual(result.applied, ['espacio', 'pie del influencer'], code)
    const after = result.content.content
    assert.equal(after.length, before.length + EXTRA_SPACE_PARAGRAPHS, code)

    const company = after.findIndex((n) => n.type === 'signatureBlock' && n.attrs.party === 'company')
    for (let i = 1; i <= EXTRA_SPACE_PARAGRAPHS + 1; i++) {
      const expectedAlign = i === 1 ? null : 'justify'
      assert.ok(isEmpty(after[company - i], expectedAlign), `${code}: bloque ${company - i} debería ser un párrafo vacío (${expectedAlign})`)
    }
    assert.ok(nodeText(after[company - EXTRA_SPACE_PARAGRAPHS - 2]).length > 20, `${code}: antes del espacio está el último párrafo del contrato`)

    const supplier = after.at(-1)
    assert.equal(supplier.type, 'signatureBlock')
    assert.deepEqual(supplier.attrs, { party: 'supplier', repIndex: null })
    assert.deepEqual(supplier.content, [{ type: 'paragraph', attrs: { textAlign: 'center' } }])
    assert.equal(nodeText(supplier), '')
  }
})

test('el resultado es EXACTAMENTE lo que David dejó a mano en CONTRATO_0001 de producción', () => {
  const edited = fixtures.CONTRATO_0001.content
  // Se reconstruye el «antes» de la 0001 quitando su cambio, y se comprueba que la función lo lleva al mismo contenido.
  const company = edited.findIndex((n) => n.type === 'signatureBlock' && n.attrs.party === 'company')
  const original = structuredClone(edited)
  original.splice(company - 1 - EXTRA_SPACE_PARAGRAPHS, EXTRA_SPACE_PARAGRAPHS)
  original[original.length - 1] = structuredClone(fixtures.CONTRATO_0002.content.at(-1))
  const result = rewritePieFirma({ ...fixtures.CONTRATO_0001, content: original }, 'CONTRATO_0001')
  assert.equal(result.status, 'applied')
  assert.deepEqual(result.content.content, edited)
})

test('la 0001, que David ya editó, queda «ya aplicada» y sin cambios', () => {
  const result = rewritePieFirma(fixtures.CONTRATO_0001, 'CONTRATO_0001')
  assert.equal(result.status, 'already')
  assert.equal(result.replaced, 0)
  assert.deepEqual(result.content, fixtures.CONTRATO_0001)
})

test('solo cambian los bloques del final: el resto de la plantilla queda idéntico (hash)', () => {
  for (const code of ['CONTRATO_0002', 'CONTRATO_0007']) {
    const before = fixtures[code]
    const after = rewritePieFirma(before, code).content
    const company = before.content.findIndex((n) => n.type === 'signatureBlock' && n.attrs.party === 'company')
    // Todo lo anterior al párrafo vacío previo a la firma de la empresa, y el bloque de la empresa, no cambian.
    assert.equal(hash(after.content.slice(0, company - 1)), hash(before.content.slice(0, company - 1)), code)
    const afterCompany = after.content.findIndex((n) => n.type === 'signatureBlock' && n.attrs.party === 'company')
    assert.deepEqual(after.content[afterCompany], before.content[company], code)
    assert.deepEqual(after.content[afterCompany + 1], before.content[company + 1], code)
    // Y los atributos del documento.
    assert.equal(after.type, before.type)
  }
})

test('es idempotente y no modifica el objeto de entrada', () => {
  for (const code of ['CONTRATO_0002', 'CONTRATO_0007']) {
    const input = structuredClone(fixtures[code])
    const once = rewritePieFirma(input, code)
    assert.deepEqual(input, fixtures[code], code)
    const twice = rewritePieFirma(once.content, code)
    assert.equal(twice.status, 'already', code)
    assert.deepEqual(twice.content, once.content, code)
  }
})

test('respeta lo ya editado a mano: con espacio propio no agrega más, y con el pie ya vaciado no lo toca', () => {
  // Espacio ya puesto (otra cantidad), pie original: solo se vacía el pie.
  const withSpace = structuredClone(fixtures.CONTRATO_0002)
  const company = withSpace.content.findIndex((n) => n.type === 'signatureBlock' && n.attrs.party === 'company')
  withSpace.content.splice(company - 1, 0, { type: 'paragraph', attrs: { textAlign: 'justify' } }, { type: 'paragraph', attrs: { textAlign: 'justify' } })
  const a = rewritePieFirma(withSpace, 'CONTRATO_0002')
  assert.deepEqual(a.applied, ['pie del influencer'])
  assert.equal(a.content.content.length, withSpace.content.length)

  // Pie ya vaciado, sin espacio: solo se agrega el espacio.
  const emptied = structuredClone(fixtures.CONTRATO_0002)
  emptied.content[emptied.content.length - 1] = { type: 'signatureBlock', attrs: { party: 'supplier', repIndex: null }, content: [{ type: 'paragraph', attrs: { textAlign: 'center' } }] }
  const b = rewritePieFirma(emptied, 'CONTRATO_0002')
  assert.deepEqual(b.applied, ['espacio'])
})

test('si el final de la plantilla no tiene la estructura esperada, no se toca y se informa', () => {
  const noSupplier = structuredClone(fixtures.CONTRATO_0002)
  noSupplier.content.pop()
  const a = rewritePieFirma(noSupplier, 'CONTRATO_0002')
  assert.equal(a.status, 'excluded')
  assert.deepEqual(a.content, noSupplier)

  const altered = structuredClone(fixtures.CONTRATO_0002)
  altered.content[altered.content.length - 1].content[0].content[0].text = 'Firma del proveedor'
  const b = rewritePieFirma(altered, 'CONTRATO_0002')
  assert.equal(b.status, 'excluded')
  assert.match(b.reason, /no es el original ni está vaciado/)

  const noCompany = structuredClone(fixtures.CONTRATO_0007)
  noCompany.content = noCompany.content.filter((n) => !(n.type === 'signatureBlock' && n.attrs.party === 'company'))
  assert.equal(rewritePieFirma(noCompany, 'CONTRATO_0007').status, 'excluded')
})
