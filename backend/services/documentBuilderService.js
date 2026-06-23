const { randomUUID } = require('node:crypto')
const { resolveReadableCompanyId } = require('../lib/resolveReadableCompanyId')
const { tipTapDocToPlainTextAsync } = require('../utils/tipTapPlainText')
const {
  buildSubstitutionMap,
  applySubstitutionsToTipTapDoc,
  unresolvedKeys
} = require('./documentBuilderVariableContext')
const { buildPdfBytesFromTipTapWithReactPdf } = require('./documentBuilderTipTapReactPdf')
const supplierServiceDefault = require('./supplierService')
const clientServiceDefault = require('./clientService')
const { numberToWords } = require('../utils/numberToWords')

const SECONDARY_FIELDS = {
  proveedor_cuenta_social: 'proveedor_red_social',
  precio_texto: 'precio_numero'
}

const VARIABLE_META = {
  // Proveedor — source: 'supplier' → Claude debe actualizar el proveedor antes de generar
  proveedor_nombre:        { label: 'Nombre / Razón Social', type: 'text',   source: 'supplier' },
  proveedor_rut:           { label: 'RUT Proveedor',         type: 'text',   source: 'supplier' },
  proveedor_direccion:     { label: 'Dirección Proveedor',   type: 'text',   source: 'supplier' },
  proveedor_giro:          { label: 'Giro',                  type: 'text',   source: 'supplier' },
  proveedor_rep_legal:     { label: 'Nombre Rep. Legal',     type: 'text',   source: 'supplier' },
  proveedor_rep_legal_rut: { label: 'RUT Rep. Legal',        type: 'text',   source: 'supplier' },
  proveedor_red_social:    { label: 'Red Social',            type: 'select', source: 'supplier' },
  proveedor_cuenta_social: { label: 'Cuenta Red Social',     type: 'text',   source: 'supplier' },
  // Empresa — source: 'company' → dato de la empresa emisora, raro que falte
  company_legal_name:     { label: 'Razón Social Empresa',      type: 'text', source: 'company' },
  company_nombre_comercial: { label: 'Nombre Comercial',        type: 'text', source: 'company' },
  company_rut:            { label: 'RUT Empresa',               type: 'text', source: 'company' },
  company_email:          { label: 'Email Empresa',             type: 'text', source: 'company' },
  company_address:        { label: 'Dirección Empresa',         type: 'text', source: 'company' },
  company_commune:        { label: 'Comuna',                    type: 'text', source: 'company' },
  company_city:           { label: 'Ciudad',                    type: 'text', source: 'company' },
  company_region:         { label: 'Región',                    type: 'text', source: 'company' },
  company_legal_rep1_name:{ label: 'Nombre Rep. Legal 1',       type: 'text', source: 'company' },
  company_legal_rep1_rut: { label: 'RUT Rep. Legal 1',          type: 'text', source: 'company' },
  company_legal_rep2_name:{ label: 'Nombre Rep. Legal 2',       type: 'text', source: 'company' },
  company_legal_rep2_rut: { label: 'RUT Rep. Legal 2',          type: 'text', source: 'company' },
  // Cliente — source: 'client' → Claude debe actualizar el cliente antes de generar
  client_name:             { label: 'Nombre Cliente',    type: 'text',   source: 'client' },
  client_brand:            { label: 'Marca',             type: 'text',   source: 'client' },
  client_brand_account:    { label: 'Cuenta Marca',      type: 'text',   source: 'client' },
  client_product_campaign: { label: 'Producto/Campaña',  type: 'select', source: 'client' },
  // Contrato — source: 'contract' → específico del contrato, se pasa como override
  fecha_contrato:  { label: 'Fecha del contrato',  type: 'date',   source: 'contract' },
  lugar_contrato:  { label: 'Lugar del contrato',  type: 'text',   source: 'contract' },
  mes_ejecucion:   { label: 'Mes de ejecución',    type: 'text',   source: 'contract' },
  cantidad_reels:  { label: 'Cantidad de reels',   type: 'number', source: 'contract' },
  precio_numero:   { label: 'Precio',              type: 'number', source: 'contract' },
  precio_texto:    { label: 'Precio en texto',     type: 'text',   source: 'contract' },
}

function getVariableMeta(key) {
  return VARIABLE_META[key] ?? { label: key, type: 'text' }
}

function normalizeMissingKeys(missingKeys) {
  const keys = new Set()
  for (const key of missingKeys) {
    keys.add(SECONDARY_FIELDS[key] ?? key)
  }
  return [...keys]
}

