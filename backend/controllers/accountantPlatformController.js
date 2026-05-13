const { sendOk, sendError } = require('../http/responses')
const accountantAdminService = require('../services/accountantAdminService')

function createAccountantPlatformController({ accountantService = accountantAdminService } = {}) {
  return {
    getList: async (req, res) => {
      const userId = req?.auth?.userId
      const q = req?.query?.q ?? ''
      const result = await accountantService.listAccountantsForAdmin({ userId, q })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    getDetail: async (req, res) => {
      const userId = req?.auth?.userId
      const id = req?.params?.id
      const result = await accountantService.getAccountantDetailForAdmin({ userId, accountantUserProfileId: id })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    postCreate: async (req, res) => {
      const userId = req?.auth?.userId
      const result = await accountantService.createAccountant({ userId, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data, { status: result.status ?? 201 })
    },

    putUpdate: async (req, res) => {
      const userId = req?.auth?.userId
      const id = req?.params?.id
      const result = await accountantService.updateAccountant({ userId, accountantUserProfileId: id, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    postPasswordRotationComplete: async (req, res) => {
      const userId = req?.auth?.userId
      const result = await accountantService.completePasswordRotation({ userId })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    }
  }
}

module.exports = { createAccountantPlatformController }
