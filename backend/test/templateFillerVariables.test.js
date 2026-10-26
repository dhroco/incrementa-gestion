const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-relleno.json')
const {
  rewriteFillerVariables,
  TEMPLATE_CODES,
  EXPECTED_VARIABLES
} = require('../utils/templateFillerVariables')

function nodeText(node, variables = true) {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') return variables ? `{{${node.attrs.variableId}}}` : ''
  return (node.content ?? []).map((child) => nodeText(child, variables)).join('')
}

function paragraphStartingWith(doc, clause) {
  return doc.content.find((p) => nodeText(p).startsWith(`${clause} `))
}

const LEFTOVER = /\((?:Cantidad|Número|Nombre cliente)[^)]*\)|Cantidad de veces en números\)/

test('hay un fixture real por cada plantilla de la tabla', () => {
  assert.deepEqual(Object.keys(fixtures).sort(), [...TEMPLATE_CODES].sort())
  assert.equal(TEMPLATE_CODES.length, 17)
})

test('en las 17 plantillas no queda ningún texto de relleno y quedan las variables esperadas', () => {
  for (const code of TEMPLATE_CODES) {
    const { content, replaced } = rewriteFillerVariables(fixtures[code], code)
    assert.ok(replaced > 0, `${code} debe cambiar`)
    assert.equal(LEFTOVER.test(nodeText(content)), false, `${code} conserva texto de relleno`)

    const counts = {}
    const walk = (node) => {
      if (node.type === 'variable') counts[node.attrs.variableId] = (counts[node.attrs.variableId] ?? 0) + 1
      ;(node.content ?? []).forEach(walk)
    }
    walk(content)
    for (const [variableId, expected] of Object.entries(EXPECTED_VARIABLES[code])) {
      assert.equal(counts[variableId], expected, `${code}: ${variableId}`)
    }
  }
})

test('no borra ni mueve cláusulas: mismos párrafos, mismo orden y solo cambia el relleno', () => {
  for (const code of TEMPLATE_CODES) {
    const before = fixtures[code]
    const { content: after } = rewriteFillerVariables(before, code)
    assert.equal(after.content.length, before.content.length, `${code}: cambió la cantidad de párrafos`)
    before.content.forEach((paragraph, index) => {
      // El número de cláusula (primer nodo, en negrita) y los atributos del párrafo no cambian.
      assert.deepEqual(after.content[index].attrs, paragraph.attrs)
      assert.deepEqual(after.content[index].content[0], paragraph.content[0])
      // El texto que no es relleno se conserva idéntico: quitando variables y relleno, queda lo mismo.
      const strip = (text) =>
        text
          .replace(/\{\{[a-z_]+\}\}/g, '')
          .replace(/\([^)]*(?:Cantidad|Número|Nombre cliente)[^)]*\)/g, '')
          .replace(/Cantidad de veces en números\)/g, '')
          .replace(/(?<=por un plazo de )30(?= días corridos)/g, '')
          .replace(/\s+/g, ' ')
      assert.equal(strip(nodeText(after.content[index])), strip(nodeText(paragraph)), `${code} párrafo ${index}`)
    })
  }
})

test('texto antes y después de cada cláusula (CONTRATO_0003, con evento)', () => {
  const before = fixtures.CONTRATO_0003
  const { content: after } = rewriteFillerVariables(before, 'CONTRATO_0003')

  assert.match(nodeText(paragraphStartingWith(before, '2.8')), /por un plazo de 30 días corridos contados/)
  assert.match(
    nodeText(paragraphStartingWith(after, '2.8')),
    /por un plazo de \{\{dias_no_competencia\}\} días corridos contados/
  )

  assert.match(
    nodeText(paragraphStartingWith(before, '2.11')),
    /por un plazo de \(Cantidad en letras\) \(Cantidad en números\) días naturales/
  )
  assert.match(
    nodeText(paragraphStartingWith(after, '2.11')),
    /por un plazo de \{\{dias_no_competencia\}\} días naturales/
  )

  assert.match(
    nodeText(paragraphStartingWith(after, '2.12')),
    /un máximo de \{\{activaciones_cantidad\}\} participaciones presenciales.*máxima de \{\{activaciones_horas\}\} horas efectivas/
  )
  assert.match(
    nodeText(paragraphStartingWith(after, '2.14')),
    /antelación mínima de \{\{activaciones_antelacion_dias\}\} días naturales/
  )
})