function getPairFieldForPrimary(primaryKey) {
  for (const [secondary, primary] of Object.entries(SECONDARY_FIELDS)) {
    if (primary === primaryKey) return secondary
  }
  return undefined
}

function parseIntegerOverride(value) {
  const raw = String(value ?? '').replace(/\./g, '').trim()
  if (raw === '') return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

function formatThousands(n) {
  return n.toLocaleString('es-CL', { maximumFractionDigits: 0 })
}

function preprocessMissingFieldOverrides(overrides) {
  const out = { ...(overrides || {}) }

  if (out.cantidad_reels != null && String(out.cantidad_reels).trim() !== '') {
    const n = parseIntegerOverride(out.cantidad_reels)
    if (n != null) out.cantidad_reels = formatThousands(n)
  }

  let priceParsed = null
  if (out.precio_numero != null && String(out.precio_numero).trim() !== '') {
    priceParsed = parseIntegerOverride(out.precio_numero)
    if (priceParsed != null) out.precio_numero = formatThousands(priceParsed)
  }

  if (priceParsed != null) {
    out.precio_texto = numberToWords(priceParsed)
  }

  return out
}

function buildMissingFields(missingKeys, { clientRow, supplierRow } = {}) {
  const normalized = normalizeMissingKeys(missingKeys)
  return normalized.map((key) => {
    const meta = getVariableMeta(key)
    const pairField = getPairFieldForPrimary(key)
    const field = { key, label: meta.label, type: meta.type, source: meta.source ?? 'contract' }
    if (pairField) field.pairField = pairField

    if (key === 'client_product_campaign' && clientRow?.product_campaigns?.length > 0) {
      field.type = 'select'
      field.options = clientRow.product_campaigns.map((c) => c.name)
    }

    if (key === 'proveedor_red_social') {
      const networks = supplierRow?.social_networks ?? []
      if (networks.length > 0) {
        field.type = 'select'
        field.options = networks.map((sn) => ({
          label: `${String(sn.name || '').trim()} — ${String(sn.account_name || '').trim()}`,
          values: {
            proveedor_red_social: String(sn.name || '').trim(),
            proveedor_cuenta_social: String(sn.account_name || '').trim()
          }
        }))
      } else {
        field.type = 'text'
      }
    }

    return field
  })
}

function sanitizeFilePart(s) {
  return (
    String(s || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/gu, '')
      .replace(/[^\w.-]+/gu, '_')
      .replace(/_+/gu, '_')
      .replace(/^_|_$/gu, '')
      .slice(0, 80) || 'documento'
  )
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeTipTapDoc(contentJson) {
  if (!isPlainObject(contentJson)) return { type: 'doc', content: [] }
  if (contentJson.type === 'doc' && Array.isArray(contentJson.content)) return contentJson
  return { type: 'doc', content: [] }
}

function yearMonthInSantiago(date = new Date()) {
  const year = new Intl.DateTimeFormat('en', { timeZone: 'America/Santiago', year: 'numeric' }).format(
    date
  )
  const month = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Santiago',
    month: '2-digit'
  }).format(date)
  return { year, month }
}

function buildDraftGcsPath({ companyId, supplierId, templateCode, docId, fileName }) {
  const { year, month } = yearMonthInSantiago()
  const codePart = sanitizeFilePart(templateCode || 'template')
  return `contratos/${companyId}/${supplierId}/${codePart}/${year}/${month}/${docId}_${fileName}`
}

async function findActiveDuplicateDraft(trx, { companyId, supplierId, templateId, year, month }) {
  const yearNum = Number(year)
  const monthNum = Number(month)
  return trx('draft_document')
    .select('id', 'file_name', 'gcs_path', 'created_at', 'status')
    .where({
      supplier_id: supplierId,
      company_id: companyId,
      template_id: templateId
    })
    .whereNotIn('status', ['signed', 'rejected'])
    .whereRaw("EXTRACT(YEAR FROM created_at AT TIME ZONE 'America/Santiago') = ?", [yearNum])
    .whereRaw("EXTRACT(MONTH FROM created_at AT TIME ZONE 'America/Santiago') = ?", [monthNum])
    .orderBy('created_at', 'desc')
    .first()
}

