const { randomUUID } = require('node:crypto')
const { stableJsonStringify } = require('../lib/stableJsonStringify')
const { collectEmbeddedClauseRefsFromDoc } = require('../utils/templateContentJson')

function isUniqueViolation(err) {
  return err && err.code === '23505'
}

function mapTemplateRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name ?? null,
    code: row.code ?? null,
    description: row.description ?? null,
    status: row.status ?? null,
    document_type_id: row.document_type_id ?? null,
    content_json: row.content_json ?? null,
    company_id: row.company_id ?? null,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    last_edited_by: row.last_edited_by ?? null,
    created_by_name: row.created_by_name ?? null,
    updated_by_name: row.updated_by_name ?? null,
    last_edited_by_name: row.last_edited_by_name ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

function createCompanyTemplatesService({ db }) {
  async function getDefaultDocumentTypeId(trx) {
    const row = await trx('document_type').select('id').orderBy('created_at', 'asc').first()
    return row?.id ?? null
  }

  async function assertUniversalClauseIds(trx, clauseIds) {
    if (clauseIds.length === 0) return { ok: true }
    const rows = await trx('clause_universal').select('id').whereIn('id', clauseIds)
    if (rows.length !== clauseIds.length) {
      return {
        ok: false,
        code: 'TEMPLATE_INVALID_EMBEDDED_CLAUSE',
        message: 'Una o más cláusulas incrustadas no existen o no son universales.',
      }
    }
    return { ok: true }
  }

  async function assertCompanyClauseIdsForCompany(trx, clauseIds, companyId) {
    if (clauseIds.length === 0) return { ok: true }
    const rows = await trx('clause_company').select('id').whereIn('id', clauseIds).where('company_id', companyId)
    if (rows.length !== clauseIds.length) {
      return {
        ok: false,
        code: 'TEMPLATE_INVALID_EMBEDDED_CLAUSE',
        message: 'Una o más cláusulas por empresa incrustadas no existen o no pertenecen a esta empresa.',
      }
    }
    return { ok: true }
  }

  function validateEmbeddedRefsForCompanyTemplate(contentJson, companyId) {
    const refs = collectEmbeddedClauseRefsFromDoc(contentJson)
    const universalIds = []
    const companyIds = []
    for (const r of refs) {
      if (r.clauseKind === 'company') {
        if (r.companyId && String(r.companyId).trim() !== String(companyId).trim()) {
          return {
            ok: false,
            code: 'TEMPLATE_INVALID_EMBEDDED_CLAUSE_COMPANY',
            message: 'Las cláusulas por empresa incrustadas deben pertenecer a la empresa seleccionada.',
          }
        }
        companyIds.push(r.clauseId)
      } else {
        universalIds.push(r.clauseId)
      }
    }
    return { ok: true, universalIds, companyIds }
  }

  function selectAuthorJoins(q) {
    return q
      .leftJoin('user_profile as up_created', 'up_created.id', 't.created_by')
      .leftJoin('user_profile as up_updated', 'up_updated.id', 't.updated_by')
      .leftJoin('user_profile as up_last', 'up_last.id', 't.last_edited_by')
  }

  function selectAuthorColumns() {
    return [
      't.id',
      't.name',
      'tc.code as code',
      't.description',
      't.status',
      't.document_type_id',
      't.content_json',
      'tc.company_id',
      't.created_by',
      't.updated_by',
      't.last_edited_by',
      'up_created.full_name as created_by_name',
      'up_updated.full_name as updated_by_name',
      'up_last.full_name as last_edited_by_name',
      't.created_at',
      't.updated_at',
    ]
  }

  async function validateClauseRefsInTransaction(trx, contentJson, companyId) {
    const parsed = validateEmbeddedRefsForCompanyTemplate(contentJson, companyId)
    if (!parsed.ok) return parsed
    const uCheck = await assertUniversalClauseIds(trx, parsed.universalIds)
    if (!uCheck.ok) return uCheck
    const cCheck = await assertCompanyClauseIdsForCompany(trx, parsed.companyIds, companyId)
    if (!cCheck.ok) return cCheck
    return { ok: true }
  }

  /**
   * @param {{ companyId: string, name: string, code: string, description: string | null, content_json: object, status?: string, document_type_id?: string | null, actorUserProfileId: string }} input
   */
  async function createCompanyTemplate(input) {
    const {
      companyId,
      name,
      code,
      description,
      content_json,
      status = 'draft',
      document_type_id: dtIn,
      actorUserProfileId,
    } = input

    return await db.transaction(async (trx) => {
      let document_type_id = dtIn
      if (!document_type_id) {
        document_type_id = await getDefaultDocumentTypeId(trx)
      }
      if (!document_type_id) {
        return { ok: false, error: { type: 'no_document_type', message: 'No hay tipo documental disponible para la plantilla.' } }
      }

      const refCheck = await validateClauseRefsInTransaction(trx, content_json, companyId)
      if (!refCheck.ok) {
        return {
          ok: false,
          error: {
            type: 'invalid_clauses',
            code: refCheck.code,
            message: refCheck.message,
          },
        }
      }

      const id = randomUUID()
      const codeTrimmed = String(code).trim()

      try {
        await trx('template').insert({
          id,
          document_type_id,
          name: name.trim(),
          code: null,
          description: description === null || description === undefined ? null : String(description).trim() || null,
          content_json,
          status: ['draft', 'active', 'inactive'].includes(status) ? status : 'draft',
          created_by: actorUserProfileId,
          updated_by: actorUserProfileId,
          last_edited_by: actorUserProfileId,
        })
        await trx('template_company').insert({
          id,
          company_id: companyId,
          code: codeTrimmed,
        })
      } catch (err) {
        if (isUniqueViolation(err)) {
          return {
            ok: false,
            error: {
              type: 'unique_code',
              code: 'TEMPLATE_CODE_NOT_UNIQUE',
              message: 'Ya existe una plantilla con ese código para esta empresa.',
            },
          }
        }
        throw err
      }

      const row = await selectAuthorJoins(trx('template as t'))
        .join('template_company as tc', 'tc.id', 't.id')
        .select(selectAuthorColumns())
        .where('t.id', id)
        .where('tc.company_id', companyId)
        .first()

      return { ok: true, template: mapTemplateRow(row) }
    })
  }

  /**
   * @param {{ companyId: string, search?: string }} opts
   */
  async function listCompanyTemplates({ companyId, search } = {}) {
    const q = typeof search === 'string' ? search.trim() : ''
    let query = selectAuthorJoins(db('template as t'))
      .join('template_company as tc', 'tc.id', 't.id')
      .where('tc.company_id', companyId)
      .select(
        't.id',
        't.name',
        'tc.code as code',
        't.description',
        't.status',
        't.created_at',
        't.updated_at',
        't.created_by',
        't.updated_by',
        't.last_edited_by',
        'up_created.full_name as created_by_name',
        'up_updated.full_name as updated_by_name',
        'up_last.full_name as last_edited_by_name',
        db.raw(
          `COALESCE(
            NULLIF(BTRIM(up_last.full_name), ''),
            NULLIF(BTRIM(up_updated.full_name), '')
          ) as last_editor_display`
        )
      )
      .orderBy('t.updated_at', 'desc')

    if (q.length > 0) {
      const pattern = `%${q}%`
      query = query.where(function whereSearch() {
        this.where('t.name', 'ilike', pattern)
          .orWhere('tc.code', 'ilike', pattern)
          .orWhere('t.description', 'ilike', pattern)
      })
    }

    const rows = await query

    return {
      ok: true,
      items: rows.map((r) => {
        const lastEditorDisplay =
          r.last_editor_display != null && String(r.last_editor_display).trim()
            ? String(r.last_editor_display).trim()
            : null
        return {
          id: r.id,
          name: r.name,
          code: r.code ?? null,
          description: r.description ?? null,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,
          created_by: r.created_by ?? null,
          updated_by: r.updated_by ?? null,
          last_edited_by: r.last_edited_by ?? null,
          created_by_name: r.created_by_name ?? null,
          updated_by_name: r.updated_by_name ?? null,
          last_edited_by_name: r.last_edited_by_name ?? null,
          last_editor_display: lastEditorDisplay,
        }
      }),
    }
  }

  /**
   * @param {string} id
   * @param {string} companyId
   */
  async function getCompanyTemplateById(id, companyId) {
    const row = await selectAuthorJoins(db('template as t'))
      .join('template_company as tc', 'tc.id', 't.id')
      .select(selectAuthorColumns())
      .where('t.id', id)
      .where('tc.company_id', companyId)
      .first()

    if (!row) return { ok: false, notFound: true }
    return { ok: true, template: mapTemplateRow(row) }
  }

  /**
   * @param {string} id
   * @param {{ companyId: string, name: string, code: string, description: string | null, content_json: object, status?: string, document_type_id?: string | null, actorUserProfileId: string }} input
   */
  async function updateCompanyTemplate(id, input) {
    const {
      companyId,
      name,
      code,
      description,
      content_json,
      status = 'draft',
      document_type_id: dtIn,
      actorUserProfileId,
    } = input

    return await db.transaction(async (trx) => {
      const existingRow = await trx('template as t')
        .join('template_company as tc', 'tc.id', 't.id')
        .select('t.id', 't.document_type_id', 't.content_json')
        .where('t.id', id)
        .where('tc.company_id', companyId)
        .first()

      if (!existingRow) {
        return { ok: false, notFound: true }
      }

      let document_type_id = dtIn !== undefined ? dtIn : existingRow.document_type_id
      if (!document_type_id) {
        document_type_id = await getDefaultDocumentTypeId(trx)
      }
      if (!document_type_id) {
        return { ok: false, error: { type: 'no_document_type', message: 'No hay tipo documental disponible para la plantilla.' } }
      }

      const refCheck = await validateClauseRefsInTransaction(trx, content_json, companyId)
      if (!refCheck.ok) {
        return {
          ok: false,
          error: {
            type: 'invalid_clauses',
            code: refCheck.code,
            message: refCheck.message,
          },
        }
      }

      const contentChanged = stableJsonStringify(content_json) !== stableJsonStringify(existingRow.content_json)
      const codeTrimmed = String(code).trim()

      const patch = {
        name: name.trim(),
        description: description === null || description === undefined ? null : String(description).trim() || null,
        content_json,
        status: ['draft', 'active', 'inactive'].includes(status) ? status : 'draft',
        document_type_id,
        updated_by: actorUserProfileId,
        updated_at: new Date(),
      }
      if (contentChanged) {
        patch.last_edited_by = actorUserProfileId
      }

      try {
        await trx('template').where({ id }).update(patch)
        await trx('template_company').where({ id, company_id: companyId }).update({
          code: codeTrimmed,
          updated_at: new Date(),
        })
      } catch (err) {
        if (isUniqueViolation(err)) {
          return {
            ok: false,
            error: {
              type: 'unique_code',
              code: 'TEMPLATE_CODE_NOT_UNIQUE',
              message: 'Ya existe una plantilla con ese código para esta empresa.',
            },
          }
        }
        throw err
      }

      const row = await selectAuthorJoins(trx('template as t'))
        .join('template_company as tc', 'tc.id', 't.id')
        .select(selectAuthorColumns())
        .where('t.id', id)
        .where('tc.company_id', companyId)
        .first()

      return { ok: true, template: mapTemplateRow(row) }
    })
  }

  return {
    createCompanyTemplate,
    listCompanyTemplates,
    getCompanyTemplateById,
    updateCompanyTemplate,
  }
}

module.exports = { createCompanyTemplatesService }
