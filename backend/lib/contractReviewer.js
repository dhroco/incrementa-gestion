const Anthropic = require('@anthropic-ai/sdk').Anthropic
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod')
const z = require('zod/v4')
const config = require('../config')

const REVIEW_MODEL = 'claude-opus-5'

const REVIEW_UNAVAILABLE_MESSAGE = 'No se pudo revisar la redacción.'

const REVIEW_SYSTEM = [
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

const ReviewSchema = z.object({
  verdict: z.enum(['ok', 'observaciones']),
  observations: z.array(
    z.object({
      dynamicTextId: z.string(),
      clause: z.string(),
      problem: z.string(),
      suggestion: z.string()
    })
  )
})

class ContractReviewerError extends Error {
  constructor() {
    super(REVIEW_UNAVAILABLE_MESSAGE)
    this.name = 'ContractReviewerError'
    this.code = 'REVIEW_UNAVAILABLE'
  }
}

function hasApiKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.trim() !== ''
}

function isReviewerConfigured() {
  return hasApiKey(config.ANTHROPIC_API_KEY)
}

function createContractReviewer({ apiKey, client } = {}) {
  const resolvedKey = apiKey !== undefined ? apiKey : config.ANTHROPIC_API_KEY
  const keyPresent = hasApiKey(resolvedKey)
  const resolvedClient = client != null ? client : keyPresent ? new Anthropic({ apiKey: resolvedKey }) : null

  function reviewerIsConfigured() {
    return resolvedClient != null
  }

  async function review({ sectionText, dynamicTexts, datos }) {
    if (!reviewerIsConfigured()) {
      throw new ContractReviewerError()
    }

    let response
    try {
      response = await resolvedClient.messages.parse({
        model: REVIEW_MODEL,
        max_tokens: 16000,
        system: REVIEW_SYSTEM,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({ sectionText, dynamicTexts, datos })
          }
        ],
        output_config: { format: zodOutputFormat(ReviewSchema) }
      })
    } catch (err) {
      if (err instanceof ContractReviewerError) throw err
      throw new ContractReviewerError()
    }

    if (response?.stop_reason === 'refusal' || response?.parsed_output == null) {
      throw new ContractReviewerError()
    }

    const observations = Array.isArray(response.parsed_output.observations)
      ? response.parsed_output.observations
      : []
    const verdict = observations.length > 0 ? 'observaciones' : 'ok'
    const model =
      typeof response.model === 'string' && response.model.trim() !== '' ? response.model : REVIEW_MODEL

    return {
      verdict,
      observations: verdict === 'ok' ? [] : observations,
      model
    }
  }

  return {
    isReviewerConfigured: reviewerIsConfigured,
    review
  }
}

module.exports = {
  createContractReviewer,
  isReviewerConfigured,
  ContractReviewerError,
  REVIEW_SYSTEM,
  REVIEW_MODEL
}
