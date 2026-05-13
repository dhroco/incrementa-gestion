const { sendError, sendOk } = require('../http/responses')
const { validateTemplateContentJson } = require('../utils/templateContentJson')
const { resolveReadableCompanyId } = require('../lib/resolveReadableCompanyId')

function readCompanyIdHeader(req) {
  const h = req.headers['x-company-id'] ?? req.headers['X-Company-Id']
  if (typeof h !== 'string') return null
  const t = h.trim()
  return t.length > 0 ? t : null
}

function normalizeOptionalString(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function normalizeRequiredName(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function createCompanyTemplatesController({ companyTemplatesService, getUserProfileIdByUserId }) {
  async function requireActorUserProfileId(req, res) {
    const userId = req.auth?.userId
    if (!userId) {
      sendError(res, {
        status: 401,
        code: 'AUTH_MISSING_TOKEN',
        message: 'No autorizado. Falta token de acceso.',
      })
      return null
    }
    const userProfileId = await getUserProfileIdByUserId(userId)
    if (!userProfileId) {
      sendError(res, {
        status: 403,
        code: 'PROFILE_NOT_ASSIGNED',
        message: 'No tiene un perfil interno asignado. Contacte al administrador del sistema.',
      })
      return null
    }
    return userProfileId
  }

  async function resolveCompanyForRequest(req, res) {
    const userId = req.auth?.userId
    if (!userId) {
      sendError(res, {
        status: 401,
        code: 'AUTH_MISSING_TOKEN',
        message: 'No autorizado. Falta token de acceso.',
      })
      return null
    }
    const requested = readCompanyIdHeader(req)
    const gate = await resolveReadableCompanyId(userId, requested)
    if (!gate.ok) {
      sendError(res, {
        status: gate.status,
        code: gate.code,
        message: gate.message,
      })
      return null
    }
    return gate.companyId
  }

  async function getList(req, res) {
    const companyId = await resolveCompanyForRequest(req, res)
    if (!companyId) return

    const q = typeof req.query?.q === 'string' ? req.query.q : undefined
    const result = await companyTemplatesService.listCompanyTemplates({ companyId, search: q })
    if (!result.ok) {
      return sendError(res, { status: 500, code: 'TEMPLATE_LIST_FAILED', message: 'No se pudo obtener el listado de plantillas.' })
    }
    return sendOk(res, { items: result.items })
  }

  async function postCreate(req, res) {
    if ('created_by' in (req.body ?? {}) || 'updated_by' in (req.body ?? {}) || 'last_edited_by' in (req.body ?? {})) {
      return sendError(res, {
        status: 400,
        code: 'TEMPLATE_AUTHOR_FIELDS_NOT_ALLOWED',
        message: 'No se permiten campos de autoría en el payload.',
      })
    }

    const companyId = await resolveCompanyForRequest(req, res)
    if (!companyId) return

    const name = normalizeRequiredName(req.body?.name)
    const code = normalizeRequiredName(req.body?.code)
    const description = normalizeOptionalString(req.body?.description)
    const content_json = req.body?.content_json
    const status = typeof req.body?.status === 'string' ? req.body.status : undefined
    const document_type_id =
      req.body?.document_type_id === null || req.body?.document_type_id === undefined
        ? undefined
        : typeof req.body.document_type_id === 'string'
          ? req.body.document_type_id.trim() || null
          : undefined

    if (!name) {
      return sendError(res, {
        status: 400,
        code: 'TEMPLATE_INVALID_PAYLOAD',
        message: 'El nombre de la plantilla es obligatorio.',
      })
    }

    if (!code) {
      return sendError(res, {
        status: 400,
        code: 'TEMPLATE_INVALID_PAYLOAD',
        message: 'El código de la plantilla es obligatorio.',
      })
    }

    const contentCheck = validateTemplateContentJson(content_json, { required: true })
    if (!contentCheck.ok) {
      return sendError(res, {
        status: 400,
        code: contentCheck.code,
        message: contentCheck.message,
      })
    }

    const actorUserProfileId = await requireActorUserProfileId(req, res)
    if (!actorUserProfileId) return

    const result = await companyTemplatesService.createCompanyTemplate({
      companyId,
      name,
      code,
      description: description ?? null,
      content_json,
      status,
      document_type_id,
      actorUserProfileId,
    })

    if (!result.ok) {
      if (result.error?.type === 'invalid_clauses') {
        return sendError(res, {
          status: 400,
          code: result.error.code ?? 'TEMPLATE_INVALID_EMBEDDED_CLAUSE',
          message: result.error.message ?? 'Cláusula incrustada inválida.',
        })
      }
      if (result.error?.type === 'no_document_type') {
        return sendError(res, {
          status: 400,
          code: 'TEMPLATE_NO_DOCUMENT_TYPE',
          message: result.error.message ?? 'No hay tipo documental configurado.',
        })
      }
      if (result.error?.type === 'unique_code') {
        return sendError(res, {
          status: 409,
          code: result.error.code ?? 'TEMPLATE_CODE_NOT_UNIQUE',
          message: result.error.message ?? 'Ya existe una plantilla con ese código para esta empresa.',
        })
      }
      return sendError(res, { status: 500, code: 'TEMPLATE_CREATE_FAILED', message: 'No se pudo crear la plantilla.' })
    }

    return sendOk(res, result.template, { status: 201 })
  }

  async function getById(req, res) {
    const id = req.params?.id
    if (!id || typeof id !== 'string') {
      return sendError(res, { status: 400, code: 'TEMPLATE_INVALID_ID', message: 'ID inválido.' })
    }

    const companyId = await resolveCompanyForRequest(req, res)
    if (!companyId) return

    const result = await companyTemplatesService.getCompanyTemplateById(id, companyId)
    if (!result.ok) {
      if (result.notFound) {
        return sendError(res, { status: 404, code: 'TEMPLATE_NOT_FOUND', message: 'Plantilla no encontrada.' })
      }
      return sendError(res, { status: 500, code: 'TEMPLATE_GET_FAILED', message: 'No se pudo obtener la plantilla.' })
    }

    return sendOk(res, result.template)
  }

  async function putUpdate(req, res) {
    const id = req.params?.id
    if (!id || typeof id !== 'string') {
      return sendError(res, { status: 400, code: 'TEMPLATE_INVALID_ID', message: 'ID inválido.' })
    }

    if ('created_by' in (req.body ?? {}) || 'updated_by' in (req.body ?? {}) || 'last_edited_by' in (req.body ?? {})) {
      return sendError(res, {
        status: 400,
        code: 'TEMPLATE_AUTHOR_FIELDS_NOT_ALLOWED',
        message: 'No se permiten campos de autoría en el payload.',
      })
    }

    const companyId = await resolveCompanyForRequest(req, res)
    if (!companyId) return

    const name = normalizeRequiredName(req.body?.name)
    const code = normalizeRequiredName(req.body?.code)
    const description = normalizeOptionalString(req.body?.description)
    const content_json = req.body?.content_json
    const status = typeof req.body?.status === 'string' ? req.body.status : undefined
    const document_type_id =
      req.body?.document_type_id === null || req.body?.document_type_id === undefined
        ? undefined
        : typeof req.body.document_type_id === 'string'
          ? req.body.document_type_id.trim() || null
          : undefined

    if (!name) {
      return sendError(res, {
        status: 400,
        code: 'TEMPLATE_INVALID_PAYLOAD',
        message: 'El nombre de la plantilla es obligatorio.',
      })
    }

    if (!code) {
      return sendError(res, {
        status: 400,
        code: 'TEMPLATE_INVALID_PAYLOAD',
        message: 'El código de la plantilla es obligatorio.',
      })
    }

    const contentCheck = validateTemplateContentJson(content_json, { required: true })
    if (!contentCheck.ok) {
      return sendError(res, {
        status: 400,
        code: contentCheck.code,
        message: contentCheck.message,
      })
    }

    const actorUserProfileId = await requireActorUserProfileId(req, res)
    if (!actorUserProfileId) return

    const result = await companyTemplatesService.updateCompanyTemplate(id, {
      companyId,
      name,
      code,
      description: description ?? null,
      content_json,
      status,
      document_type_id,
      actorUserProfileId,
    })

    if (!result.ok) {
      if (result.notFound) {
        return sendError(res, { status: 404, code: 'TEMPLATE_NOT_FOUND', message: 'Plantilla no encontrada.' })
      }
      if (result.error?.type === 'invalid_clauses') {
        return sendError(res, {
          status: 400,
          code: result.error.code ?? 'TEMPLATE_INVALID_EMBEDDED_CLAUSE',
          message: result.error.message ?? 'Cláusula incrustada inválida.',
        })
      }
      if (result.error?.type === 'no_document_type') {
        return sendError(res, {
          status: 400,
          code: 'TEMPLATE_NO_DOCUMENT_TYPE',
          message: result.error.message ?? 'No hay tipo documental configurado.',
        })
      }
      if (result.error?.type === 'unique_code') {
        return sendError(res, {
          status: 409,
          code: result.error.code ?? 'TEMPLATE_CODE_NOT_UNIQUE',
          message: result.error.message ?? 'Ya existe una plantilla con ese código para esta empresa.',
        })
      }
      return sendError(res, { status: 500, code: 'TEMPLATE_UPDATE_FAILED', message: 'No se pudo actualizar la plantilla.' })
    }

    return sendOk(res, result.template)
  }

  return {
    getList,
    postCreate,
    getById,
    putUpdate,
  }
}

module.exports = { createCompanyTemplatesController }
