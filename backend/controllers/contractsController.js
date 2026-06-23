const { sendOk, sendError } = require('../http/responses')
const contractsQueryService = require('../services/contractsQueryService')

function createContractsController({ service = contractsQueryService } = {}) {
  return {
    getList: async (req, res) => {
      const page = req.query?.page
      const pageSize = req.query?.pageSize
      const filters = {
        supplierSearch: req.query?.supplierSearch,
        supplierId: req.query?.supplierId,
        clientId: req.query?.clientId,
        templateId: req.query?.templateId,
        redSocialSearch: req.query?.redSocialSearch,
        status: req.query?.status
      }

      const result = await service.listContracts({ page, pageSize, filters })
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 500,
          code: result.code ?? 'CONTRACTS_LIST_FAILED',
          message: result.message ?? 'No se pudo obtener el listado de contratos.'
        })
      }
      return sendOk(res, result.data)
    },

    getPdf: async (req, res) => {
      const source = req.query?.source
      const result = await service.getContractPdf({ id: req.params?.id, source })
      if (!result.ok) {
        return sendError(res, {
          status: result.status ?? 404,
          code: result.code ?? 'NOT_FOUND',
          message: result.message ?? 'Contrato no encontrado.'
        })
      }

      const { file_name: fileName, buffer } = result.data
      const safeName = String(fileName || 'contrato.pdf').replace(/[^\w.-]+/gu, '_')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
      return res.status(200).send(Buffer.from(buffer))
    }
  }
}

module.exports = { createContractsController }
