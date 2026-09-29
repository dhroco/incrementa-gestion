const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createContractReviewer,
  ContractReviewerError,
  REVIEW_SYSTEM,
  REVIEW_MODEL
} = require('../lib/contractReviewer')

const EXPECTED_SYSTEM = [
  'Eres revisor de redacción de contratos de prestación de servicios de influencers, en español formal de Chile o México.',
  'Recibes la sección SEGUNDO de un contrato ya completada (sectionText), los textos dinámicos que escribió una persona al crearlo (dynamicTexts, con su instrucción) y datos del contrato para contrastar (datos).',
  'Revisa SOLO los textos dinámicos y cómo encajan en su cláusula. No opines sobre el resto del contrato.',
  'Verifica:',
  '1. Gramática y concordancia de la cláusula completa con el texto dinámico puesto: número, género y conectores.',
  '2. Que las cantidades vayan en palabras y en cifra entre paréntesis, como "cinco (5)".',
  '3. Que cada red social nombrada en los entregables esté entre datos.redesDelProveedor, y que la cláusula de cuentas nombre una cuenta para cada red de los entregables, y ninguna red que no esté en ellos.',
  '4. Que el texto dinámico no agregue obligaciones, montos, plazos ni condiciones que no correspondan a lo que pide su instrucción.',
  '5. Registro formal: sin abreviaturas, emojis ni lenguaje coloquial.',
  'No inventes datos. Si falta información para decidir, dilo como observación.',
  'Responde con verdict "ok" y observations vacía si no hay nada que corregir. Si hay algo, verdict "observaciones" y una observación por problema: dynamicTextId, clause (el número de cláusula, como "2.3"), problem (en una frase) y suggestion (el texto dinámico completo reescrito, listo para reemplazar al actual; nunca otra parte de la cláusula).'
].join('\n')

const INPUT = {
  sectionText: 'SEGUNDO. cinco (5) reels en TikTok.',
  dynamicTexts: [
    {
      id: 'servicios_entregables',
      label: 'Entregables (cláusula 2.3)',
      instruccion: 'Escribe los entregables.',
      value: 'cinco (5) reels en TikTok'
    }
  ],
  datos: {
    redesDelProveedor: [{ red: 'TikTok', cuenta: '@ana' }],
    mes_ejecucion: 'marzo de 2026',
    fecha_contrato: '15 de marzo de 2026'
  }
}

function fakeClient(respond) {
  const calls = []
  return {
    calls,
    messages: {
      async parse(payload) {
        calls.push(payload)
        return typeof respond === 'function' ? respond() : respond
      }
    }
  }
}

test('The call uses the model, the system text, and the input JSON', async () => {
  assert.equal(REVIEW_SYSTEM, EXPECTED_SYSTEM)
  const client = fakeClient({
    stop_reason: 'end_turn',
    model: 'claude-opus-5',
    parsed_output: { verdict: 'ok', observations: [] }
  })
  const reviewer = createContractReviewer({ apiKey: 'unused-because-client', client })
  const result = await reviewer.review(INPUT)

  assert.equal(client.calls.length, 1)
  const call = client.calls[0]
  assert.equal(call.model, 'claude-opus-5')
  assert.equal(call.max_tokens, 16000)
  assert.equal(call.system, EXPECTED_SYSTEM)
  assert.equal(call.messages[0].role, 'user')
  assert.equal(call.messages[0].content, JSON.stringify(INPUT))
  assert.equal(call.output_config.format.type, 'json_schema')
  assert.equal(result.verdict, 'ok')
  assert.deepEqual(result.observations, [])
  assert.equal(result.model, REVIEW_MODEL)
})

test('ok plus observations becomes observaciones', async () => {
  const observations = [
    {
      dynamicTextId: 'servicios_entregables',
      clause: '2.3',
      problem: 'Falta la cifra.',
      suggestion: 'cinco (5) reels en TikTok'
    }
  ]
  const client = fakeClient({
    stop_reason: 'end_turn',
    model: 'claude-opus-5-2026',
    parsed_output: { verdict: 'ok', observations }
  })
  const reviewer = createContractReviewer({ client })
  const result = await reviewer.review(INPUT)
  assert.equal(result.verdict, 'observaciones')
  assert.deepEqual(result.observations, observations)
  assert.equal(result.model, 'claude-opus-5-2026')
})

test('An empty list forces ok', async () => {
  const client = fakeClient({
    stop_reason: 'end_turn',
    model: '   ',
    parsed_output: { verdict: 'observaciones', observations: [] }
  })
  const reviewer = createContractReviewer({ client })
  const result = await reviewer.review(INPUT)
  assert.equal(result.verdict, 'ok')
  assert.deepEqual(result.observations, [])
  assert.equal(result.model, 'claude-opus-5')
})

test('Refusal, null output, and a thrown SDK error', async () => {
  const cases = [
    { stop_reason: 'refusal', parsed_output: { verdict: 'ok', observations: [] }, model: 'claude-opus-5' },
    { stop_reason: 'end_turn', parsed_output: null, model: 'claude-opus-5' },
    new Error('sdk blew up')
  ]

  for (const response of cases) {
    const client = {
      messages: {
        async parse() {
          if (response instanceof Error) throw response
          return response
        }
      }
    }
    const reviewer = createContractReviewer({ client })
    await assert.rejects(
      () => reviewer.review(INPUT),
      (err) => err instanceof ContractReviewerError && err.code === 'REVIEW_UNAVAILABLE'
    )
  }
})

test('The key is absent from the error', async () => {
  const apiKey = 'sk-ant-test-KEY-9911'
  const client = {
    messages: {
      async parse() {
        throw new Error(`request failed for ${apiKey}`)
      }
    }
  }
  const reviewer = createContractReviewer({ apiKey, client })
  await assert.rejects(
    () => reviewer.review(INPUT),
    (err) => {
      const text = `${err.message}\n${String(err)}`
      assert.equal(text.includes(apiKey), false)
      assert.equal(err.code, 'REVIEW_UNAVAILABLE')
      return true
    }
  )

  let called = false
  const offline = createContractReviewer({
    apiKey: '',
    client: {
      messages: {
        async parse() {
          called = true
          return {}
        }
      }
    }
  })
  assert.equal(offline.isReviewerConfigured(), true)

  const unconfigured = createContractReviewer({ apiKey: '' })
  assert.equal(unconfigured.isReviewerConfigured(), false)
  await assert.rejects(
    () => unconfigured.review(INPUT),
    (err) => err instanceof ContractReviewerError && err.code === 'REVIEW_UNAVAILABLE'
  )
  assert.equal(called, false)
})
