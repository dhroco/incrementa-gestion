const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-clausula-8-1.json')
const { rewriteClausula81, hashWithoutClause, paragraphText, defects, findClause } = require('../utils/templateClausula81')
const { buildSubstitutionMap, applySubstitutionsToTipTapDoc } = require('../services/documentBuilderVariableContext')

const FINAL_SEIKO = [
  '8.1 Dynamics, en representación de Seiko, podrá solicitar al Influencer el retiro, eliminación o despublicación de cualquier contenido generado en virtud del presente contrato, sin necesidad de expresar causa.',
  'El Influencer se obliga a efectuar dicha eliminación dentro del plazo máximo de 24 (veinticuatro) horas contado desde la notificación escrita efectuada por Seiko o Dynamics, la cual podrá realizarse por correo electrónico o mensaje directo a través del medio habitual de comunicación entre las partes.',
  'El ejercicio de este derecho por parte de Seiko o Dynamics no implicará modificación del valor pactado ni compensación adicional, entendiéndose que la remuneración convenida cubre la totalidad de las gestiones asociadas al contenido, incluyendo su eventual eliminación.',
  'En caso de incumplimiento de esta obligación, Seiko o Dynamics podrá poner término inmediato al contrato, sin perjuicio de ejercer las acciones legales correspondientes por los perjuicios causados, incluyendo la exigencia de cumplimiento forzado o la indemnización de daños y perjuicios que dicho incumplimiento pudiera generar.',
  'No obstante, Seiko conservará el derecho de uso, reproducción, difusión o almacenamiento del material para fines internos o publicitarios, de conformidad con la cláusula de Propiedad Intelectual.'
]

function renderClause(content) {
  const { index } = findClause(content.content)
  const map = buildSubstitutionMap(
    { supplier_type: 'persona_natural', full_name: 'Ana Pérez' },
    { short_name: 'Dynamics', nombre_comercial: 'Dynamics' },
    { name: 'Seiko', brand: 'Seiko' },
    { client_product_campaign: 'Seiko' }
  )
  const rendered = applySubstitutionsToTipTapDoc(content, map)
  return rendered.content.slice(index, index + 5).map(paragraphText)
}

test('clase a: las plantillas chilenas (0001 y 0003 con evento) quedan con el texto final esperado', () => {
  for (const code of ['CONTRATO_0001', 'CONTRATO_0003']) {
    const result = rewriteClausula81(fixtures[code])
    assert.equal(result.status, 'applied', code)
    assert.equal(result.category, 'a', code)
    assert.equal(result.after.every((text) => defects(text).length === 0), true, code)
    const { index } = findClause(result.content.content)
    assert.deepEqual(result.content.content.slice(index, index + 5).map(paragraphText), result.after, code)
    assert.equal(result.after.join(' ').includes('con su producto'), false, code)
  }
})

test('al renderizar con cliente Seiko y producto Seiko, la 8.1 es exactamente el texto esperado (sin «Seiko con su producto Seiko»)', () => {
  for (const code of ['CONTRATO_0001', 'CONTRATO_0003', 'CONTRATO_0013']) {
    const { content } = rewriteClausula81(fixtures[code])
    const rendered = renderClause(content).map((text) => text.replace(/\{\{company_nombre_comercial\}\}/g, 'Dynamics'))
    assert.deepEqual(rendered, FINAL_SEIKO, code)
  }
  const before = renderClause(fixtures.CONTRATO_0001).join(' ')
  assert.match(before, /Seiko con su producto Seiko/)
})

test('clase b: la 0013 trae un espacio sobrante al inicio del párrafo 5 y queda EXACTAMENTE como el texto final', () => {
  const { index, paragraphs } = findClause(fixtures.CONTRATO_0013.content)
  assert.ok(index >= 0 && paragraphs)
  assert.match(paragraphText(paragraphs[4]), /^ No obstante, /)
  const result = rewriteClausula81(fixtures.CONTRATO_0013)
  assert.equal(result.status, 'applied')
  assert.equal(result.category, 'b')
  const rewritten = result.content.content.slice(index, index + 5).map(paragraphText)
  assert.deepEqual(rewritten, result.after)
  assert.match(rewritten[4], /^No obstante, \{\{client_brand\}\} conservará/)
})

test('solo cambian los 5 párrafos de la 8.1: el hash del resto de la plantilla es idéntico antes y después', () => {
  for (const code of ['CONTRATO_0001', 'CONTRATO_0003', 'CONTRATO_0013']) {
    const result = rewriteClausula81(fixtures[code])
    assert.equal(hashWithoutClause(result.content), hashWithoutClause(fixtures[code]), code)
    const changed = result.content.content.map((n, i) => (JSON.stringify(n) === JSON.stringify(fixtures[code].content[i]) ? -1 : i)).filter((i) => i >= 0)
    const { index } = findClause(fixtures[code].content)
    assert.deepEqual(changed, [index, index + 1, index + 2, index + 3, index + 4], code)
    assert.equal(result.content.content.length, fixtures[code].content.length, code)
  }
})

