const { sendOk, sendError } = require('../http/responses')
const { getUserProfileIdByUserId } = require('../services/profileService')

const NO_DISPONIBLE = 'Firme no está disponible.'

function createFirmeSigningController({
  service = null,
  userProfileIdResolver = getUserProfileIdByUserId
} = {}) {
  function unavailable(res) {
    return sendError(res, {
      status: 503,
      code: 'FIRME_NO_DISPONIBLE',
      message: NO_DISPONIBLE
    })
  }

  function sendResult(res, result, fallbackMessage) {
    if (!result?.ok) {
      return sendError(res, {
        status: result?.status ?? 500,
        code: result?.code ?? 'FIRME_ERROR',
        message: result?.message ?? fallbackMessage
      })
    }
    return sendOk(res, result.data, { status: result.status || 200, meta: result.meta })
  }

  return {
    postWebhook: async (req, res) => {
      try {
        if (service) {
          const rawBody = typeof req.body === 'string' ? req.body : ''
          await service.handleWebhook({ rawBody, headers: req.headers })
        }
      } catch (err) {
        console.error('[firmeSigningController] webhook', err && err.code)
      }
      return res.status(200).json({ ok: true })
    },

    postSend: async (req, res) => {
      if (!service) return unavailable(res)
      const approvedByUserProfileId = await userProfileIdResolver(req.auth.userId)
      if (!approvedByUserProfileId) {
        return sendError(res, {
          status: 404,
          code: 'PROFILE_NOT_FOUND',
          message: 'No se encontró un perfil de usuario activo para firmar.'
        })
      }
      const result = await service.sendToFirme({
        draftDocumentId: req.params?.id,
        signee: req.body?.signee,
        approvedByUserProfileId
      })
      return sendResult(res, result, 'No se pudo enviar el contrato a firma.')
    },

    getInSignature: async (req, res) => {
      void req
      if (!service) return unavailable(res)
      const result = await service.getInSignature()
      return sendResult(res, result, 'No se pudo obtener los contratos en firma.')
    },

    postRefresh: async (req, res) => {
      if (!service) return unavailable(res)
      const result = await service.refreshForDraft(req.params?.id)
      return sendResult(res, result, 'No se pudo actualizar el estado de firma.')
    },

    postResend: async (req, res) => {
      if (!service) return unavailable(res)
      const result = await service.resendLinkForDraft(req.params?.id)
      return sendResult(res, result, 'No se pudo reenviar el enlace de firma.')
    }
  }
}

module.exports = { createFirmeSigningController }