function createDocumentBuilderService({
  db,
  supplierService = supplierServiceDefault,
  clientService = clientServiceDefault,
  gcsService,
  getUserProfileIdByUserId
}) {
  if (!gcsService) {
    throw new Error('gcsService is required')
  }
  if (!getUserProfileIdByUserId) {
    throw new Error('getUserProfileIdByUserId is required')
  }

  async function resolveCompany(userId, requestedCompanyId) {
    return resolveReadableCompanyId(userId, requestedCompanyId)
  }

  async function loadCompanyRow(trx, companyId) {
    const row = await trx('company').where({ id: companyId }).first()
    if (!row) return null
    return row
  }

  async function getTemplateRow(trx, templateId) {
    return trx('template as t')
      .join('template_standard as ts', 'ts.id', 't.id')
      .select('t.id', 't.code', 't.name', 't.description', 't.content_json')
      .where('t.id', templateId)
      .first()
  }

  function materializeTemplateMergedDoc(contentJson) {
    return normalizeTipTapDoc(contentJson)
  }

  async function materializeTemplatePlainText(contentJson) {
    const merged = materializeTemplateMergedDoc(contentJson)
    return tipTapDocToPlainTextAsync(merged)
  }

  async function listEligibleTemplates({ userId, requestedCompanyId, supplierType }) {
    const gate = await resolveCompany(userId, requestedCompanyId)
    if (!gate.ok) return gate

    let query = db('template as t')
      .join('template_standard as ts', 'ts.id', 't.id')
      .select('t.id', 't.name', 't.description', 't.status', 't.supplier_type')
      .where('t.status', 'active')
      .orderBy('t.name', 'asc')

    if (supplierType === 'persona_natural' || supplierType === 'empresa') {
      query = query.where('t.supplier_type', supplierType)
    }

    const standardRows = await query

    const items = standardRows.map((r) => ({
      kind: 'standard',
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      supplier_type: r.supplier_type,
    }))

    return { ok: true, data: { items } }
  }

  async function getTemplateDetail({ userId, requestedCompanyId, kind, templateId }) {
    const gate = await resolveCompany(userId, requestedCompanyId)
    if (!gate.ok) return gate

    if (kind !== 'standard') {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Solo se admiten plantillas estándar.'
      }
    }

    const row = await getTemplateRow(db, templateId)
    if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Plantilla no encontrada.' }

    const plain = await materializeTemplatePlainText(row.content_json)
    return {
      ok: true,
      data: {
        template: {
          kind: 'standard',
          id: row.id,
          name: row.name,
          description: row.description,
          plain_text_preview: plain
        }
      }
    }
  }

  async function generateAndPersist({ userId, requestedCompanyId, body }) {
    const gate = await resolveCompany(userId, requestedCompanyId)
    if (!gate.ok) return gate
    const { companyId } = gate

    const supplierId = body?.supplierId != null ? String(body.supplierId).trim() : ''
    const template = body?.template
    const overridesRaw =
      body?.missingFieldOverrides && typeof body.missingFieldOverrides === 'object'
        ? body.missingFieldOverrides
        : {}
    const overrides = preprocessMissingFieldOverrides(overridesRaw)

    if (!supplierId) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe seleccionar un proveedor.'
      }
    }
    if (!template || template.kind !== 'standard' || !template.id) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe indicar una plantilla estándar válida.'
      }
    }

    const createdBy = await getUserProfileIdByUserId(userId)
    if (!createdBy) {
      return {
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'Perfil de usuario no encontrado.'
      }
    }

    const supplierResult = await supplierService.getSupplierById(supplierId)
    if (!supplierResult.ok) {
      return {
        ok: false,
        status: supplierResult.status ?? 404,
        code: supplierResult.code ?? 'NOT_FOUND',
        message: supplierResult.message ?? 'Proveedor no encontrado.'
      }
    }
    const supplier = supplierResult.data?.supplier

    const clientIdRaw = body?.clientId != null ? String(body.clientId).trim() : ''
    let clientRow = null
    if (clientIdRaw) {
      const clientResult = await clientService.getClientById(clientIdRaw)
      if (!clientResult.ok) {
        return {
          ok: false,
          status: clientResult.status ?? 404,
          code: clientResult.code ?? 'NOT_FOUND',
          message: clientResult.message ?? 'Cliente no encontrado.'
        }
      }
      clientRow = clientResult.data?.client ?? null
    }

    const companyRow = await loadCompanyRow(db, companyId)
    if (!companyRow) {
      return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Empresa no encontrada.' }
    }

    const templateRow = await getTemplateRow(db, template.id)
    if (!templateRow) {
      return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Plantilla no encontrada.' }
    }

    const mergedDoc = materializeTemplateMergedDoc(templateRow.content_json)
    const baseText = await tipTapDocToPlainTextAsync(mergedDoc)
    const map = buildSubstitutionMap(supplier, companyRow, clientRow, overrides)
    const missing = unresolvedKeys(baseText, map)

    if (missing.length > 0) {
      return {
        ok: false,
        status: 422,
        code: 'MISSING_PLACEHOLDERS',
        message: 'Faltan variables requeridas en la plantilla.',
        data: { missingFields: buildMissingFields(missing, { clientRow, supplierRow: supplier }) }
      }
    }

    if (body?.dryRun === true) {
      return {
        ok: true,
        data: {
          valid: true,
          message: 'Todas las variables están resueltas.'
        }
      }
    }

    const { year, month } = yearMonthInSantiago()
    const duplicateScope = {
      companyId,
      supplierId,
      templateId: template.id,
      year,
      month
    }
    const existingDuplicate = await findActiveDuplicateDraft(db, duplicateScope)

    if (existingDuplicate) {
      if (body?.overwrite !== true) {
        return {
          ok: false,
          status: 409,
          code: 'DUPLICATE_DRAFT',
          message:
            'Ya existe un contrato generado para este proveedor con esta plantilla en el mismo mes.',
          data: {
            existing: {
              id: existingDuplicate.id,
              file_name: existingDuplicate.file_name,
              created_at: existingDuplicate.created_at,
              status: existingDuplicate.status
            }
          }
        }
      }

      const existingForOverwrite = await findActiveDuplicateDraft(db, duplicateScope)
      if (existingForOverwrite) {
        try {
          await gcsService.deleteFile({ gcsPath: existingForOverwrite.gcs_path })
        } catch {
          return {
            ok: false,
            status: 500,
            code: 'GCS_DELETE_FAILED',
            message: 'No se pudo reemplazar el documento anterior. Intente nuevamente.'
          }
        }

        await db.transaction(async (trx) => {
          const row = await findActiveDuplicateDraft(trx, duplicateScope)
          if (row) {
            await trx('draft_document').where({ id: row.id }).delete()
          }
        })
      }
    }

    const templateName = sanitizeFilePart(templateRow.name || 'plantilla')
    const resolvedDoc = applySubstitutionsToTipTapDoc(mergedDoc, map)

    const pdfBytes = await buildPdfBytesFromTipTapWithReactPdf(resolvedDoc)

    const rutPart =
      sanitizeFilePart(
        supplier.supplier_type === 'empresa' ? supplier.rut_empresa_display : supplier.rut_display
      ) || sanitizeFilePart(supplierId)
    const file_name = `${templateName}_${rutPart}.pdf`

    const docId = randomUUID()
    const gcs_path = buildDraftGcsPath({
      companyId,
      supplierId,
      templateCode: templateRow.code,
      docId,
      fileName: file_name
    })

    await gcsService.uploadBuffer({
      buffer: Buffer.from(pdfBytes),
      gcsPath: gcs_path,
      contentType: 'application/pdf'
    })

    const [ins] = await db('draft_document')
      .insert({
        id: docId,
        template_id: template.id,
        supplier_id: supplierId,
        company_id: companyId,
        client_id: clientRow?.id ?? null,
        gcs_path,
        file_name,
        status: 'draft',
        created_by: createdBy,
        contract_overrides: overrides
      })
      .returning(['id', 'file_name', 'gcs_path', 'status'])

    const row = ins && typeof ins === 'object' ? ins : { id: docId, file_name, gcs_path, status: 'draft' }

    return {
      ok: true,
      data: {
        documents: [
          {
            id: row.id,
            file_name: row.file_name,
            gcs_path: row.gcs_path,
            status: row.status
          }
        ]
      }
    }
  }

  async function getGeneratedDocumentForDownload({ userId, requestedCompanyId, documentId }) {
    const gate = await resolveCompany(userId, requestedCompanyId)
    if (!gate.ok) return gate
    const { companyId } = gate

    const row = await db('draft_document')
      .select('id', 'company_id', 'file_name', 'gcs_path')
      .where({ id: documentId })
      .first()

    if (!row || String(row.company_id) !== String(companyId)) {
      return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Documento no encontrado.' }
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
    listEligibleTemplates,
    getTemplateDetail,
    generateAndPersist,
    getGeneratedDocumentForDownload
  }
}

module.exports = {
  createDocumentBuilderService,
  buildDraftGcsPath,
  yearMonthInSantiago,
  findActiveDuplicateDraft,
  getVariableMeta,
  buildMissingFields,
  preprocessMissingFieldOverrides,
  SECONDARY_FIELDS
}
