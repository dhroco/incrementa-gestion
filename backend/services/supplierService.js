const { db } = require('../db/knex')
const { parseRut } = require('../utils/rut')
const { gcsService } = require('./gcsService')

const SUPPLIER_TYPES = new Set(['persona_natural', 'empresa'])
const PERSONERIA_TYPES = new Set(['empresa_en_un_dia', 'escritura_publica'])

const PERSONA_FIELDS = new Set(['full_name', 'rut_body', 'rut_dv', 'address'])
const EMPRESA_FIELDS = new Set([
  'razon_social',
  'rut_empresa_body',
  'rut_empresa_dv',
  'giro',
  'direccion_empresa',
  'nombre_rep_legal',
  'rut_rep_legal_body',
  'rut_rep_legal_dv',
  'personeria_type',
  'fecha_certificado_estatuto',
  'codigo_cve',
  'fecha_escritura_publica',
  'nombre_notaria',
  'nombre_notario'
])

function formatRutDisplay(rutBody, rutDv) {
  const body = String(rutBody || '').replace(/\D/g, '')
  const dv = String(rutDv || '').toUpperCase()
  if (!body) return ''
  const parts = []
  let i = body.length
  while (i > 0) {
    const start = Math.max(0, i - 3)
    parts.unshift(body.slice(start, i))
    i = start
  }
  return dv ? `${parts.join('.')}-${dv}` : parts.join('.')
}

function parseISODate(s) {
  if (s == null || s === '') return { ok: true, value: null }
  const t = String(s).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false, message: 'Use el formato AAAA-MM-DD.' }
  const d = new Date(`${t}T12:00:00`)
  if (Number.isNaN(d.getTime())) return { ok: false, message: 'La fecha no es válida.' }
  return { ok: true, value: t }
}

function parseOptionalRut(input) {
  if (input == null || String(input).trim() === '') {
    return { ok: true, rut_body: null, rut_dv: null }
  }
  const r = parseRut(input)
  if (!r.ok) return r
  return { ok: true, rut_body: r.rut_body, rut_dv: r.rut_dv }
}

function trimOrNull(v) {
  if (v == null || String(v).trim() === '') return null
  return String(v).trim()
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function validateSocialNetworks(raw, trxOrDb = db) {
  if (raw == null) return { ok: true, value: [] }
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'Las redes sociales deben ser una lista.' }
  }

  const catalogRows = await trxOrDb('social_network_catalog').select('id')
  const validCatalogIds = new Set(catalogRows.map((r) => r.id))

  const value = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    const catalog_id = trimOrNull(row?.catalog_id)
    const account_name = trimOrNull(row?.account_name)
    if (!catalog_id && !account_name) continue
    if (!catalog_id || !account_name) {
      return { ok: false, message: 'Cada red social debe tener plataforma y cuenta.' }
    }
    if (!UUID_RE.test(catalog_id)) {
      return { ok: false, message: 'La red social seleccionada no es válida.' }
    }
    if (!validCatalogIds.has(catalog_id)) {
      return { ok: false, message: 'La red social seleccionada no es válida.' }
    }
    value.push({
      catalog_id,
      account_name,
      sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : i
    })
  }
  return { ok: true, value }
}

