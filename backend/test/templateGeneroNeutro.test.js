const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-genero-neutro.json')
const { rewriteGeneroNeutro, TEMPLATE_CODES } = require('../utils/templateGeneroNeutro')

function nodeText(node) {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') return `{{${node.attrs.variableId}}}`
  return (node.content ?? []).map(nodeText).join('')
}
const texts = (doc) => doc.content.map(nodeText)
const full = (doc) => texts(doc).join('\n')
const changedIndexes = (before, after) => after.content.map((n, i) => (JSON.stringify(n) === JSON.stringify(before.content[i]) ? -1 : i)).filter((i) => i >= 0)
const range = (a, b) => TEMPLATE_CODES.slice(a - 1, b)

test('hay un fixture real por cada una de las 17 plantillas', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), [...TEMPLATE_CODES].sort())
})

test('ya no queda «esta último» ni «de don {{representante}}» en ninguna plantilla', () => {
  for (const code of TEMPLATE_CODES) {
    const before = full(fixtures[code])
    const { content } = rewriteGeneroNeutro(fixtures[code], code)
    const after = full(content)
    assert.match(before, /esta último prestará/, code)
    assert.equal(/esta último/.test(after), false, code)
    assert.match(after, /en virtud de la cual el Influencer prestará servicios de generación de contenido/, code)
    assert.match(before, /La person(?:ería|alidad) de don \{\{company_legal_rep1_name\}\}/, code)
    assert.match(after, /La person(?:ería|alidad) de \{\{company_legal_rep1_name\}\}, para representar a/, code)
    assert.match(after, /otorgada en la Notaria de Santiago de don Álvaro González Salinas/, code)
  }
})

test('persona natural chilena (0007 a 0015) y mexicana (0016 y 0017): «con domicilio» en vez de domiciliado/a', () => {
  for (const code of range(7, 15)) {
    const { content } = rewriteGeneroNeutro(fixtures[code], code)
    assert.match(full(content), /cédula de identidad N° \{\{proveedor_rut\}\}, con domicilio para estos efectos en general \{\{proveedor_direccion\}\}/, code)
    assert.equal(/domiciliado para/.test(full(content)), false, code)
  }
  for (const code of range(16, 17)) {
    const { content } = rewriteGeneroNeutro(fixtures[code], code)
    assert.match(full(content), /RFC \{\{proveedor_rut\}\}, con domicilio en \{\{proveedor_direccion\}\}/, code)
    assert.equal(/domiciliada en/.test(full(content)), false, code)
  }
})

test('0007 a 0009 quedan con «el “Influencer”», igual que 0010 a 0015', () => {
  for (const code of range(7, 9)) {
    assert.match(texts(fixtures[code])[6], /en adelante la “Influencer”/, code)
    const { content } = rewriteGeneroNeutro(fixtures[code], code)
    assert.match(texts(content)[6], /en adelante el “Influencer”\.$/, code)
    assert.equal(content.content[6].content.at(-2).marks?.[0]?.type, 'bold', code)
  }
})

test('las plantillas de empresa no cambian su «ambos domiciliados» ni su «la Influencer»', () => {
  for (const code of range(1, 6)) {
    const { content } = rewriteGeneroNeutro(fixtures[code], code)
    assert.match(texts(content)[6], /ambos domiciliados para estos efectos en/, code)
    assert.match(texts(content)[6], /en adelante la “Influencer”/, code)
  }
})

test('solo cambian las frases previstas: cada plantilla cambia los párrafos esperados y nada más', () => {
  for (const code of TEMPLATE_CODES) {
    const { content, applied } = rewriteGeneroNeutro(fixtures[code], code)
    const changed = changedIndexes(fixtures[code], content)
    assert.equal(content.content.length, fixtures[code].content.length, code)
    const expectedApplied = 2 + (range(7, 17).includes(code) ? 1 : 0)
    assert.ok(applied.length >= expectedApplied, `${code} ${applied.join(',')}`)
    // 2.1, intro (7 a 17), personería: como máximo 3 párrafos distintos
    assert.ok(changed.length <= 3 && changed.length >= 2, `${code} cambió ${changed.length} párrafos`)
  }
})

test('es idempotente y no modifica el objeto de entrada', () => {
  for (const code of TEMPLATE_CODES) {
    const input = structuredClone(fixtures[code])
    const once = rewriteGeneroNeutro(input, code)
    assert.deepEqual(input, fixtures[code], code)
    const twice = rewriteGeneroNeutro(once.content, code)
    assert.equal(twice.replaced, 0, code)
    assert.deepEqual(twice.content, once.content, code)
  }
})

test('si una frase ya se editó a mano, esa regla no hace nada y las demás sí', () => {
  const doc = structuredClone(fixtures.CONTRATO_0010)
  const intro = doc.content[6]
  intro.content = intro.content.map((n) => (n.type === 'text' ? { ...n, text: n.text.replace('domiciliado para estos efectos', 'con domicilio para estos efectos') } : n))
  const result = rewriteGeneroNeutro(doc, 'CONTRATO_0010')
  assert.equal(result.applied.includes('domiciliado'), false)
  assert.equal(result.applied.includes('2.1 «esta último»'), true)
})

test('si una frase aparece más de una vez, se detiene', () => {
  const doc = structuredClone(fixtures.CONTRATO_0001)
  doc.content.push(structuredClone(doc.content.find((n) => /esta último prestará/.test(nodeText(n)))))
  assert.throws(() => rewriteGeneroNeutro(doc, 'CONTRATO_0001'), /aparece 2 veces/)
  assert.throws(() => rewriteGeneroNeutro(fixtures.CONTRATO_0001, 'PL0001'), /no está en la tabla/)
})
