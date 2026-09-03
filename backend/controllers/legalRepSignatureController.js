const multerLib = require('multer')
const { sendOk, sendError } = require('../http/responses')

const MAX_SIGNATURE_BYTES = 500 * 1024

function createSignatureUploadRouteHandler() {
  const upload = multerLib({
    storage: multerLib.memoryStorage(),
    limits: { fileSize: MAX_SIGNATURE_BYTES }
  }).single('signature')

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (!err) return next()

      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'La imagen no puede superar 500 KB.'
        })
      }

      return sendError(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe enviar una imagen PNG.'
      })
    })
  }
}

function createLegalRepSignatureController({ service, userProfileIdResolver } = {}) {
  if (!service) throw new Error('legalRepSignatureService is required')
  if (!userProfileIdResolver) throw new Error('userProfileIdResolver is required')

  return {
    postSignature: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.params?.id
      const repIndex = req?.params?.repIndex

      const file = req.file
      if (!file?.buffer) {
        return sendError(res, { status: 400, code: 'VALIDATION_ERROR', message: 'Debe enviar una imagen PNG.' })
      }

      const userProfileId = await userProfileIdResolver(userId)
      if (!userProfileId) {
        return sendError(res, { status: 404, code: 'PROFILE_NOT_FOUND', message: 'No se encontró el perfil del usuario.' })
      }

      const result = await service.uploadSignature({
        companyId,
        repIndex,
        userProfileId,
        signatureBuffer: file.buffer
      })

      if (!result.ok) {
        return sendError(res, {
          status: result.status,
          code: result.code,
          message: result.message
        })
      }

      return sendOk(res, result.data)
    },

    deleteSignature: async (req, res) => {
      const companyId = req?.params?.id
      const repIndex = req?.params?.repIndex

      const result = await service.deleteSignature({ companyId, repIndex })

      if (!result.ok) {
        return sendError(res, {
          status: result.status,
          code: result.code,
          message: result.message
        })
      }

      return sendOk(res, {})
    }
  }
}

module.exports = { createLegalRepSignatureController, createSignatureUploadRouteHandler }

