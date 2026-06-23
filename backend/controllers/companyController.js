const { sendOk, sendError } = require('../http/responses')

function createCompanyController({ companyService }) {
  if (!companyService) throw new Error('companyService is required')

  return {
    getList: async (req, res) => {
      const userId = req?.auth?.userId
      const q = req?.query?.q ?? ''
      const result = await companyService.listCompanies({ userId, q })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    getDetail: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.params?.id
      const result = await companyService.getCompanyDetail({ userId, companyId })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    postCreate: async (req, res) => {
      const userId = req?.auth?.userId
      const result = await companyService.createCompany({ userId, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data, { status: result.status ?? 201 })
    },

    putUpdate: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.params?.id
      const result = await companyService.updateCompany({ userId, companyId, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    }
  }
}

module.exports = { createCompanyController }