test('el formato se conserva: negrita del «8.1 », alineación de los párrafos y variables sin cambios de atributos', () => {
  const { content } = rewriteClausula81(fixtures.CONTRATO_0001)
  const { index } = findClause(content.content)
  const before = findClause(fixtures.CONTRATO_0001.content).paragraphs
  content.content.slice(index, index + 5).forEach((paragraph, i) => {
    assert.deepEqual(paragraph.attrs, before[i].attrs)
  })
  assert.deepEqual(content.content[index].content[0], before[0].content[0])
  const variables = content.content.slice(index, index + 5).flatMap((p) => p.content).filter((n) => n.type === 'variable')
  assert.equal(variables.some((n) => n.attrs.variableId === 'client_product_campaign'), false)
  const original = before.flatMap((p) => p.content).filter((n) => n.type === 'variable' && n.attrs.variableId !== 'client_product_campaign')
  assert.deepEqual(variables, original)
})

test('es idempotente: la segunda pasada no cambia nada', () => {
  for (const code of ['CONTRATO_0001', 'CONTRATO_0003', 'CONTRATO_0013']) {
    const once = rewriteClausula81(fixtures[code])
    const twice = rewriteClausula81(once.content)
    assert.equal(twice.status, 'already', code)
    assert.equal(twice.replaced, 0, code)
    assert.deepEqual(twice.content, once.content, code)
  }
})

test('clase c: México (otra redacción, 8.1 a 8.5) y una plantilla sin la cláusula no se tocan', () => {
  const mexico = rewriteClausula81(fixtures.CONTRATO_0016)
  assert.equal(mexico.status, 'excluded')
  assert.equal(mexico.category, 'c')
  assert.deepEqual(mexico.content, fixtures.CONTRATO_0016)
  assert.match(mexico.current[0], /^8\.1 /)
  assert.match(mexico.current[2], /^8\.3 /)

  const old = rewriteClausula81(fixtures.PL0001)
  assert.equal(old.status, 'excluded')
  assert.deepEqual(old.content, fixtures.PL0001)
  assert.match(old.reason, /no tiene una cláusula 8\.1/)
})

test('si el texto difiere en algo más que espacios (p. ej. otra palabra), no se toca', () => {
  const doc = structuredClone(fixtures.CONTRATO_0001)
  const { index } = findClause(doc.content)
  const p2 = doc.content[index + 1]
  p2.content = p2.content.map((n) => (n.type === 'text' ? { ...n, text: n.text.replace('24 (veinticuatro) horas', '48 (cuarenta y ocho) horas') } : n))
  const result = rewriteClausula81(doc)
  assert.equal(result.status, 'excluded')
  assert.match(result.reason, /algo más que espacios/)
  assert.deepEqual(result.content, doc)
})

test('con «Dynamics» escrito como texto (no como variable) también funciona', () => {
  const doc = structuredClone(fixtures.CONTRATO_0001)
  const { index } = findClause(doc.content)
  for (let i = 0; i < 5; i++) {
    doc.content[index + i].content = doc.content[index + i].content.map((n) =>
      n.type === 'variable' && n.attrs.variableId === 'company_nombre_comercial' ? { type: 'text', text: 'Dynamics' } : n
    )
  }
  const result = rewriteClausula81(doc)
  assert.equal(result.status, 'applied')
  assert.equal(result.content.content.slice(index, index + 5).map(paragraphText).join(' ').includes('con su producto'), false)
  assert.match(paragraphText(result.content.content[index]), /^8\.1 Dynamics, en representación de \{\{client_brand\}\}, podrá/)
})

test('los defectos de ediciones manuales se detectan', () => {
  assert.deepEqual(defects('en representación de en representación de'), ['«en representación de» duplicado'])
  assert.deepEqual(defects('por{{client_brand}}'), ['variable pegada a una palabra'])
  assert.deepEqual(defects('a o o b'), ['«o o»'])
  assert.deepEqual(defects('a  b'), ['espacios dobles'])
  assert.deepEqual(defects('a , b'), ['espacio antes de coma o punto'])
  assert.deepEqual(defects('Seiko con su producto Seiko'), ['«con su producto»'])
  assert.deepEqual(defects(FINAL_SEIKO.join(' ')), [])
})

test('no modifica el objeto de entrada', () => {
  const input = structuredClone(fixtures.CONTRATO_0013)
  rewriteClausula81(input)
  assert.deepEqual(input, fixtures.CONTRATO_0013)
})