function validatePayload(body, { partial = false, existingType = null } = {}) {
  const errors = []
  const out = {}

  let supplierType = existingType
  if (!partial || body?.supplier_type !== undefined) {
    supplierType = typeof body?.supplier_type === 'string' ? body.supplier_type.trim() : ''
    if (!partial && !supplierType) errors.push('Debe indicar el tipo de proveedor.')
    else if (supplierType && !SUPPLIER_TYPES.has(supplierType)) {
      errors.push('El tipo de proveedor no es válido.')
    } else if (supplierType) {
      out.supplier_type = supplierType
    }
  }

  const type = out.supplier_type ?? existingType

  if (type === 'persona_natural') {
    if (!partial || body?.full_name !== undefined) {
      const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
      if (!fullName) errors.push('El nombre completo es obligatorio.')
      else out.full_name = fullName
    }
    if (!partial || body?.rut !== undefined) {
      if (body?.rut == null || String(body.rut).trim() === '') {
        errors.push('El RUT es obligatorio.')
      } else {
        const r = parseRut(body.rut)
        if (!r.ok) errors.push(r.message)
        else {
          out.rut_body = r.rut_body
          out.rut_dv = r.rut_dv
        }
      }
    }
    if (!partial || body?.address !== undefined) {
      out.address = trimOrNull(body?.address)
    }
  } else if (type === 'empresa') {
    if (!partial || body?.razon_social !== undefined) {
      const rs = typeof body?.razon_social === 'string' ? body.razon_social.trim() : ''
      if (!rs) errors.push('La razón social es obligatoria.')
      else out.razon_social = rs
    }
    if (!partial || body?.rut_empresa !== undefined) {
      if (body?.rut_empresa == null || String(body.rut_empresa).trim() === '') {
        errors.push('El RUT de la empresa es obligatorio.')
      } else {
        const r = parseRut(body.rut_empresa)
        if (!r.ok) errors.push(r.message)
        else {
          out.rut_empresa_body = r.rut_body
          out.rut_empresa_dv = r.rut_dv
        }
      }
    }
    if (!partial || body?.giro !== undefined) out.giro = trimOrNull(body?.giro)
    if (!partial || body?.direccion_empresa !== undefined) {
      out.direccion_empresa = trimOrNull(body?.direccion_empresa)
    }
    if (!partial || body?.nombre_rep_legal !== undefined) {
      out.nombre_rep_legal = trimOrNull(body?.nombre_rep_legal)
    }
    if (!partial || body?.rut_rep_legal !== undefined) {
      const r = parseOptionalRut(body?.rut_rep_legal)
      if (!r.ok) errors.push(r.message)
      else {
        out.rut_rep_legal_body = r.rut_body
        out.rut_rep_legal_dv = r.rut_dv
      }
    }

    if (!partial || body?.personeria_type !== undefined) {
      const pt = body?.personeria_type == null || String(body.personeria_type).trim() === ''
        ? null
        : String(body.personeria_type).trim()
      if (pt && !PERSONERIA_TYPES.has(pt)) {
        errors.push('El tipo de acreditación de personería no es válido.')
      } else {
        out.personeria_type = pt
      }
    }

    const personeria = out.personeria_type ?? (partial ? undefined : null)
    const effectivePersoneria = personeria !== undefined ? personeria : body?.personeria_type ?? null

    if (effectivePersoneria === 'empresa_en_un_dia') {
      if (!partial || body?.fecha_certificado_estatuto !== undefined) {
        const d = parseISODate(body?.fecha_certificado_estatuto)
        if (!d.ok) errors.push(d.message)
        else out.fecha_certificado_estatuto = d.value
      }
      if (!partial || body?.codigo_cve !== undefined) {
        out.codigo_cve = trimOrNull(body?.codigo_cve)
      }
      out.fecha_escritura_publica = null
      out.nombre_notaria = null
      out.nombre_notario = null
    } else if (effectivePersoneria === 'escritura_publica') {
      if (!partial || body?.fecha_escritura_publica !== undefined) {
        const d = parseISODate(body?.fecha_escritura_publica)
        if (!d.ok) errors.push(d.message)
        else out.fecha_escritura_publica = d.value
      }
      if (!partial || body?.nombre_notaria !== undefined) {
        out.nombre_notaria = trimOrNull(body?.nombre_notaria)
      }
      if (!partial || body?.nombre_notario !== undefined) {
        out.nombre_notario = trimOrNull(body?.nombre_notario)
      }
      out.fecha_certificado_estatuto = null
      out.codigo_cve = null
    } else if (!partial || body?.personeria_type !== undefined) {
      out.fecha_certificado_estatuto = null
      out.codigo_cve = null
      out.fecha_escritura_publica = null
      out.nombre_notaria = null
      out.nombre_notario = null
    }
  }

  if (errors.length) {
    return { ok: false, errors }
  }
  return { ok: true, data: out }
}

function supplierJoinQuery(trxOrDb = db) {
  return trxOrDb('supplier as s')
    .leftJoin('supplier_persona_natural as spn', 'spn.supplier_id', 's.id')
    .leftJoin('supplier_empresa as se', 'se.supplier_id', 's.id')
    .select(
      's.id',
      's.supplier_type',
      's.created_at',
      's.updated_at',
      's.created_by',
      's.updated_by',
      'spn.full_name',
      'spn.rut_body',
      'spn.rut_dv',
      'spn.address',
      'se.razon_social',
      'se.rut_empresa_body',
      'se.rut_empresa_dv',
      'se.giro',
      'se.direccion_empresa',
      'se.nombre_rep_legal',
      'se.rut_rep_legal_body',
      'se.rut_rep_legal_dv',
      'se.personeria_type',
      'se.fecha_certificado_estatuto',
      'se.codigo_cve',
      'se.fecha_escritura_publica',
      'se.nombre_notaria',
      'se.nombre_notario'
    )
}

