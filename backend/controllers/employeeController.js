const { sendOk, sendError } = require('../http/responses')
const employeeService = require('../services/employeeService')

function createEmployeeController({ service = employeeService } = {}) {
  return {
    getList: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const q = req?.query?.q ?? ''
      const result = await service.listEmployees({ userId, companyId, q })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    getLookup: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const result = await service.listLookups({ userId, companyId })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    getDetail: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const employeeId = req?.params?.id
      const result = await service.getEmployeeById({ userId, companyId, employeeId })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    postCreate: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const result = await service.createEmployee({ userId, companyId, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data, { status: 201 })
    },

    putUpdate: async (req, res) => {
      const userId = req?.auth?.userId
      const companyId = req?.query?.companyId
      const employeeId = req?.params?.id
      const result = await service.updateEmployee({ userId, companyId, employeeId, payload: req.body })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    }
  }
}

module.exports = { createEmployeeController }
