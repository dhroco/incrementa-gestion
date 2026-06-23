const { sendOk, sendError } = require('../http/responses')
const platformUsersAdminService = require('../services/platformUsersAdminService')

function createPlatformUsersController({ platformUsersService = platformUsersAdminService } = {}) {
  return {
    getRoleOptions: async (req, res) => {
      const userId = req?.auth?.userId
      const result = await platformUsersService.listAssignableRolesForAdmin({ userId })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    getList: async (req, res) => {
      const userId = req?.auth?.userId
      const q = req?.query?.q ?? ''
      const result = await platformUsersService.listPlatformUsersForAdmin({ userId, q })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    getDetail: async (req, res) => {
      const userId = req?.auth?.userId
      const id = req?.params?.id
      const result = await platformUsersService.getPlatformUserDetailForAdmin({ userId, platformUserProfileId: id })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    postCreate: async (req, res) => {
      const userId = req?.auth?.userId
      const result = await platformUsersService.createPlatformUser({ userId, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data, { status: result.status ?? 201 })
    },

    putUpdate: async (req, res) => {
      const userId = req?.auth?.userId
      const id = req?.params?.id
      const result = await platformUsersService.updatePlatformUser({ userId, platformUserProfileId: id, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    }
  }
}

module.exports = { createPlatformUsersController }
