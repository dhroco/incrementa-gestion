const { sendOk, sendError } = require('../http/responses')
const config = require('../config')
const { contractSigningService } = require('../services/contractSigningService')
const { getUserProfileIdByUserId } = require('../services/profileService')

const USE_FIRME_FLOW = 'Este contrato se firma con Firme: use «Aprobar y enviar a firma».'
const FIRMA_BLOQUEADA = 'La firma está deshabilitada en producción hasta que se configure Firme.'

function createContractSigningController({
  service = contractSigningService,
  userProfileIdResolver = getUserProfileIdByUserId,
  firmeSigningService = null
} = {}) {
  return {
    getList: async (req, res) => {
      const result = await service.listPendingSignature()
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 500,
          code: result.code ?? 'LIST_FAILED',
          message: result.message ?? 'No se pudo obtener el listado de contratos pendientes.'
        })
      }
      const items = []
      for (const item of result.data?.items || []) {
        const signingMode = firmeSigningService
          ? await firmeSigningService.getSigningMode(item.id)
          : 'internal'
        items.push({ ...item, signing_mode: signingMode })
      }
      return sendOk(res, { items }, { meta: { email_enabled: Boolean(config.RESEND_API_KEY) } })
    },

    postSign: async (req, res) => {
      const signerUserProfileId = await userProfileIdResolver(req.auth.userId)
      if (!signerUserProfileId) {
        return sendError(res, {
          status: 404,
          code: 'PROFILE_NOT_FOUND',
          message: 'No se encontró un perfil de usuario activo para firmar.'
        })
      }

      if (firmeSigningService) {
        const mode = await firmeSigningService.getSigningMode(req.params?.id)
        if (mode === 'firme') {
          return sendError(res, { status: 409, code: 'USE_FIRME_FLOW', message: USE_FIRME_FLOW })
        }
        if (mode === 'blocked') {
          return sendError(res, { status: 409, code: 'FIRMA_BLOQUEADA', message: FIRMA_BLOQUEADA })
        }
      }

      const result = await service.signContract({
        draftDocumentId: req.params?.id,
        signerUserProfileId
      })

      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 500,
          code: result.code ?? 'SIGN_FAILED',
          message: result.message ?? 'No se pudo firmar el contrato.'
        })
      }

      return sendOk(res, result.data)
    }
  }
}

module.exports = { createContractSigningController }
