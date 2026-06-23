const { sendOk, sendError } = require('../http/responses')
const rolesServiceDefault = require('../services/rolesService')

function createRolesController({ rolesService = rolesServiceDefault } = {}) {
  return {
    getList: async (req, res) => {
      const result = await rolesService.listRoles()
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    postCreate: async (req, res) => {
      const result = await rolesService.createRole({
        code: req.body?.code,
        label: req.body?.label
      })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data, { status: result.status ?? 201 })
    },

    getById: async (req, res) => {
      const result = await rolesService.getRoleById(req.params.id)
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    putUpdateLabel: async (req, res) => {
      const result = await rolesService.updateRoleLabel({
        roleId: req.params.id,
        label: req.body?.label
      })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    deleteRole: async (req, res) => {
      const result = await rolesService.deleteRole(req.params.id)
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    },

    putPermissions: async (req, res) => {
      const result = await rolesService.replaceRolePermissions({
        roleId: req.params.id,
        permissions: req.body?.permissions
      })
      if (!result.ok) return sendError(res, { status: result.status, code: result.code, message: result.message })
      return sendOk(res, result.data)
    }
  }
}

module.exports = { createRolesController }
