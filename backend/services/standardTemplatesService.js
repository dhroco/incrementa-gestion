const { randomUUID } = require('node:crypto')
const { stableJsonStringify } = require('../lib/stableJsonStringify')

function isUniqueViolation(err) {
  return err && err.code === '23505'
}

const VALID_SUPPLIER_TYPES = ['persona_natural', 'empresa']
const VALID_TEMPLATE_STATUSES = ['active', 'inactive']

function normalizeTemplateStatus(value) {
  return VALID_TEMPLATE_STATUSES.includes(value) ? value : 'inactive'
}

function normalizeSupplierType(value) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return VALID_SUPPLIER_TYPES.includes(v) ? v : null
}

function mapTemplateRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name ?? null,
    code: row.code ?? null,
    supplier_type: row.supplier_type ?? null,
    description: row.description ?? null,
    status: row.status ?? null,
    document_type_id: row.document_type_id ?? null,
    content_json: row.content_json ?? null,
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

function createStandardTemplatesService({ db }) {
  async function getDefaultDocumentTypeId(trx) {
    const row = await trx('document_type').select('id').orderBy('created_at', 'asc').first()
    return row?.id ?? null
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
      't.code',
      't.supplier_type',
      't.description',
      't.status',
      't.document_type_id',
      't.content_json',
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

  /**
   * @param {{ name: string, code: string, supplier_type: string, description: string | null, content_json: object, status?: string, document_type_id?: string | null, actorUserProfileId: string }} input
   */
  async function createStandardTemplate(input) {
    const {
      name,
      code,
      supplier_type: supplierTypeIn,
      description,
      content_json,
      status = 'inactive',
      document_type_id: dtIn,
      actorUserProfileId,
    } = input

    const supplier_type = normalizeSupplierType(supplierTypeIn)
    if (!supplier_type) {
      return {
        ok: false,
        error: {
          type: 'invalid_supplier_type',
          message: 'El tipo de proveedor es obligatorio y debe ser persona_natural o empresa.',
        },
      }
    }

    return await db.transaction(async (trx) => {
      let document_type_id = dtIn
      if (!document_type_id) {
        document_type_id = await getDefaultDocumentTypeId(trx)
      }
      if (!document_type_id) {
        return { ok: false, error: { type: 'no_document_type', message: 'No hay tipo documental disponible para la plantilla.' } }
      }

      const id = randomUUID()
      const codeTrimmed = String(code).trim()

      try {
        await trx('template').insert({
          id,
          document_type_id,
          name: name.trim(),
          code: codeTrimmed,
          supplier_type,
          description: description === null || description === undefined ? null : String(description).trim() || null,
          content_json,
          status: normalizeTemplateStatus(status),
          created_by: actorUserProfileId,
          updated_by: actorUserProfileId,
          last_edited_by: actorUserProfileId,
        })
        await trx('template_standard').insert({ id })
      } catch (err) {
        if (isUniqueViolation(err)) {
          return {
            ok: false,
            error: {
              type: 'unique_code',
              code: 'TEMPLATE_CODE_NOT_UNIQUE',
              message: 'Ya existe una plantilla estándar con ese código.',
            },
          }
        }
        throw err
      }

      const row = await selectAuthorJoins(trx('template as t'))
        .join('template_standard as ts', 'ts.id', 't.id')
        .select(selectAuthorColumns())
        .where('t.id', id)
        .first()

      return { ok: true, template: mapTemplateRow(row) }
    })
  }

  /**
   * @param {{ search?: string, supplier_type?: string, status?: string }} [opts]
   */
  async function listStandardTemplates({ search, supplier_type: supplierTypeIn, status: statusIn } = {}) {
    const q = typeof search === 'string' ? search.trim() : ''
    const supplier_type = normalizeSupplierType(supplierTypeIn)
    let query = selectAuthorJoins(db('template as t'))
      .join('template_standard as ts', 'ts.id', 't.id')
      .select(
        't.id',
        't.name',
        't.code',
        't.supplier_type',
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
        // Misma lógica que la ficha Ver: preferir editor de último cambio de contenido, si no el de último guardado.
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
          .orWhere('t.code', 'ilike', pattern)
          .orWhere('t.description', 'ilike', pattern)
      })
    }

    if (supplier_type) {
      query = query.where('t.supplier_type', supplier_type)
    }

    if (VALID_TEMPLATE_STATUSES.includes(statusIn)) {
      query = query.where('t.status', statusIn)
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
          supplier_type: r.supplier_type ?? null,
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
   * @returns {Promise<{ ok: true, template: object } | { ok: false, notFound: true }>}
   */
  async function getStandardTemplateById(id) {
    const row = await selectAuthorJoins(db('template as t'))
      .join('template_standard as ts', 'ts.id', 't.id')
      .select(selectAuthorColumns())
      .where('t.id', id)
      .first()

    if (!row) return { ok: false, notFound: true }
    return { ok: true, template: mapTemplateRow(row) }
  }

  /**
   * @param {string} id
   * @param {{ name: string, code: string, supplier_type: string, description: string | null, content_json: object, status?: string, document_type_id?: string | null, actorUserProfileId: string }} input
   */
  async function updateStandardTemplate(id, input) {
    const {
      name,
      code,
      supplier_type: supplierTypeIn,
      description,
      content_json,
      status = 'inactive',
      document_type_id: dtIn,
      actorUserProfileId,
    } = input

    const supplier_type = normalizeSupplierType(supplierTypeIn)
    if (!supplier_type) {
      return {
        ok: false,
        error: {
          type: 'invalid_supplier_type',
          message: 'El tipo de proveedor es obligatorio y debe ser persona_natural o empresa.',
        },
      }
    }

    return await db.transaction(async (trx) => {
      const existingRow = await trx('template as t')
        .join('template_standard as ts', 'ts.id', 't.id')
        .select('t.id', 't.document_type_id', 't.content_json')
        .where('t.id', id)
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

      const contentChanged = stableJsonStringify(content_json) !== stableJsonStringify(existingRow.content_json)
      const codeTrimmed = String(code).trim()

      const patch = {
        name: name.trim(),
        code: codeTrimmed,
        supplier_type,
        description: description === null || description === undefined ? null : String(description).trim() || null,
        content_json,
        status: normalizeTemplateStatus(status),
        document_type_id,
        updated_by: actorUserProfileId,
        updated_at: new Date(),
      }
      if (contentChanged) {
        patch.last_edited_by = actorUserProfileId
      }

      try {
        await trx('template').where({ id }).update(patch)
      } catch (err) {
        if (isUniqueViolation(err)) {
          return {
            ok: false,
            error: {
              type: 'unique_code',
              code: 'TEMPLATE_CODE_NOT_UNIQUE',
              message: 'Ya existe una plantilla estándar con ese código.',
            },
          }
        }
        throw err
      }

      const row = await selectAuthorJoins(trx('template as t'))
        .join('template_standard as ts', 'ts.id', 't.id')
        .select(selectAuthorColumns())
        .where('t.id', id)
        .first()

      return { ok: true, template: mapTemplateRow(row) }
    })
  }

  return {
    createStandardTemplate,
    listStandardTemplates,
    getStandardTemplateById,
    updateStandardTemplate,
  }
}

module.exports = { createStandardTemplatesService }
