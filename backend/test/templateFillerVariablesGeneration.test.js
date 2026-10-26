const test = require('node:test')
const assert = require('node:assert/strict')

const fixtures = require('./fixtures/plantillas-relleno.json')
const { rewriteFillerVariables, TEMPLATE_CODES } = require('../utils/templateFillerVariables')
const {
  preprocessMissingFieldOverrides,
  validateCantidadOverrides,
  getVariableMeta,
  buildMissingFields,
  CANTIDAD_VARIABLES
} = require('../services/documentBuilderService')
const { buildSubstitutionMap, applySubstitutionsToTipTapDoc } = require('../services/documentBuilderVariableContext')

const OVERRIDES = {
  dias_no_competencia: '30',
  activaciones_cantidad: '2',
  activaciones_horas: '4',
  activaciones_antelacion_dias: '10',
  vigencia_meses: '6',
  meses_cesion: '12',
  dias_boost: '45'
}

function plainText(node) {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(plainText).join('')
}

function generate(code, overrides) {
  const { content } = rewriteFillerVariables(fixtures[code], code)
  const map = buildSubstitutionMap(
    { supplier_type: 'persona_natural', full_name: 'Ana Pérez' },
    { short_name: 'Incrementa' },
    { name: 'Cliente Ejemplo SpA', brand: 'MarcaX' },
    preprocessMissingFieldOverrides(overrides, { currencyCode: 'CLP' })
  )
  return plainText(applySubstitutionsToTipTapDoc(content, map))
}

test('al generar un contrato de cada plantilla no queda ningún texto de relleno ni variable sin resolver', () => {
  for (const code of TEMPLATE_CODES) {
    const text = generate(code, OVERRIDES)
    assert.equal(/\(Cantidad|\(Número|\(Nombre cliente|Cantidad de veces/.test(text), false, `${code} conserva relleno`)
    assert.equal(/\{\{/.test(text), false, `${code} tiene variables sin resolver`)
    assert.match(text, /por un plazo de treinta \(30\) días (corridos|naturales)/, code)
  }
})

test('las cláusulas quedan con el texto esperado (CONTRATO_0003 y CONTRATO_0017)', () => {
  const t3 = generate('CONTRATO_0003', OVERRIDES)
  assert.match(t3, /2\.12 Las Activaciones Presenciales comprenderán un máximo de dos \(2\) participaciones presenciales/)
  assert.match(t3, /duración máxima de cuatro \(4\) horas efectivas/)
  assert.match(t3, /antelación mínima de diez \(10\) días naturales/)

  const t17 = generate('CONTRATO_0017', OVERRIDES)
  assert.match(t17, /fue desarrollado por su Cliente Ejemplo SpA \(en adelante/)
  assert.match(t17, /vigencia de seis \(6\) meses contados/)
  assert.match(t17, /determinado de doce \(12\) meses, contados/)
  assert.match(t17, /antelación mínima de diez \(10\) días naturales/)

  const t16 = generate('CONTRATO_0016', OVERRIDES)
  assert.match(t16, /período máximo de cuarenta y cinco \(45\) días corridos/)
})

test('el género concuerda con el sustantivo fijo (participaciones y horas son femeninos)', () => {
  const text = generate('CONTRATO_0003', { ...OVERRIDES, activaciones_cantidad: '1', activaciones_horas: '21', dias_no_competencia: '21' })
  assert.match(text, /un máximo de una \(1\) participaciones/)
  assert.match(text, /máxima de veintiuna \(21\) horas efectivas/)
  assert.match(text, /plazo de veintiún \(21\) días corridos/)
})

test('las variables nuevas son números del contrato y el MCP las pide como campos faltantes', () => {
  for (const key of Object.keys(CANTIDAD_VARIABLES)) {
    const meta = getVariableMeta(key)
    assert.equal(meta.type, 'number', key)
    assert.equal(meta.source, 'contract', key)
  }
  const fields = buildMissingFields(['dias_no_competencia', 'activaciones_horas'])
  assert.deepEqual(
    fields.map((f) => ({ key: f.key, type: f.type, source: f.source })),
    [
      { key: 'dias_no_competencia', type: 'number', source: 'contract' },
      { key: 'activaciones_horas', type: 'number', source: 'contract' }
    ]
  )
})

test('validateCantidadOverrides acepta enteros positivos y rechaza lo demás con un mensaje en español', () => {
  assert.deepEqual(validateCantidadOverrides({ dias_no_competencia: '30', vigencia_meses: 6 }), { ok: true })
  assert.deepEqual(validateCantidadOverrides({}), { ok: true })
  assert.deepEqual(validateCantidadOverrides({ dias_no_competencia: '' }), { ok: true })
  for (const bad of ['30 días', '0', '-1', '2,5', 'treinta']) {
    const result = validateCantidadOverrides({ activaciones_horas: bad })
    assert.equal(result.ok, false, bad)
    assert.equal(result.status, 400)
    assert.equal(result.code, 'VALIDATION_ERROR')
    assert.match(result.message, /Horas máximas por activación debe ser un número entero mayor que cero/)
  }
})