function mapSocialNetworkRow(r) {
  return {
    id: r.id,
    catalog_id: r.catalog_id,
    code: r.code,
    name: r.name,
    account_name: r.account_name,
    sort_order: r.sort_order
  }
}

function socialNetworkSelectColumns() {
  return [
    'ssn.id',
    'ssn.supplier_id',
    'ssn.catalog_id',
    'ssn.account_name',
    'ssn.sort_order',
    'snc.code',
    'snc.name'
  ]
}

function socialNetworkBaseQuery(trxOrDb = db) {
  return trxOrDb('supplier_social_network as ssn').join(
    'social_network_catalog as snc',
    'snc.id',
    'ssn.catalog_id'
  )
}

/**
 * Normaliza fila del JOIN CTI a objeto plano con contrato API estable.
 * @param {object} row
 * @param {object[]} [socialNetworks]
 */
function normalizeSupplier(row, socialNetworks = []) {
  const isEmpresa = row.supplier_type === 'empresa'
  const displayName = isEmpresa ? row.razon_social : row.full_name
  const rut = isEmpresa
    ? formatRutDisplay(row.rut_empresa_body, row.rut_empresa_dv)
    : formatRutDisplay(row.rut_body, row.rut_dv)

  return {
    id: row.id,
    supplier_type: row.supplier_type,
    display_name: displayName,
    rut,
    full_name: row.full_name ?? null,
    rut_body: row.rut_body ?? null,
    rut_dv: row.rut_dv ?? null,
    rut_display: formatRutDisplay(row.rut_body, row.rut_dv),
    address: row.address ?? null,
    razon_social: row.razon_social ?? null,
    rut_empresa_body: row.rut_empresa_body ?? null,
    rut_empresa_dv: row.rut_empresa_dv ?? null,
    rut_empresa_display: formatRutDisplay(row.rut_empresa_body, row.rut_empresa_dv),
    giro: row.giro ?? null,
    direccion_empresa: row.direccion_empresa ?? null,
    nombre_rep_legal: row.nombre_rep_legal ?? null,
    rut_rep_legal_body: row.rut_rep_legal_body ?? null,
    rut_rep_legal_dv: row.rut_rep_legal_dv ?? null,
    rut_rep_legal_display: formatRutDisplay(row.rut_rep_legal_body, row.rut_rep_legal_dv),
    personeria_type: row.personeria_type ?? null,
    fecha_certificado_estatuto: row.fecha_certificado_estatuto ?? null,
    codigo_cve: row.codigo_cve ?? null,
    fecha_escritura_publica: row.fecha_escritura_publica ?? null,
    nombre_notaria: row.nombre_notaria ?? null,
    nombre_notario: row.nombre_notario ?? null,
    social_networks: socialNetworks.map(mapSocialNetworkRow),
    social_network_count: socialNetworks.length,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

async function loadSocialNetworksBySupplierIds(supplierIds, trxOrDb = db) {
  if (!supplierIds.length) return new Map()
  const rows = await socialNetworkBaseQuery(trxOrDb)
    .whereIn('ssn.supplier_id', supplierIds)
    .select(socialNetworkSelectColumns())
    .orderBy(['ssn.supplier_id', 'ssn.sort_order', 'snc.name'])
  const map = new Map()
  for (const r of rows) {
    const list = map.get(r.supplier_id) || []
    list.push(r)
    map.set(r.supplier_id, list)
  }
  return map
}

function splitChildFields(d, supplierType) {
  const child = {}
  const fieldSet = supplierType === 'persona_natural' ? PERSONA_FIELDS : EMPRESA_FIELDS
  for (const key of Object.keys(d)) {
    if (fieldSet.has(key)) child[key] = d[key]
  }
  return child
}

async function listSuppliers({ search = '' } = {}) {
  const qb = supplierJoinQuery()

  const term = String(search || '').trim()
  if (term.length > 0) {
    const t = `%${term}%`
    const digits = term.replace(/\D/g, '')
    qb.andWhere((w) => {
      w.whereILike('spn.full_name', t)
        .orWhereILike('spn.rut_body', t)
        .orWhereILike('se.razon_social', t)
        .orWhereILike('se.rut_empresa_body', t)
      if (digits.length) {
        w.orWhereILike('spn.rut_body', `%${digits}%`).orWhereILike('se.rut_empresa_body', `%${digits}%`)
      }
    })
  }

  const rows = await qb
    .orderByRaw("CASE s.supplier_type WHEN 'empresa' THEN 0 ELSE 1 END")
    .orderByRaw('COALESCE(se.razon_social, spn.full_name) ASC')

  const ids = rows.map((r) => r.id)
  const networksMap = await loadSocialNetworksBySupplierIds(ids)
  const items = rows.map((r) => normalizeSupplier(r, networksMap.get(r.id) || []))

  return { ok: true, data: { items } }
}

async function getSupplierById(id) {
  const row = await supplierJoinQuery().where('s.id', id).first()
  if (!row) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Proveedor no encontrado.' }
  }
  const networks = await socialNetworkBaseQuery()
    .where({ 'ssn.supplier_id': id })
    .select(socialNetworkSelectColumns())
    .orderBy(['ssn.sort_order', 'snc.name'])
  return { ok: true, data: { supplier: normalizeSupplier(row, networks) } }
}

async function insertSocialNetworks(trx, supplierId, socialNetworks) {
  if (!socialNetworks?.length) return
  await trx('supplier_social_network').insert(
    socialNetworks.map((sn, i) => ({
      supplier_id: supplierId,
      catalog_id: sn.catalog_id,
      account_name: sn.account_name,
      sort_order: sn.sort_order ?? i
    }))
  )
}

async function insertChildRow(trx, supplierId, supplierType, childFields) {
  if (supplierType === 'persona_natural') {
    await trx('supplier_persona_natural').insert({
      supplier_id: supplierId,
      full_name: childFields.full_name,
      rut_body: childFields.rut_body,
      rut_dv: childFields.rut_dv,
      address: childFields.address ?? null
    })
    return
  }
  await trx('supplier_empresa').insert({
    supplier_id: supplierId,
    razon_social: childFields.razon_social,
    rut_empresa_body: childFields.rut_empresa_body,
    rut_empresa_dv: childFields.rut_empresa_dv,
    giro: childFields.giro ?? null,
    direccion_empresa: childFields.direccion_empresa ?? null,
    nombre_rep_legal: childFields.nombre_rep_legal ?? null,
    rut_rep_legal_body: childFields.rut_rep_legal_body ?? null,
    rut_rep_legal_dv: childFields.rut_rep_legal_dv ?? null,
    personeria_type: childFields.personeria_type ?? null,
    fecha_certificado_estatuto: childFields.fecha_certificado_estatuto ?? null,
    codigo_cve: childFields.codigo_cve ?? null,
    fecha_escritura_publica: childFields.fecha_escritura_publica ?? null,
    nombre_notaria: childFields.nombre_notaria ?? null,
    nombre_notario: childFields.nombre_notario ?? null
  })
}

async function updateChildRow(trx, supplierId, supplierType, childFields) {
  if (!Object.keys(childFields).length) return
  const table = supplierType === 'persona_natural' ? 'supplier_persona_natural' : 'supplier_empresa'
  await trx(table).where({ supplier_id: supplierId }).update(childFields)
}

async function listSocialNetworkCatalog() {
  const rows = await db('social_network_catalog')
    .select('id', 'code', 'name', 'sort_order')
    .orderBy('sort_order', 'asc')
  return { ok: true, data: { items: rows } }
}

async function createSupplier({ payload, userId }) {
  const v = validatePayload(payload, { partial: false })
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors[0] || 'Datos inválidos.' }
  }
  const d = v.data

  let socialNetworks = []
  if (payload?.social_networks != null) {
    const sn = await validateSocialNetworks(payload.social_networks)
    if (!sn.ok) {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: sn.message }
    }
    socialNetworks = sn.value
  }
  const supplierType = d.supplier_type
  const childFields = splitChildFields(d, supplierType)

  const result = await db.transaction(async (trx) => {
    const [ins] = await trx('supplier')
      .insert({
        supplier_type: supplierType,
        created_by: userId ?? null,
        updated_by: userId ?? null,
        updated_at: trx.fn.now()
      })
      .returning('id')
    const newId = ins && typeof ins === 'object' ? ins.id : ins
    await insertChildRow(trx, newId, supplierType, childFields)
    await insertSocialNetworks(trx, newId, socialNetworks)
    return newId
  })

  return getSupplierById(result)
}

