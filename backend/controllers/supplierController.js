const { sendOk, sendError } = require('../http/responses')
const supplierService = require('../services/supplierService')

function createSupplierController({ service = supplierService, getUserProfileIdByUserId } = {}) {
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
      const result = await service.listSuppliers({ search })
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 500,
          code: result.code ?? 'SUPPLIER_LIST_FAILED',
          message: result.message ?? 'No se pudo obtener el listado de proveedores.'
        })
      }
      return sendOk(res, result.data)
    },

    getDetail: async (req, res) => {
      const result = await service.getSupplierById(req.params?.id)
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 404,
          code: result.code ?? 'NOT_FOUND',
          message: result.message ?? 'Proveedor no encontrado.'
        })
      }
      return sendOk(res, result.data)
    },

    postCreate: async (req, res) => {
      const userId = await requireActorUserProfileId(req, res)
      if (userId == null) return
      const result = await service.createSupplier({ payload: req.body, userId })
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 400,
          code: result.code ?? 'VALIDATION_ERROR',
          message: result.message ?? 'No se pudo crear el proveedor.'
        })
      }
      return sendOk(res, result.data, { status: 201 })
    },

    putUpdate: async (req, res) => {
      const userId = await requireActorUserProfileId(req, res)
      if (userId == null) return
      const result = await service.updateSupplier(req.params?.id, { payload: req.body, userId })
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 400,
          code: result.code ?? 'VALIDATION_ERROR',
          message: result.message ?? 'No se pudo actualizar el proveedor.'
        })
      }
      return sendOk(res, result.data)
    },

    getDocuments: async (req, res) => {
      const result = await service.listSupplierDocuments(req.params?.id)
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 404,
          code: result.code ?? 'NOT_FOUND',
          message: result.message ?? 'Proveedor no encontrado.'
        })
      }
      return sendOk(res, result.data)
    },

    getDocumentView: async (req, res) => {
      const result = await service.getSupplierDocumentForView(req.params?.id, req.params?.documentId)
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 404,
          code: result.code ?? 'NOT_FOUND',
          message: result.message ?? 'Documento no encontrado.'
        })
      }
      const { file_name: fileName, buffer } = result.data
      const safeName = String(fileName || 'documento.pdf').replace(/[^\w.-]+/gu, '_')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
      return res.status(200).send(Buffer.from(buffer))
    },

    getSocialNetworkCatalog: async (req, res) => {
      const result = await service.listSocialNetworkCatalog()
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 500,
          code: result.code ?? 'SOCIAL_NETWORK_CATALOG_FAILED',
          message: result.message ?? 'No se pudo obtener el catálogo de redes sociales.'
        })
      }
      return sendOk(res, result.data)
    }
  }
}

module.exports = { createSupplierController }
