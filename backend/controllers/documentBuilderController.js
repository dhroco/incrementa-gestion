const { sendOk, sendError } = require('../http/responses')

const VALID_SUPPLIER_TYPES = new Set(['persona_natural', 'empresa'])

function parseSupplierTypeQuery(query) {
  const raw = query?.supplier_type
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: undefined }
  if (typeof raw !== 'string') return { ok: false }
  const trimmed = raw.trim()
  if (!VALID_SUPPLIER_TYPES.has(trimmed)) return { ok: false }
  return { ok: true, value: trimmed }
}

function createDocumentBuilderController({ documentBuilderService }) {
  async function getTemplates(req, res) {
    const supplierTypeParsed = parseSupplierTypeQuery(req.query)
    if (!supplierTypeParsed.ok) {
      return sendError(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'El tipo de proveedor debe ser persona_natural o empresa.',
      })
    }
    const r = await documentBuilderService.listEligibleTemplates({
      userId: req.auth.userId,
      requestedCompanyId: req.query.companyId,
      supplierType: supplierTypeParsed.value,
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
      supplierId: req.body?.supplierId ?? null
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
            message: r.message
          },
          meta: {
            missingFields: r.data?.missingFields ?? [],
            timestamp: new Date().toISOString()
          }
        })
      }
      if (r.code === 'DUPLICATE_DRAFT' && r.status === 409) {
        return sendOk(res, {
          duplicateDraft: true,
          existing: r.data?.existing ?? null,
          message: r.message
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
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
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