async function listSupplierDocuments(supplierId) {
  const exists = await db('supplier').select('id').where({ id: supplierId }).first()
  if (!exists) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Proveedor no encontrado.' }
  }

  const signedRows = await db('document as d')
    .leftJoin('template as t', 't.id', 'd.template_id')
    .select(
      'd.id',
      't.name as template_name',
      'd.file_name',
      'd.signed_at',
      'd.effective_from',
      'd.effective_until'
    )
    .where('d.supplier_id', supplierId)
    .orderBy('d.signed_at', 'desc')
    .orderBy('d.created_at', 'desc')

  const draftRows = await db('draft_document as dd')
    .leftJoin('template as t', 't.id', 'dd.template_id')
    .select('dd.id', 't.name as template_name', 'dd.file_name', 'dd.status', 'dd.created_at')
    .where('dd.supplier_id', supplierId)
    .whereNot('dd.status', 'signed')
    .orderBy('dd.created_at', 'desc')

  return {
    ok: true,
    data: {
      signed_documents: signedRows.map((r) => ({
        id: r.id,
        template_name: r.template_name ?? null,
        file_name: r.file_name,
        signed_at: r.signed_at ?? null,
        effective_from: r.effective_from ?? null,
        effective_until: r.effective_until ?? null
      })),
      draft_documents: draftRows.map((r) => ({
        id: r.id,
        template_name: r.template_name ?? null,
        file_name: r.file_name,
        status: r.status,
        created_at: r.created_at ?? null
      }))
    }
  }
}

