const { db: defaultDb } = require('../db/knex')
const { gcsService: defaultGcsService } = require('./gcsService')

const DEFAULT_PAGE_SIZE = 18
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return n
}

function normalizeStatus(value) {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (s === 'draft' || s === 'signed') return s
  return 'all'
}

function normalizeFilters(filters = {}) {
  return {
    supplierSearch: typeof filters.supplierSearch === 'string' ? filters.supplierSearch.trim() : '',
    supplierId: typeof filters.supplierId === 'string' && filters.supplierId.trim() ? filters.supplierId.trim() : null,
    clientId: typeof filters.clientId === 'string' && filters.clientId.trim() ? filters.clientId.trim() : null,
    templateId:
      typeof filters.templateId === 'string' && filters.templateId.trim() ? filters.templateId.trim() : null,
    redSocialSearch: typeof filters.redSocialSearch === 'string' ? filters.redSocialSearch.trim() : '',
    status: normalizeStatus(filters.status)
  }
}

function applySharedFilters(q, filters, alias) {
  const prefix = alias ? `${alias}.` : ''

  if (filters.supplierId) {
    q.andWhere(`${prefix}supplier_id`, filters.supplierId)
  } else if (filters.supplierSearch) {
    const term = `%${filters.supplierSearch}%`
    q.andWhere(function supplierSearchWhere() {
      this.whereILike('spn.full_name', term).orWhereILike('se.razon_social', term)
    })
  }

  if (filters.clientId) {
    q.andWhere(`${prefix}client_id`, filters.clientId)
  }

  if (filters.templateId) {
    q.andWhere(`${prefix}template_id`, filters.templateId)
  }

  if (filters.redSocialSearch) {
    const term = `%${filters.redSocialSearch}%`
    q.andWhereRaw(`${prefix}contract_overrides->>'proveedor_red_social' ILIKE ?`, [term])
  }

  return q
}

function buildDraftSubquery(db, filters) {
  const q = db('draft_document as dd')
    .join('supplier as s', 's.id', 'dd.supplier_id')
    .leftJoin('supplier_persona_natural as spn', 'spn.supplier_id', 's.id')
    .leftJoin('supplier_empresa as se', 'se.supplier_id', 's.id')
    .leftJoin('client as c', 'c.id', 'dd.client_id')
    .leftJoin('template as t', 't.id', 'dd.template_id')
    .whereNot('dd.status', 'rejected')
    .whereNot('dd.status', 'signed')
    .select(
      'dd.id',
      db.raw("'draft' as source"),
      'dd.supplier_id',
      'dd.company_id',
      'dd.client_id',
      'dd.template_id',
      'dd.file_name',
      'dd.gcs_path',
      'dd.status',
      'dd.created_at',
      'dd.contract_overrides',
      db.raw('COALESCE(se.razon_social, spn.full_name) as supplier_name'),
      's.supplier_type',
      'c.name as client_name',
      't.name as template_name'
    )

  applySharedFilters(q, filters, 'dd')
  return q
}

function buildSignedSubquery(db, filters) {
  const q = db('document as d')
    .join('supplier as s', 's.id', 'd.supplier_id')
    .leftJoin('supplier_persona_natural as spn', 'spn.supplier_id', 's.id')
    .leftJoin('supplier_empresa as se', 'se.supplier_id', 's.id')
    .leftJoin('client as c', 'c.id', 'd.client_id')
    .leftJoin('template as t', 't.id', 'd.template_id')
    .select(
      'd.id',
      db.raw("'signed' as source"),
      'd.supplier_id',
      'd.company_id',
      'd.client_id',
      'd.template_id',
      'd.file_name',
      'd.gcs_path',
      db.raw("'signed' as status"),
      'd.created_at',
      'd.contract_overrides',
      db.raw('COALESCE(se.razon_social, spn.full_name) as supplier_name'),
      's.supplier_type',
      'c.name as client_name',
      't.name as template_name'
    )

  applySharedFilters(q, filters, 'd')
  return q
}

function buildUnionQuery(db, filters) {
  if (filters.status === 'draft') {
    return buildDraftSubquery(db, filters)
  }
  if (filters.status === 'signed') {
    return buildSignedSubquery(db, filters)
  }
  const draftQ = buildDraftSubquery(db, filters)
  const signedQ = buildSignedSubquery(db, filters)
  return draftQ.unionAll([signedQ])
}

function mapContractListItem(row) {
  const overrides =
    row?.contract_overrides && typeof row.contract_overrides === 'object'
      ? row.contract_overrides
      : {}

  return {
    id: row.id,
    source: row.source,
    supplier_name: row.supplier_name ?? null,
    supplier_type: row.supplier_type ?? null,
    client_name: row.client_name ?? null,
    template_name: row.template_name ?? null,
    file_name: row.file_name,
    gcs_path: row.gcs_path,
    status: row.status,
    created_at: row.created_at ?? null,
    fecha_contrato: overrides.fecha_contrato ?? null,
    mes_ejecucion: overrides.mes_ejecucion ?? null,
    proveedor_red_social: overrides.proveedor_red_social ?? null,
    proveedor_cuenta_social: overrides.proveedor_cuenta_social ?? null,
    precio_numero: overrides.precio_numero ?? null
  }
}

function createContractsQueryService({ db = defaultDb, gcsService = defaultGcsService } = {}) {
  async function listContracts({ page = 1, pageSize = DEFAULT_PAGE_SIZE, filters = {} } = {}) {
    const safePage = parsePositiveInt(page, 1)
    let safePageSize = parsePositiveInt(pageSize, DEFAULT_PAGE_SIZE)
    if (safePageSize > MAX_PAGE_SIZE) safePageSize = MAX_PAGE_SIZE

    const normalizedFilters = normalizeFilters(filters)
    const unionQuery = buildUnionQuery(db, normalizedFilters)
    const unionAlias = db.raw('(?) as contracts_union', [unionQuery])

    const countRow = await db.count('* as count').from(unionAlias).first()
    const total = Number(countRow?.count ?? 0)
    const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize)
    const offset = (safePage - 1) * safePageSize

    const rows = await db
      .select('*')
      .from(unionAlias)
      .orderBy('created_at', 'desc')
      .limit(safePageSize)
      .offset(offset)

    return {
      ok: true,
      data: {
        items: rows.map(mapContractListItem),
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          total,
          totalPages
        }
      }
    }
  }

  async function getContractPdf({ id, source }) {
    const normalizedSource = typeof source === 'string' ? source.trim().toLowerCase() : ''
    if (normalizedSource !== 'draft' && normalizedSource !== 'signed') {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Parámetro source inválido. Use draft o signed.'
      }
    }

    const table = normalizedSource === 'draft' ? 'draft_document' : 'document'
    const columns =
      normalizedSource === 'draft'
        ? ['id', 'file_name', 'gcs_path', 'status']
        : ['id', 'file_name', 'gcs_path']

    const row = await db(table).select(columns).where({ id }).first()

    if (!row) {
      return {
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'Contrato no encontrado.'
      }
    }

    if (normalizedSource === 'draft' && row.status === 'rejected') {
      return {
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'Contrato no encontrado.'
      }
    }

    const buffer = await gcsService.downloadBuffer({ gcsPath: row.gcs_path })
    return {
      ok: true,
      data: {
        file_name: row.file_name,
        buffer
      }
    }
  }

  return {
    listContracts,
    getContractPdf
  }
}

const defaultService = createContractsQueryService()

module.exports = {
  createContractsQueryService,
  mapContractListItem,
  normalizeFilters,
  listContracts: defaultService.listContracts,
  getContractPdf: defaultService.getContractPdf
}
