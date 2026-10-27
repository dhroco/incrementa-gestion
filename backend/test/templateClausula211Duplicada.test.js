const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-clausula-2-11.json')
const { removeDuplicateClause211, TEMPLATE_CODES } = require('../utils/templateClausula211Duplicada')

function nodeText(node) {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') return `{{${node.attrs.variableId}}}`
  return (node.content ?? []).map(nodeText).join('')
}

const numbered = (doc) =>
  doc.content
    .map((n) => (n.type === 'paragraph' ? /^2\.(\d+)\s/.exec(nodeText(n)) : null))
    .filter(Boolean)
    .map((m) => Number(m[1]))

test('las cinco plantillas con la 2.11 repetida son las que tienen una no competencia en la 2.8 y la 2.11', () => {
  assert.deepEqual(TEMPLATE_CODES, ['CONTRATO_0003', 'CONTRATO_0006', 'CONTRATO_0009', 'CONTRATO_0012', 'CONTRATO_0015'])
  for (const code of TEMPLATE_CODES) {
    const texts = fixtures[code].content.map(nodeText)
    assert.equal(texts.filter((t) => /^2\.(8|11) Las Partes acuerdan que el Influencer no podrá publicar/.test(t)).length, 2, code)
  }
})

test('se elimina la 2.11 y la 2.8 queda tal cual', () => {
  for (const code of TEMPLATE_CODES) {
    const before = fixtures[code].content.map(nodeText)
    const { content, removed } = removeDuplicateClause211(fixtures[code], code)
    const after = content.content.map(nodeText)
    assert.equal(removed, 1, code)
    assert.equal(after.length, before.length - 1, code)
    assert.equal(after.filter((t) => t.includes('no podrá publicar ni promocionar contenido')).length, 1, code)
    assert.equal(after.some((t) => t.includes('salvo autorización previa y por escrito')), false, code)
    assert.equal(after.find((t) => t.startsWith('2.8 ')), before.find((t) => t.startsWith('2.8 ')), code)
  }
})

test('2.12 a 2.16 pasan a 2.11 a 2.15 con el mismo texto y la numeración queda correlativa', () => {
  for (const code of TEMPLATE_CODES) {
    const before = fixtures[code].content.map(nodeText)
    const { content } = removeDuplicateClause211(fixtures[code], code)
    const after = content.content.map(nodeText)
    assert.deepEqual(numbered(content), Array.from({ length: 15 }, (_, i) => i + 1), code)
    for (let n = 12; n <= 16; n++) {
      const old = before.find((t) => t.startsWith(`2.${n}`))
      assert.equal(after.find((t) => t.startsWith(`2.${n - 1}`) && n - 1 >= 11 && t.slice(`2.${n - 1}`.length) === old.slice(`2.${n}`.length)) !== undefined, true, `${code} 2.${n}`)
    }
  }
})

test('el número sigue en negrita y no cambia nada fuera de los números y de la 2.11', () => {
  for (const code of TEMPLATE_CODES) {
    const { content } = removeDuplicateClause211(fixtures[code], code)
    const removedIndex = fixtures[code].content.findIndex((n) => nodeText(n).startsWith('2.11 '))
    const expected = fixtures[code].content.filter((_, i) => i !== removedIndex)
    content.content.forEach((node, i) => {
      const original = expected[i]
      const num = /^2\.(\d+) /.exec(nodeText(original))
      if (num && Number(num[1]) > 11) {
        assert.deepEqual(node.content[0].marks, original.content[0].marks, code)
        assert.deepEqual({ ...node, content: node.content.slice(1) }, { ...original, content: original.content.slice(1) }, code)
      } else {
        assert.deepEqual(node, original, code)
      }
    })
  }
})

test('las referencias a otras cláusulas («cláusula 2.6», «2.7», «cláusula anterior») no cambian', () => {
  for (const code of TEMPLATE_CODES) {
    const refs = (doc) => doc.content.map(nodeText).filter((t) => /cláusula 2\.\d|cláusula anterior|cláusula 2 /.test(t) && !/^2\.\d+ /.test(t))
    assert.deepEqual(refs(removeDuplicateClause211(fixtures[code], code).content), refs(fixtures[code]), code)
  }
})

test('es idempotente: aplicarla de nuevo no cambia nada', () => {
  for (const code of TEMPLATE_CODES) {
    const once = removeDuplicateClause211(fixtures[code], code)
    const twice = removeDuplicateClause211(once.content, code)
    assert.equal(twice.removed, 0, code)
    assert.deepEqual(twice.content, once.content, code)
  }
})

test('no modifica el objeto de entrada', () => {
  const input = structuredClone(fixtures.CONTRATO_0003)
  removeDuplicateClause211(input, 'CONTRATO_0003')
  assert.deepEqual(input, fixtures.CONTRATO_0003)
})

test('falla si la plantilla no es de las cinco, o si la 2.8 o la 2.11 no son las esperadas', () => {
  assert.throws(() => removeDuplicateClause211(fixtures.CONTRATO_0017, 'CONTRATO_0017'), /no está en la tabla/)
  assert.throws(() => removeDuplicateClause211(fixtures.CONTRATO_0016, 'CONTRATO_0016'), /no está en la tabla/)

  const edit = (code, startsWith, from, to) => {
    const doc = structuredClone(fixtures[code])
    const node = doc.content.find((n) => nodeText(n).startsWith(startsWith))
    node.content = node.content.map((n) => (n.type === 'text' ? { ...n, text: n.text.replace(from, to) } : n))
    return doc
  }
  assert.throws(() => removeDuplicateClause211(edit('CONTRATO_0003', '2.8 ', 'días corridos', 'días hábiles'), 'CONTRATO_0003'), /2\.8/)
  assert.throws(() => removeDuplicateClause211(edit('CONTRATO_0003', '2.11 ', 'días naturales', 'días hábiles'), 'CONTRATO_0003'), /2\.11/)
  assert.throws(() => removeDuplicateClause211(edit('CONTRATO_0006', '2.13', '2.13', '2.14'), 'CONTRATO_0006'), /correlativa/)
})