test('CONTRATO_0017 reemplaza las seis cláusulas y corrige la errata del paréntesis de la 2.11', () => {
  const before = fixtures.CONTRATO_0017
  const { content: after } = rewriteFillerVariables(before, 'CONTRATO_0017')

  assert.match(nodeText(paragraphStartingWith(before, '2.11')), /\(Cantidad de veces en letras\) Cantidad de veces en números\) días/)
  assert.match(nodeText(paragraphStartingWith(after, '2.11')), /antelación mínima de \{\{activaciones_antelacion_dias\}\} días naturales/)

  assert.match(nodeText(paragraphStartingWith(after, '1.1')), /fue desarrollado por su \{\{client_name\}\} \(en adelante/)
  assert.match(nodeText(paragraphStartingWith(after, '2.7')), /por un plazo de \{\{dias_no_competencia\}\} días naturales/)
  assert.match(nodeText(paragraphStartingWith(after, '2.9')), /\{\{activaciones_cantidad\}\} participaciones.*\{\{activaciones_horas\}\} horas efectivas/)
  assert.match(nodeText(paragraphStartingWith(after, '4.1')), /vigencia de \{\{vigencia_meses\}\} meses contados/)
  assert.match(nodeText(paragraphStartingWith(after, '6.4')), /determinado de \{\{meses_cesion\}\} meses, contados/)
})

test('CONTRATO_0016 reemplaza los días de boost y no tiene activaciones', () => {
  const { content } = rewriteFillerVariables(fixtures.CONTRATO_0016, 'CONTRATO_0016')
  assert.match(nodeText(paragraphStartingWith(content, '2.4')), /período máximo de \{\{dias_boost\}\} días corridos/)
  assert.equal(/activaciones_/.test(nodeText(content)), false)
})

test('en las plantillas sin evento la cláusula 2.8 lleva la variable de los 30 días', () => {
  for (const code of ['CONTRATO_0001', 'CONTRATO_0002', 'CONTRATO_0004', 'CONTRATO_0005', 'CONTRATO_0007', 'CONTRATO_0008', 'CONTRATO_0010', 'CONTRATO_0011', 'CONTRATO_0013', 'CONTRATO_0014']) {
    const { content } = rewriteFillerVariables(fixtures[code], code)
    assert.match(
      nodeText(paragraphStartingWith(content, '2.8')),
      /por un plazo de \{\{dias_no_competencia\}\} días corridos contados/,
      code
    )
  }
})

test('el nodo variable queda con el formato de las demás variables del contrato', () => {
  const { content } = rewriteFillerVariables(fixtures.CONTRATO_0003, 'CONTRATO_0003')
  const node = paragraphStartingWith(content, '2.12').content.find((n) => n.type === 'variable')
  assert.deepEqual(node, {
    type: 'variable',
    attrs: {
      bold: false,
      group: 'contrato',
      label: 'Cantidad máxima de activaciones',
      italic: false,
      underline: false,
      uppercase: false,
      variableId: 'activaciones_cantidad'
    }
  })
  const cliente = paragraphStartingWith(rewriteFillerVariables(fixtures.CONTRATO_0017, 'CONTRATO_0017').content, '1.1')
    .content.find((n) => n.type === 'variable' && n.attrs.variableId === 'client_name')
  assert.equal(cliente.attrs.group, 'client')
  assert.equal(cliente.attrs.label, 'Nombre Cliente')
})

test('es idempotente: una segunda pasada no cambia nada', () => {
  for (const code of TEMPLATE_CODES) {
    const first = rewriteFillerVariables(fixtures[code], code)
    const second = rewriteFillerVariables(first.content, code)
    assert.equal(second.replaced, 0, code)
    assert.deepEqual(second.content, first.content, code)
  }
})

test('no modifica el contenido recibido', () => {
  const copy = structuredClone(fixtures.CONTRATO_0017)
  rewriteFillerVariables(fixtures.CONTRATO_0017, 'CONTRATO_0017')
  assert.deepEqual(fixtures.CONTRATO_0017, copy)
})

test('si un párrafo no tiene el texto esperado, lanza un error y no devuelve nada', () => {
  const altered = structuredClone(fixtures.CONTRATO_0003)
  const clause = paragraphStartingWith(altered, '2.12')
  clause.content[1].text = clause.content[1].text.replace('(Cantidad de horas en letras)', '(Horas en letras)')
  assert.throws(() => rewriteFillerVariables(altered, 'CONTRATO_0003'), /activaciones_horas/)
})

test('lanza un error si la plantilla no está en la tabla', () => {
  assert.throws(() => rewriteFillerVariables(fixtures.CONTRATO_0003, 'PL0001'), /no está en la tabla/)
})

test('lanza un error si el resultado no tiene la cantidad esperada de variables', () => {
  const altered = structuredClone(fixtures.CONTRATO_0003)
  // Quita el párrafo 2.11: ya no hay dos cláusulas de no competencia.
  altered.content = altered.content.filter((p) => !nodeText(p).startsWith('2.11 '))
  assert.throws(() => rewriteFillerVariables(altered, 'CONTRATO_0003'), /dias_no_competencia/)
})
