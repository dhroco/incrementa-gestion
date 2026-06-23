const { db } = require('../db/knex')

function trimOrNull(v) {
  if (v == null || String(v).trim() === '') return null
  return String(v).trim()
}

function mapCampaignRow(r) {
  return {
    id: r.id,
    name: r.name,
    sort_order: r.sort_order
  }
}

function normalizeClient(row, campaigns = []) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    brand_account: row.brand_account ?? null,
    product_campaigns: campaigns.map(mapCampaignRow),
    product_campaign_count: campaigns.length,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null
  }
}

function validateProductCampaigns(raw) {
  if (raw == null) return { ok: true, value: [] }
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'Las campañas deben ser una lista.' }
  }
  const value = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    const name = trimOrNull(row?.name)
    if (!name) continue
    value.push({ name, sort_order: i })
  }
  return { ok: true, value }
}

function validatePayload(body) {
  const errors = []
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const brand = typeof body?.brand === 'string' ? body.brand.trim() : ''
  if (!name) errors.push('El nombre es obligatorio.')
  if (!brand) errors.push('La marca es obligatoria.')
  if (errors.length) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    data: {
      name,
      brand,
      brand_account: trimOrNull(body?.brand_account)
    }
  }
}

async function loadCampaignsByClientIds(clientIds, trxOrDb = db) {
  if (!clientIds.length) return new Map()
  const rows = await trxOrDb('client_product_campaign')
    .whereIn('client_id', clientIds)
    .select('id', 'client_id', 'name', 'sort_order')
    .orderBy(['client_id', 'sort_order', 'name'])
  const map = new Map()
  for (const r of rows) {
    const list = map.get(r.client_id) || []
    list.push(r)
    map.set(r.client_id, list)
  }
  return map
}

async function insertProductCampaigns(trx, clientId, campaigns) {
  if (!campaigns?.length) return
  await trx('client_product_campaign').insert(
    campaigns.map((c, i) => ({
      client_id: clientId,
      name: c.name,
      sort_order: c.sort_order ?? i
    }))
  )
}

async function listClients({ search = '' } = {}) {
  const qb = db('client').select(
    'id',
    'name',
    'brand',
    'brand_account',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by'
  )

  const term = String(search || '').trim()
  if (term.length > 0) {
    const t = `%${term}%`
    qb.andWhere((w) => {
      w.whereILike('name', t).orWhereILike('brand', t)
    })
  }

  const rows = await qb.orderBy('name', 'asc')
  const ids = rows.map((r) => r.id)
  const campaignsMap = await loadCampaignsByClientIds(ids)
  const items = rows.map((r) => normalizeClient(r, campaignsMap.get(r.id) || []))

  return { ok: true, data: { items } }
}

async function getClientById(id) {
  const row = await db('client')
    .select(
      'id',
      'name',
      'brand',
      'brand_account',
      'created_at',
      'updated_at',
      'created_by',
      'updated_by'
    )
    .where({ id })
    .first()

  if (!row) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Cliente no encontrado.' }
  }

  const campaigns = await db('client_product_campaign')
    .where({ client_id: id })
    .select('id', 'client_id', 'name', 'sort_order')
    .orderBy(['sort_order', 'name'])

  return { ok: true, data: { client: normalizeClient(row, campaigns) } }
}

async function createClient({ payload, userId }) {
  const v = validatePayload(payload)
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors[0] || 'Datos inválidos.' }
  }

  const pc = validateProductCampaigns(payload?.product_campaigns)
  if (!pc.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: pc.message }
  }

  const newId = await db.transaction(async (trx) => {
    const [ins] = await trx('client')
      .insert({
        name: v.data.name,
        brand: v.data.brand,
        brand_account: v.data.brand_account,
        created_by: userId ?? null,
        updated_by: userId ?? null,
        updated_at: trx.fn.now()
      })
      .returning('id')
    const clientId = ins && typeof ins === 'object' ? ins.id : ins
    await insertProductCampaigns(trx, clientId, pc.value)
    return clientId
  })

  return getClientById(newId)
}

async function updateClient(id, { payload, userId }) {
  const existing = await db('client').select('id').where({ id }).first()
  if (!existing) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Cliente no encontrado.' }
  }

  const v = validatePayload(payload)
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors[0] || 'Datos inválidos.' }
  }

  const pc = validateProductCampaigns(payload?.product_campaigns)
  if (!pc.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: pc.message }
  }

  await db.transaction(async (trx) => {
    await trx('client')
      .where({ id })
      .update({
        name: v.data.name,
        brand: v.data.brand,
        brand_account: v.data.brand_account,
        updated_by: userId ?? null,
        updated_at: trx.fn.now()
      })
    await trx('client_product_campaign').where({ client_id: id }).delete()
    await insertProductCampaigns(trx, id, pc.value)
  })

  return getClientById(id)
}

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient
}