async function getSupplierDocumentForView(supplierId, documentId) {
  const supplierExists = await db('supplier').select('id').where({ id: supplierId }).first()
  if (!supplierExists) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Proveedor no encontrado.' }
  }

  const signed = await db('document')
    .select('id', 'file_name', 'gcs_path')
    .where({ id: documentId, supplier_id: supplierId })
    .first()

  if (signed) {
    const buffer = await gcsService.downloadBuffer({ gcsPath: signed.gcs_path })
    return { ok: true, data: { file_name: signed.file_name, buffer } }
  }

  const draft = await db('draft_document')
    .select('id', 'file_name', 'gcs_path')
    .where({ id: documentId, supplier_id: supplierId })
    .first()

  if (draft) {
    const buffer = await gcsService.downloadBuffer({ gcsPath: draft.gcs_path })
    return { ok: true, data: { file_name: draft.file_name, buffer } }
  }

  return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Documento no encontrado.' }
}

async function updateSupplier(id, { payload, userId }) {
  const existing = await db('supplier').select('id', 'supplier_type').where({ id }).first()
  if (!existing) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Proveedor no encontrado.' }
  }

  if (payload?.supplier_type && payload.supplier_type !== existing.supplier_type) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'El tipo de proveedor no puede modificarse.'
    }
  }

  const v = validatePayload(payload, { partial: true, existingType: existing.supplier_type })
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors[0] || 'Datos inválidos.' }
  }
  const d = v.data
  delete d.supplier_type

  let socialNetworks
  if (payload?.social_networks !== undefined) {
    const sn = await validateSocialNetworks(payload.social_networks)
    if (!sn.ok) {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: sn.message }
    }
    socialNetworks = sn.value
  }

  const childFields = splitChildFields(d, existing.supplier_type)
  const hasChildUpdate = Object.keys(childFields).length > 0
  const hasSocialUpdate = socialNetworks !== undefined

  if (!hasChildUpdate && !hasSocialUpdate) {
    return getSupplierById(id)
  }

  await db.transaction(async (trx) => {
    await trx('supplier').where({ id }).update({
      updated_by: userId ?? null,
      updated_at: trx.fn.now()
    })
    if (hasChildUpdate) {
      await updateChildRow(trx, id, existing.supplier_type, childFields)
    }
    if (hasSocialUpdate) {
      await trx('supplier_social_network').where({ supplier_id: id }).del()
      await insertSocialNetworks(trx, id, socialNetworks)
    }
  })

  return getSupplierById(id)
}

module.exports = {
  listSuppliers,
  getSupplierById,
  listSocialNetworkCatalog,
  listSupplierDocuments,
  getSupplierDocumentForView,
  createSupplier,
  updateSupplier,
  normalizeSupplier,
  _formatRutDisplay: formatRutDisplay,
  _validateSocialNetworks: validateSocialNetworks
}
