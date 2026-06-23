const { sendOk, sendError } = require('../http/responses')
const { contractSigningService } = require('../services/contractSigningService')
const { getUserProfileIdByUserId } = require('../services/profileService')

function createContractSigningController({
  service = contractSigningService,
  userProfileIdResolver = getUserProfileIdByUserId
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
      return sendOk(res, result.data)
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
