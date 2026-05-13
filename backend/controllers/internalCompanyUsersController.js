const { sendOk, sendError } = require('../http/responses')
const internalCompanyUsersService = require('../services/internalCompanyUsersService')

function createInternalCompanyUsersController({
  internalUsersService = internalCompanyUsersService
} = {}) {
  return {
    getList: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const q = req?.query?.q ?? ''
      const result = await internalUsersService.listInternalCompanyUsers({ userId, companyId, q })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    getDetail: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const profileId = req?.params?.id
      const result = await internalUsersService.getInternalCompanyUserDetail({ userId, companyId, profileId })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    postCreate: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const result = await internalUsersService.createInternalCompanyUser({ userId, companyId, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data, { status: result.status || 201 })
    },

    putUpdate: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const profileId = req?.params?.id
      const result = await internalUsersService.updateInternalCompanyUser({
        userId,
        companyId,
        profileId,
        payload: req.body
      })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    }
  }
}

module.exports = { createInternalCompanyUsersController }
