const { sendError, sendOk } = require('../http/responses')
const { resolveCompanyScopeByUserId } = require('../services/companyScopeService')
const { validateClauseContentJson } = require('../utils/clauseContentJson')
const { resolveCompanyIdForCompanyClause } = require('../lib/resolveCompanyClauseContext')
const { buildNoProfileAssignedBody, buildForbiddenBody } = require('../sessionResponses')

function normalizeOptionalString(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function normalizeRequiredString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function buildUniquenessMessage(context) {
  if (context === 'universal') return 'El código ya existe en cláusulas universales.'
  if (context === 'company') return 'El código ya existe en esta empresa.'
  return 'El código ya existe.'
}

function createClauseController({
  clauseService,
  getUserProfileIdByUserId,
  companyScopeResolver = resolveCompanyScopeByUserId,
  effectiveNavigationResolver,
}) {
  async function requireAuthorUserProfileId(req, res) {
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

  async function postUniversal(req, res) {
    if ('created_by' in (req.body ?? {}) || 'updated_by' in (req.body ?? {}) || 'last_edited_by' in (req.body ?? {})) {
      return sendError(res, {
        status: 400,
        code: 'CLAUSE_AUTHOR_FIELDS_NOT_ALLOWED',
        message: 'No se permiten campos de autoría en el payload.',
      })
    }

    const title_clause = normalizeRequiredString(req.body?.title_clause)
    const code = normalizeRequiredString(req.body?.code)
    const description = normalizeOptionalString(req.body?.description)
    const content_json = req.body?.content_json

    if (!title_clause || !code) {
      return sendError(res, {
        status: 400,
        code: 'CLAUSE_INVALID_PAYLOAD',
        message: 'Payload inválido. Se requieren title_clause y code.',
      })
    }
    const contentCheck = validateClauseContentJson(content_json, { required: true })
    if (!contentCheck.ok) {
      return sendError(res, {
        status: 400,
        code: contentCheck.code,
        message: contentCheck.message,
      })
    }

    const authorUserProfileId = await requireAuthorUserProfileId(req, res)
    if (!authorUserProfileId) return

    const result = await clauseService.createUniversal({
      title_clause,
      code,
      description,
      content_json: content_json ?? null,
      authorUserProfileId,
    })

    if (!result.ok) {
      if (result.error?.type === 'unique') {
        return sendError(res, {
          status: 409,
          code: 'CLAUSE_CODE_NOT_UNIQUE',
          message: buildUniquenessMessage('universal'),
        })
      }
      return sendError(res, { status: 500 })
    }

    return sendOk(res, result.clause, { status: 201 })
  }

  async function postCompany(req, res) {
    if ('created_by' in (req.body ?? {}) || 'updated_by' in (req.body ?? {}) || 'last_edited_by' in (req.body ?? {})) {
      return sendError(res, {
        status: 400,
        code: 'CLAUSE_AUTHOR_FIELDS_NOT_ALLOWED',
        message: 'No se permiten campos de autoría en el payload.',
      })
    }

    const title_clause = normalizeRequiredString(req.body?.title_clause)
    const code = normalizeRequiredString(req.body?.code)
    const description = normalizeOptionalString(req.body?.description)
    const content_json = req.body?.content_json

    if (!title_clause || !code) {
      return sendError(res, {
        status: 400,
        code: 'CLAUSE_INVALID_PAYLOAD',
        message: 'Payload inválido. Se requieren title_clause y code.',
      })
    }
    const contentCheckCompany = validateClauseContentJson(content_json, { required: true })
    if (!contentCheckCompany.ok) {
      return sendError(res, {
        status: 400,
        code: contentCheckCompany.code,
        message: contentCheckCompany.message,
      })
    }

    const authorUserProfileId = await requireAuthorUserProfileId(req, res)
    if (!authorUserProfileId) return

    const userId = req.auth?.userId
    const scope = userId ? await companyScopeResolver(userId) : null
    const resolved = resolveCompanyIdForCompanyClause(req, scope)
    if (!resolved.ok) {
      return sendError(res, {
        status: resolved.status,
        code: resolved.code,
        message: resolved.message,
      })
    }

    const result = await clauseService.createCompany({
      company_id: resolved.companyId,
      title_clause,
      code,
      description,
      content_json: content_json ?? null,
      authorUserProfileId,
    })

    if (!result.ok) {
      if (result.error?.type === 'not_found' && result.error?.resource === 'company') {
        return sendError(res, {
          status: 400,
          code: 'CLAUSE_INVALID_COMPANY_ID',
          message: 'Empresa no encontrada para el usuario.',
        })
      }
      if (result.error?.type === 'unique') {
        return sendError(res, {
          status: 409,
          code: 'CLAUSE_CODE_NOT_UNIQUE',
          message: buildUniquenessMessage('company'),
        })
      }
      return sendError(res, { status: 500 })
    }

    return sendOk(res, result.clause, { status: 201 })
  }

  async function getDetail(req, res) {
    const id = req.params?.id
    if (!id) {
      return sendError(res, { status: 400, code: 'CLAUSE_INVALID_ID', message: 'ID inválido.' })
    }
    const clause = await clauseService.getClauseDetail(id)
    if (!clause) {
      return sendError(res, { status: 404, code: 'CLAUSE_NOT_FOUND', message: 'Cláusula no encontrada.' })
    }
    return sendOk(res, clause)
  }

  function hasNavigationCode(rows, code) {
    return Array.isArray(rows) && rows.some((r) => r.code === code)
  }

  async function assertCanReadClauseForUser({
    userId,
    email,
    clause,
    universalNavigationCode,
    companyNavigationCode,
  }) {
    const requiredCode =
      clause.type === 'universal'
        ? universalNavigationCode
        : clause.type === 'company'
          ? companyNavigationCode
          : null
    if (!requiredCode) return { ok: true }

    if (typeof effectiveNavigationResolver !== 'function') {
      return { ok: false, httpStatus: 500, code: 'SERVER_MISCONFIG', message: 'Configuración del servidor incompleta.' }
    }

    const result = await effectiveNavigationResolver(userId)
    if (!result) {
      const body = buildNoProfileAssignedBody(userId, email)
      return { ok: false, httpStatus: 403, code: body.code, message: body.message }
    }
    if (!hasNavigationCode(result.rows, requiredCode)) {
      const body = buildForbiddenBody()
      return { ok: false, httpStatus: 403, code: body.code, message: body.message }
    }

    if (clause.type === 'company') {
      const scope = await companyScopeResolver(userId)
      if (!scope) {
        const body = buildNoProfileAssignedBody(userId, email)
        return { ok: false, httpStatus: 403, code: body.code, message: body.message }
      }
      if (scope.profileCode === 'ADMINISTRADOR_PLATAFORMA') {
        const body = buildForbiddenBody()
        return { ok: false, httpStatus: 403, code: body.code, message: body.message }
      }
      const companyId = clause.company_id ?? null
      const ok =
        scope.mode === 'single'
          ? scope.companyId === companyId
          : scope.mode === 'set'
            ? Array.isArray(scope.companyIds) && scope.companyIds.includes(companyId)
            : false
      if (!ok) {
        const body = buildForbiddenBody()
        return { ok: false, httpStatus: 403, code: body.code, message: body.message }
      }
    }

    return { ok: true }
  }

  /**
   * Batch read resolver for template embeds (partial success per item).
   * POST body: { items: [{ clause_id, clause_kind: 'universal'|'company', company_id? }] }
   */
  async function postResolveRead(req, res) {
    const userId = req.auth?.userId
    const email = req.auth?.email ?? null
    if (!userId) {
      return sendError(res, {
        status: 401,
        code: 'AUTH_MISSING_IDENTITY',
        message: 'No autorizado. Falta identidad autenticada.',
      })
    }

    const itemsIn = req.body?.items
    if (!Array.isArray(itemsIn)) {
      return sendError(res, { status: 400, code: 'CLAUSE_RESOLVE_INVALID_PAYLOAD', message: 'Payload inválido. Se requiere items[].' })
    }
    if (itemsIn.length === 0) {
      return sendError(res, { status: 400, code: 'CLAUSE_RESOLVE_EMPTY', message: 'Debe solicitar al menos una cláusula.' })
    }
    if (itemsIn.length > 100) {
      return sendError(res, { status: 400, code: 'CLAUSE_RESOLVE_TOO_MANY', message: 'Demasiadas cláusulas en una sola solicitud.' })
    }

    const universalNavigationCode = 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ'
    const companyNavigationCode = 'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_READ'

    /** @type {Map<string, any>} */
    const unique = new Map()
    for (const raw of itemsIn) {
      const clause_id = typeof raw?.clause_id === 'string' ? raw.clause_id.trim() : typeof raw?.id === 'string' ? raw.id.trim() : ''
      if (!clause_id) continue

      const kindRaw = typeof raw?.clause_kind === 'string' ? raw.clause_kind.trim().toLowerCase() : 'universal'
      const clause_kind = kindRaw === 'company' ? 'company' : 'universal'
      const company_id =
        typeof raw?.company_id === 'string' && raw.company_id.trim().length > 0 ? raw.company_id.trim() : null

      if (clause_kind === 'company' && !company_id) {
        unique.set(`${clause_id}|${clause_kind}|`, { clause_id, clause_kind, company_id: null, clientError: 'COMPANY_ID_REQUIRED' })
        continue
      }

      const key = `${clause_id}|${clause_kind}|${company_id ?? ''}`
      if (!unique.has(key)) unique.set(key, { clause_id, clause_kind, company_id })
    }

    const items = []
    for (const spec of unique.values()) {
      if (spec.clientError === 'COMPANY_ID_REQUIRED') {
        items.push({
          clause_id: spec.clause_id,
          clause_kind: spec.clause_kind,
          company_id: null,
          ok: false,
          httpStatus: 400,
          code: 'CLAUSE_RESOLVE_COMPANY_ID_REQUIRED',
          message: 'Se requiere company_id para cláusulas por empresa.',
        })
        continue
      }

      const clause = await clauseService.getClauseDetail(spec.clause_id)
      if (!clause) {
        items.push({
          clause_id: spec.clause_id,
          clause_kind: spec.clause_kind,
          company_id: spec.company_id,
          ok: false,
          httpStatus: 404,
          code: 'CLAUSE_NOT_FOUND',
          message: 'Cláusula no encontrada.',
        })
        continue
      }

      if (clause.type !== spec.clause_kind) {
        items.push({
          clause_id: spec.clause_id,
          clause_kind: spec.clause_kind,
          company_id: spec.company_id,
          ok: false,
          httpStatus: 400,
          code: 'CLAUSE_RESOLVE_KIND_MISMATCH',
          message: 'El tipo de cláusula solicitado no coincide con el almacenado.',
        })
        continue
      }

      if (clause.type === 'company') {
        const storedCompanyId = clause.company_id ?? null
        if (!storedCompanyId || storedCompanyId !== spec.company_id) {
          items.push({
            clause_id: spec.clause_id,
            clause_kind: spec.clause_kind,
            company_id: spec.company_id,
            ok: false,
            httpStatus: 400,
            code: 'CLAUSE_RESOLVE_COMPANY_MISMATCH',
            message: 'El company_id no coincide con la cláusula.',
          })
          continue
        }
      }

      const access = await assertCanReadClauseForUser({
        userId,
        email,
        clause,
        universalNavigationCode,
        companyNavigationCode,
      })
      if (!access.ok) {
        items.push({
          clause_id: spec.clause_id,
          clause_kind: spec.clause_kind,
          company_id: spec.company_id,
          ok: false,
          httpStatus: access.httpStatus ?? 403,
          code: access.code ?? 'FORBIDDEN',
          message: access.message ?? 'Acceso denegado.',
        })
        continue
      }

      items.push({
        clause_id: spec.clause_id,
        clause_kind: spec.clause_kind,
        company_id: spec.company_id,
        ok: true,
        clause: {
          id: clause.id,
          type: clause.type,
          company_id: clause.company_id ?? null,
          title_clause: clause.title_clause ?? null,
          code: clause.code ?? null,
          content_json: clause.content_json ?? null,
        },
      })
    }

    return sendOk(res, { items }, { meta: { total: items.length } })
  }

  async function putUpdate(req, res) {
    if ('created_by' in (req.body ?? {}) || 'updated_by' in (req.body ?? {}) || 'last_edited_by' in (req.body ?? {})) {
      return sendError(res, {
        status: 400,
        code: 'CLAUSE_AUTHOR_FIELDS_NOT_ALLOWED',
        message: 'No se permiten campos de autoría en el payload.',
      })
    }

    const id = req.params?.id
    if (!id) {
      return sendError(res, { status: 400, code: 'CLAUSE_INVALID_ID', message: 'ID inválido.' })
    }

    const patch = {
      title_clause: normalizeOptionalString(req.body?.title_clause),
      code: normalizeOptionalString(req.body?.code),
      description: normalizeOptionalString(req.body?.description),
      content_json: req.body?.content_json,
      status: normalizeOptionalString(req.body?.status),
    }

    const hasAny =
      patch.title_clause !== undefined ||
      patch.code !== undefined ||
      patch.description !== undefined ||
      patch.content_json !== undefined ||
      patch.status !== undefined

    if (!hasAny) {
      return sendError(res, {
        status: 400,
        code: 'CLAUSE_INVALID_PAYLOAD',
        message: 'Payload inválido. Debe incluir al menos un campo a actualizar.',
      })
    }

    if (patch.content_json !== undefined) {
      const contentCheckPut = validateClauseContentJson(patch.content_json, { required: true })
      if (!contentCheckPut.ok) {
        return sendError(res, {
          status: 400,
          code: contentCheckPut.code,
          message: contentCheckPut.message,
        })
      }
    }

    const authorUserProfileId = await requireAuthorUserProfileId(req, res)
    if (!authorUserProfileId) return

    const result = await clauseService.updateClause({ id, patch, authorUserProfileId })

    if (!result.ok) {
      if (result.error?.type === 'business') {
        return sendError(res, {
          status: result.error.httpStatus ?? 409,
          code: result.error.code ?? 'BUSINESS_RULE_VIOLATION',
          message: result.error.message ?? 'Operación no permitida.',
        })
      }
      if (result.error?.type === 'not_found') {
        return sendError(res, { status: 404, code: 'CLAUSE_NOT_FOUND', message: 'Cláusula no encontrada.' })
      }
      if (result.error?.type === 'unique') {
        const ctx = result.error?.context === 'company' ? 'company' : 'universal'
        return sendError(res, {
          status: 409,
          code: 'CLAUSE_CODE_NOT_UNIQUE',
          message: buildUniquenessMessage(ctx),
        })
      }
      return sendError(res, { status: 500 })
    }

    return sendOk(res, result.clause)
  }

  async function getUniversalList(req, res) {
    const raw = req.query?.q ?? req.query?.search
    const search = typeof raw === 'string' ? raw : ''
    const items = await clauseService.listUniversal({ search })
    return sendOk(res, { items }, { meta: { total: items.length } })
  }

  async function getCompanyList(req, res) {
    const userId = req.auth?.userId
    if (!userId) {
      return sendError(res, {
        status: 401,
        code: 'AUTH_MISSING_TOKEN',
        message: 'No autorizado. Falta token de acceso.',
      })
    }

    const scope = await companyScopeResolver(userId)
    if (!scope || scope.profileCode === 'ADMINISTRADOR_PLATAFORMA' || scope.mode === 'none') {
      return sendError(res, {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Acceso denegado. No tiene permisos para realizar esta acción.',
      })
    }

    const resolved = resolveCompanyIdForCompanyClause(req, scope)
    if (!resolved.ok) {
      return sendError(res, {
        status: resolved.status,
        code: resolved.code,
        message: resolved.message,
      })
    }

    const raw = req.query?.q ?? req.query?.search
    const search = typeof raw === 'string' ? raw : ''
    const items = await clauseService.listCompanyInScope({
      scope,
      search,
      activeCompanyId: scope.mode === 'set' ? resolved.companyId : undefined
    })
    return sendOk(res, { items }, { meta: { total: items.length } })
  }

  return { postUniversal, postCompany, getDetail, postResolveRead, putUpdate, getUniversalList, getCompanyList }
}

module.exports = { createClauseController }

