const { randomUUID } = require('node:crypto')
const { stableJsonStringify } = require('../lib/stableJsonStringify')
const { validateClauseStatusChange } = require('./clauseStatusService')

function mapClauseRow(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    company_id: row.company_id ?? null,
    title_clause: row.title_clause ?? null,
    code: row.code ?? null,
    description: row.description ?? null,
    content_json: row.content_json ?? null,
    status: row.status ?? null,
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

function isUniqueViolation(err) {
  return err && err.code === '23505'
}

function isForeignKeyViolation(err) {
  return err && err.code === '23503'
}

function createClauseService({ db }) {
  async function isClauseUsedByActiveTemplate(trx, clauseId) {
    // "Active template" is defined by template.status = 'active'.
    const vars = JSON.stringify({ clauseId })
    const row = await trx('template as t')
      .select('t.id')
      .where('t.status', 'active')
      .andWhereRaw(
        `jsonb_path_exists(
          COALESCE(t.content_json, '{}'::jsonb),
          '$.** ? (@.type == \"embeddedUniversalClause\" && @.attrs.clauseId == $clauseId)',
          ?::jsonb
        )`,
        [vars]
      )
      .first()
    return Boolean(row)
  }

  async function getClauseDetail(id) {
    const base = await db('clause as c')
      .leftJoin('clause_universal as cu', 'cu.id', 'c.id')
      .leftJoin('clause_company as cc', 'cc.id', 'c.id')
      .leftJoin('user_profile as up_created', 'up_created.id', 'c.created_by')
      .leftJoin('user_profile as up_updated', 'up_updated.id', 'c.updated_by')
      .leftJoin('user_profile as up_last', 'up_last.id', 'c.last_edited_by')
      .select(
        'c.id',
        'c.title_clause',
        'c.code',
        'c.description',
        'c.content_json',
        'c.status',
        'c.created_by',
        'c.updated_by',
        'c.last_edited_by',
        'up_created.full_name as created_by_name',
        'up_updated.full_name as updated_by_name',
        'up_last.full_name as last_edited_by_name',
        'c.created_at',
        'c.updated_at',
        db.raw(
          "CASE WHEN cu.id IS NOT NULL THEN 'universal' WHEN cc.id IS NOT NULL THEN 'company' ELSE NULL END as type"
        ),
        'cc.company_id as company_id'
      )
      .where('c.id', id)
      .first()

    if (!base || !base.type) return null
    return mapClauseRow(base)
  }

  async function createUniversal({ title_clause, code, description, content_json, authorUserProfileId }) {
    const id = randomUUID()
    try {
      await db.transaction(async (trx) => {
        await trx('clause').insert({
          id,
          title_clause,
          code,
          description,
          content_json,
          status: 'draft',
          created_by: authorUserProfileId,
          updated_by: authorUserProfileId,
          last_edited_by: authorUserProfileId,
        })
        await trx('clause_universal').insert({ id, code })
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { ok: false, error: { type: 'unique', context: 'universal', err } }
      }
      if (isForeignKeyViolation(err)) {
        return { ok: false, error: { type: 'foreign_key', err } }
      }
      return { ok: false, error: { type: 'unknown', err } }
    }

    const detail = await getClauseDetail(id)
    return { ok: true, clause: detail }
  }

  async function createCompany({
    company_id,
    title_clause,
    code,
    description,
    content_json,
    authorUserProfileId,
  }) {
    const id = randomUUID()
    try {
      await db.transaction(async (trx) => {
        const company = await trx('company').select('id').where('id', company_id).first()
        if (!company) {
          throw Object.assign(new Error('Company not found'), { __type: 'company_not_found' })
        }

        await trx('clause').insert({
          id,
          title_clause,
          code,
          description,
          content_json,
          status: 'draft',
          created_by: authorUserProfileId,
          updated_by: authorUserProfileId,
          last_edited_by: authorUserProfileId,
        })
        // Company code uniqueness is enforced in DB on clause_company (company_id, code); 23505 on insert here is per-company, not global.
        await trx('clause_company').insert({ id, company_id, code })
      })
    } catch (err) {
      if (err && err.__type === 'company_not_found') {
        return { ok: false, error: { type: 'not_found', resource: 'company' } }
      }
      if (isUniqueViolation(err)) {
        return { ok: false, error: { type: 'unique', context: 'company', err } }
      }
      if (isForeignKeyViolation(err)) {
        return { ok: false, error: { type: 'foreign_key', err } }
      }
      return { ok: false, error: { type: 'unknown', err } }
    }

    const detail = await getClauseDetail(id)
    return { ok: true, clause: detail }
  }

  async function updateClause({ id, patch, authorUserProfileId }) {
    const existing = await getClauseDetail(id)
    if (!existing) return { ok: false, error: { type: 'not_found', resource: 'clause' } }

    const { title_clause, code, description, content_json, status } = patch

    const contentChanged =
      content_json !== undefined &&
      stableJsonStringify(content_json) !== stableJsonStringify(existing.content_json)

    try {
      await db.transaction(async (trx) => {
        let nextStatus = undefined
        if (status !== undefined) {
          const validation = await validateClauseStatusChange({
            fromStatus: existing.status,
            toStatusInput: status,
            isInUseByActiveTemplate: async () => isClauseUsedByActiveTemplate(trx, id),
          })
          if (!validation.ok) {
            throw Object.assign(new Error(validation.message), {
              __type: 'business_rule',
              httpStatus: validation.httpStatus,
              code: validation.code,
              message: validation.message,
            })
          }
          nextStatus = validation.toStatus
        }

        const clausePatch = {
          ...(title_clause !== undefined ? { title_clause } : null),
          ...(code !== undefined ? { code } : null),
          ...(description !== undefined ? { description } : null),
          ...(content_json !== undefined ? { content_json } : null),
          ...(nextStatus !== undefined ? { status: nextStatus } : null),
          updated_by: authorUserProfileId,
          updated_at: trx.fn.now(),
        }
        if (contentChanged) {
          clausePatch.last_edited_by = authorUserProfileId
        }
        await trx('clause').where({ id }).update(clausePatch)

        if (code !== undefined) {
          if (existing.type === 'universal') {
            await trx('clause_universal').where({ id }).update({ code })
          } else if (existing.type === 'company') {
            await trx('clause_company').where({ id }).update({ code })
          }
        }
      })
    } catch (err) {
      if (err && err.__type === 'business_rule') {
        return {
          ok: false,
          error: {
            type: 'business',
            httpStatus: err.httpStatus ?? 409,
            code: err.code ?? 'BUSINESS_RULE_VIOLATION',
            message: err.message ?? 'Operación no permitida.',
          },
        }
      }
      if (isUniqueViolation(err)) {
        return { ok: false, error: { type: 'unique', context: existing.type, err } }
      }
      if (isForeignKeyViolation(err)) {
        return { ok: false, error: { type: 'foreign_key', err } }
      }
      return { ok: false, error: { type: 'unknown', err } }
    }

    const detail = await getClauseDetail(id)
    return { ok: true, clause: detail }
  }

  function mapUniversalListRow(row) {
    if (!row) return null
    const lastEditorDisplay =
      row.last_editor_display != null && String(row.last_editor_display).trim()
        ? String(row.last_editor_display).trim()
        : null
    return {
      id: row.id,
      title_clause: row.title_clause ?? null,
      code: row.code ?? null,
      description: row.description ?? null,
      status: row.status ?? null,
      updated_at: row.updated_at ?? null,
      last_edited_by: row.last_edited_by ?? null,
      updated_by: row.updated_by ?? null,
      last_edited_by_name: row.last_edited_by_name ?? null,
      updated_by_name: row.updated_by_name ?? null,
      last_editor_display: lastEditorDisplay,
    }
  }

  /**
   * Listado de cláusulas universales (sin content_json). Búsqueda opcional en título, código o descripción.
   * @param {{ search?: string }} [opts]
   */
  async function listUniversal({ search } = {}) {
    const q = typeof search === 'string' ? search.trim() : ''
    const base = db('clause as c')
      .innerJoin('clause_universal as cu', 'cu.id', 'c.id')
      .leftJoin('user_profile as up_last_list', 'up_last_list.id', 'c.last_edited_by')
      .leftJoin('user_profile as up_updated_list', 'up_updated_list.id', 'c.updated_by')
      .select(
        'c.id',
        'c.title_clause',
        'c.code',
        'c.description',
        'c.status',
        'c.updated_at',
        'c.last_edited_by',
        'c.updated_by',
        'up_last_list.full_name as last_edited_by_name',
        'up_updated_list.full_name as updated_by_name',
        db.raw(
          `COALESCE(
            NULLIF(BTRIM(up_last_list.full_name), ''),
            NULLIF(BTRIM(up_updated_list.full_name), '')
          ) as last_editor_display`
        )
      )
      .orderBy('c.updated_at', 'desc')

    if (q.length > 0) {
      const pattern = `%${q}%`
      base.where(function whereSearch() {
        this.where('c.title_clause', 'ilike', pattern)
          .orWhere('c.code', 'ilike', pattern)
          .orWhere('c.description', 'ilike', pattern)
      })
    }

    const rows = await base
    return rows.map((r) => mapUniversalListRow(r)).filter(Boolean)
  }

  function mapCompanyListRow(row) {
    if (!row) return null
    const lastEditorDisplay =
      row.last_editor_display != null && String(row.last_editor_display).trim()
        ? String(row.last_editor_display).trim()
        : null
    return {
      id: row.id,
      company_id: row.company_id ?? null,
      company_business_name: row.company_business_name ?? null,
      title_clause: row.title_clause ?? null,
      code: row.code ?? null,
      description: row.description ?? null,
      status: row.status ?? null,
      updated_at: row.updated_at ?? null,
      last_edited_by: row.last_edited_by ?? null,
      updated_by: row.updated_by ?? null,
      last_edited_by_name: row.last_edited_by_name ?? null,
      updated_by_name: row.updated_by_name ?? null,
      last_editor_display: lastEditorDisplay,
    }
  }

  /**
   * Listado de cláusulas por empresa (sin content_json) para el scope del usuario (company admin o contador).
   * Para perfil contador (mode `set`), `activeCompanyId` acota a la empresa seleccionada en sesión (header X-Company-Id).
   * @param {{ scope: { mode: 'single', companyId: string } | { mode: 'set', companyIds: string[] }, search?: string, activeCompanyId?: string | null }} opts
   */
  async function listCompanyInScope({ scope, search, activeCompanyId } = {}) {
    if (!scope || (scope.mode !== 'single' && scope.mode !== 'set')) return []

    const q = typeof search === 'string' ? search.trim() : ''

    const base = db('clause as c')
      .innerJoin('clause_company as cc', 'cc.id', 'c.id')
      .innerJoin('company as co', 'co.id', 'cc.company_id')
      .leftJoin('user_profile as up_last_list', 'up_last_list.id', 'c.last_edited_by')
      .leftJoin('user_profile as up_updated_list', 'up_updated_list.id', 'c.updated_by')
      .select(
        'c.id',
        'c.title_clause',
        db.raw('COALESCE(cc.code, c.code) as code'),
        'c.description',
        'c.status',
        'c.updated_at',
        'c.last_edited_by',
        'c.updated_by',
        'cc.company_id',
        'co.business_name as company_business_name',
        'up_last_list.full_name as last_edited_by_name',
        'up_updated_list.full_name as updated_by_name',
        db.raw(
          `COALESCE(
            NULLIF(BTRIM(up_last_list.full_name), ''),
            NULLIF(BTRIM(up_updated_list.full_name), '')
          ) as last_editor_display`
        )
      )
      .orderBy('c.updated_at', 'desc')

    if (scope.mode === 'single') {
      if (!scope.companyId) return []
      base.where('cc.company_id', scope.companyId)
    } else {
      const ids = Array.isArray(scope.companyIds) ? scope.companyIds.filter(Boolean) : []
      if (ids.length === 0) return []
      const cid = typeof activeCompanyId === 'string' && activeCompanyId.trim().length > 0 ? activeCompanyId.trim() : null
      if (!cid || !ids.includes(cid)) return []
      base.where('cc.company_id', cid)
    }

    if (q.length > 0) {
      const pattern = `%${q}%`
      base.where(function whereSearch() {
        this.where('c.title_clause', 'ilike', pattern)
          .orWhere('c.code', 'ilike', pattern)
          .orWhere('c.description', 'ilike', pattern)
      })
    }

    const rows = await base
    return rows.map((r) => mapCompanyListRow(r)).filter(Boolean)
  }

  return { getClauseDetail, createUniversal, createCompany, updateClause, listUniversal, listCompanyInScope }
}

module.exports = { createClauseService }

