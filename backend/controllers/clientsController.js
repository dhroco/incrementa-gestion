const { sendOk, sendError } = require('../http/responses')
const clientService = require('../services/clientService')

function createClientsController({ service = clientService, getUserProfileIdByUserId } = {}) {
  async function requireActorUserProfileId(req, res) {
    const userId = req.auth?.userId
    if (!userId) {
      sendError(res, {
        status: 401,
        code: 'AUTH_MISSING_TOKEN',
        message: 'No autorizado. Falta token de acceso.'
      })
      return null
    }
    if (!getUserProfileIdByUserId) return userId
    const userProfileId = await getUserProfileIdByUserId(userId)
    if (!userProfileId) {
      sendError(res, {
        status: 403,
        code: 'PROFILE_NOT_ASSIGNED',
        message: 'No tiene un perfil interno asignado. Contacte al administrador del sistema.'
      })
      return null
    }
    return userProfileId
  }

  return {
    getList: async (req, res) => {
      const search = typeof req.query?.search === 'string' ? req.query.search : ''
      const result = await service.listClients({ search })
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 500,
          code: result.code ?? 'CLIENT_LIST_FAILED',
          message: result.message ?? 'No se pudo obtener el listado de clientes.'
        })
      }
      return sendOk(res, result.data)
    },

    getDetail: async (req, res) => {
      const result = await service.getClientById(req.params?.id)
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 404,
          code: result.code ?? 'NOT_FOUND',
          message: result.message ?? 'Cliente no encontrado.'
        })
      }
      return sendOk(res, result.data)
    },

    postCreate: async (req, res) => {
      const userId = await requireActorUserProfileId(req, res)
      if (userId == null) return
      const result = await service.createClient({ payload: req.body, userId })
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 400,
          code: result.code ?? 'VALIDATION_ERROR',
          message: result.message ?? 'No se pudo crear el cliente.'
        })
      }
      return sendOk(res, result.data, { status: 201 })
    },

    putUpdate: async (req, res) => {
      const userId = await requireActorUserProfileId(req, res)
      if (userId == null) return
      const result = await service.updateClient(req.params?.id, { payload: req.body, userId })
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 400,
          code: result.code ?? 'VALIDATION_ERROR',
          message: result.message ?? 'No se pudo actualizar el cliente.'
        })
      }
      return sendOk(res, result.data)
    }
  }
}

module.exports = { createClientsController }
