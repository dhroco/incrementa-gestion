const { sendOk, sendError } = require('../http/responses')

function createDocumentBuilderController({ documentBuilderService }) {
  async function getTemplates(req, res) {
    const r = await documentBuilderService.listEligibleTemplates({
      userId: req.auth.userId,
      requestedCompanyId: req.query.companyId
    })
    if (!r.ok) return sendError(res, { status: r.status, code: r.code, message: r.message })
    return sendOk(res, r.data)
  }

  async function getTemplateDetail(req, res) {
    const { kind, id } = req.params
    if (kind !== 'standard' && kind !== 'company') {
      return sendError(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Tipo de plantilla inválido. Use standard o company.'
      })
    }
    const r = await documentBuilderService.getTemplateDetail({
      userId: req.auth.userId,
      requestedCompanyId: req.query.companyId,
      kind,
      templateId: id
    })
    if (!r.ok) return sendError(res, { status: r.status, code: r.code, message: r.message })
    return sendOk(res, r.data)
  }

  async function postGenerate(req, res) {
    // eslint-disable-next-line no-console
    console.info('[document-builder] generate request', {
      userId: req.auth.userId,
      employeeCount: Array.isArray(req.body?.employeeIds) ? req.body.employeeIds.length : 0
    })
    const r = await documentBuilderService.generateAndPersist({
      userId: req.auth.userId,
      requestedCompanyId: req.query.companyId,
      body: req.body
    })
    if (!r.ok) {
      if (r.code === 'MISSING_PLACEHOLDERS' && r.status === 422) {
        return res.status(422).json({
          error: {
            code: r.code,
            message: r.message,
            missingFieldKeys: r.data?.missingFieldKeys ?? []
          },
          meta: { timestamp: new Date().toISOString() }
        })
      }
      return sendError(res, {
        status: r.status,
        code: r.code,
        message: r.message,
        meta: r.data ? { ...r.data } : undefined
      })
    }
    return sendOk(res, r.data)
  }

  async function getDownload(req, res) {
    const { id } = req.params
    const r = await documentBuilderService.getGeneratedDocumentForDownload({
      userId: req.auth.userId,
      requestedCompanyId: req.query.companyId,
      documentId: id
    })
    if (!r.ok) return sendError(res, { status: r.status, code: r.code, message: r.message })
    const { file_name: fileName, buffer } = r.data
    const safeName = String(fileName || 'documento.pdf').replace(/[^\w.-]+/gu, '_')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
    return res.status(200).send(Buffer.from(buffer))
  }

  return {
    getTemplates,
    getTemplateDetail,
    postGenerate,
    getDownload
  }
}

module.exports = { createDocumentBuilderController }
