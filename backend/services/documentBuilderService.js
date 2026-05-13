const { resolveReadableCompanyId } = require('../lib/resolveReadableCompanyId')
const { tipTapDocToPlainTextAsync } = require('../utils/tipTapPlainText')
const { materializeTipTapDocAsync } = require('../utils/tipTapMaterialize')
const {
  buildSubstitutionMap,
  applySubstitutionsToTipTapDoc,
  unresolvedKeys,
  placeholderKeysInText
} = require('./documentBuilderVariableContext')
const { buildPdfBytesFromTipTapDoc } = require('./documentBuilderTipTapPdf')
const { buildPdfBytesFromTipTapWithReactPdf } = require('./documentBuilderTipTapReactPdf')
const { parseDocumentBuilderRenderEngine } = require('../lib/parseDocumentBuilderRenderEngine')

/** Max trabajadores por solicitud (POC). */
const DOCUMENT_BUILDER_MAX_EMPLOYEES_PER_BATCH = 50

function sanitizeFilePart(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^\w.-]+/gu, '_')
    .replace(/_+/gu, '_')
    .replace(/^_|_$/gu, '')
    .slice(0, 80) || 'documento'
}

async function loadClauseContentJson(trx, clauseId, clauseKind, companyId) {
  if (clauseKind === 'universal') {
    const row = await trx('clause as c')
      .join('clause_universal as cu', 'cu.id', 'c.id')
      .select('c.content_json')
      .where('c.id', clauseId)
      .first()
    return row?.content_json ?? null
  }
  const row = await trx('clause as c')
    .join('clause_company as cc', 'cc.id', 'c.id')
    .select('c.content_json')
    .where('c.id', clauseId)
    .where('cc.company_id', companyId)
    .first()
  return row?.content_json ?? null
}

function createDocumentBuilderService({ db }) {
  async function resolveCompany(userId, requestedCompanyId) {
    return resolveReadableCompanyId(userId, requestedCompanyId)
  }

  async function loadCompanyRow(trx, companyId) {
    const row = await trx('company').where({ id: companyId }).first()
    if (!row) return null
    let branches_text = ''
    if (await trx.schema.hasTable('company_branch')) {
      const branches = await trx('company_branch')
        .select('name', 'city')
        .where({ company_id: companyId })
        .orderBy('name', 'asc')
        .limit(30)
      branches_text = branches.map((b) => [b.name, b.city].filter(Boolean).join(' — ')).join('; ')
    }
    return { ...row, branches_text }
  }

  async function getTemplateRow(trx, kind, templateId, companyId) {
    if (kind === 'standard') {
      return trx('template as t')
        .join('template_standard as ts', 'ts.id', 't.id')
        .select('t.id', 't.name', 't.description', 't.content_json')
        .where('t.id', templateId)
        .first()
    }
    if (kind === 'company') {
      return trx('template as t')
        .join('template_company as tc', 'tc.id', 't.id')
        .select('t.id', 't.name', 't.description', 't.content_json')
        .where('t.id', templateId)
        .where('tc.company_id', companyId)
        .first()
    }
    return null
  }

  async function materializeTemplateMergedDoc(trx, contentJson, companyId) {
    return materializeTipTapDocAsync(
      contentJson,
      (ref) =>
        loadClauseContentJson(
          trx,
          ref.clauseId,
          ref.clauseKind,
          ref.clauseKind === 'company' ? ref.companyId ?? companyId : companyId
        ),
      companyId
    )
  }

  async function materializeTemplatePlainText(trx, contentJson, companyId) {
    const merged = await materializeTemplateMergedDoc(trx, contentJson, companyId)
    return tipTapDocToPlainTextAsync(merged, async () => '', companyId)
  }

  async function listEligibleTemplates({ userId, requestedCompanyId }) {
    const gate = await resolveCompany(userId, requestedCompanyId)
    if (!gate.ok) return gate
    const { companyId } = gate

    const standardRows = await db('template as t')
      .join('template_standard as ts', 'ts.id', 't.id')
      .select('t.id', 't.name', 't.description', 't.status')
      .orderBy('t.name', 'asc')

    const companyRows = await db('template as t')
      .join('template_company as tc', 'tc.id', 't.id')
      .select('t.id', 't.name', 't.description', 't.status')
      .where('tc.company_id', companyId)
      .orderBy('t.name', 'asc')

    const items = [
      ...standardRows.map((r) => ({
        kind: 'standard',
        id: r.id,
        name: r.name,
        description: r.description,
        status: r.status
      })),
      ...companyRows.map((r) => ({
        kind: 'company',
        id: r.id,
        name: r.name,
        description: r.description,
        status: r.status
      }))
    ]

    return { ok: true, data: { items } }
  }

  async function getTemplateDetail({ userId, requestedCompanyId, kind, templateId }) {
    const gate = await resolveCompany(userId, requestedCompanyId)
    if (!gate.ok) return gate
    const { companyId } = gate

    const row = await getTemplateRow(db, kind, templateId, companyId)
    if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Plantilla no encontrada.' }

    const plain = await materializeTemplatePlainText(db, row.content_json, companyId)
    return {
      ok: true,
      data: {
        template: {
          kind,
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

    const employeeIdsRaw = Array.isArray(body?.employeeIds) ? body.employeeIds : []
    const employeeIds = [...new Set(employeeIdsRaw.map((x) => String(x)))].filter(Boolean)
    const template = body?.template
    const overrides =
      body?.missingFieldOverrides && typeof body.missingFieldOverrides === 'object'
        ? body.missingFieldOverrides
        : {}

    if (employeeIds.length === 0) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe seleccionar al menos un trabajador.'
      }
    }
    if (employeeIds.length > DOCUMENT_BUILDER_MAX_EMPLOYEES_PER_BATCH) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: `No puede generar más de ${DOCUMENT_BUILDER_MAX_EMPLOYEES_PER_BATCH} documentos por lote.`
      }
    }
    if (!template || (template.kind !== 'standard' && template.kind !== 'company') || !template.id) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe indicar una plantilla válida (estándar o por empresa).'
      }
    }

    const engine = parseDocumentBuilderRenderEngine(body)
    if (!engine.ok) {
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        message: engine.message
      }
    }

    const companyRow = await loadCompanyRow(db, companyId)
    if (!companyRow) {
      return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Empresa no encontrada.' }
    }

    return db.transaction(async (trx) => {
      const templateRow = await getTemplateRow(trx, template.kind, template.id, companyId)
      if (!templateRow) {
        return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Plantilla no encontrada.' }
      }

      const mergedDoc = await materializeTemplateMergedDoc(trx, templateRow.content_json, companyId)
      const baseText = await tipTapDocToPlainTextAsync(mergedDoc, async () => '', companyId)
      const keysInTemplate = placeholderKeysInText(baseText)

      const employees = await trx('employee as e')
        .leftJoin('position as p', 'p.id', 'e.position_id')
        .leftJoin('work_schedule as w', 'w.id', 'e.work_schedule_id')
        .where('e.company_id', companyId)
        .whereIn('e.id', employeeIds)
        .select(
          'e.*',
          'p.name as position_name',
          'p.description as position_description',
          'w.name as work_schedule_name'
        )

      if (employees.length !== employeeIds.length) {
        return {
          ok: false,
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Uno o más trabajadores no existen en la empresa seleccionada.'
        }
      }

      const missingUnion = new Set()
      for (const emp of employees) {
        const empMap = {
          ...emp,
          rut: emp.rut_body ? `${emp.rut_body}-${emp.rut_dv ?? ''}` : '',
          position_name: emp.position_name,
          work_schedule_name: emp.work_schedule_name
        }
        const map = buildSubstitutionMap(empMap, companyRow, overrides)
        const missing = unresolvedKeys(baseText, map)
        for (const m of missing) missingUnion.add(m)
      }

      if (missingUnion.size > 0) {
        return {
          ok: false,
          status: 422,
          code: 'MISSING_PLACEHOLDERS',
          message: 'Faltan datos para completar variables del documento.',
          data: { missingFieldKeys: [...missingUnion], knownKeysSample: keysInTemplate.slice(0, 20) }
        }
      }

      const templateName = sanitizeFilePart(templateRow.name || 'plantilla')
      const documentsOut = []

      for (const emp of employees) {
        const empMap = {
          ...emp,
          rut: emp.rut_body ? `${emp.rut_body}-${emp.rut_dv ?? ''}` : '',
          position_name: emp.position_name,
          work_schedule_name: emp.work_schedule_name
        }
        const map = buildSubstitutionMap(empMap, companyRow, overrides)
        const resolvedDoc = applySubstitutionsToTipTapDoc(mergedDoc, map)

        const pdfBytes =
          engine.input === 'react-pdf'
            ? await buildPdfBytesFromTipTapWithReactPdf(resolvedDoc)
            : await buildPdfBytesFromTipTapDoc(resolvedDoc)
        const rutPart = sanitizeFilePart(empMap.rut || emp.id)
        const file_name = `${templateName}_${rutPart}.pdf`

        const insertPayload = {
          employee_id: emp.id,
          company_id: companyId,
          file_name,
          file_data: Buffer.from(pdfBytes),
          standard_template_id: template.kind === 'standard' ? template.id : null,
          company_template_id: template.kind === 'company' ? template.id : null,
          pdf_render_engine: engine.storage
        }

        const [ins] = await trx('generated_document').insert(insertPayload).returning(['id', 'file_name', 'employee_id', 'pdf_render_engine'])
        const row = ins && typeof ins === 'object' ? ins : { id: ins, file_name, employee_id: emp.id, pdf_render_engine: engine.storage }
        documentsOut.push({
          id: row.id,
          file_name: row.file_name,
          employee_id: row.employee_id,
          pdfRenderEngine: row.pdf_render_engine ?? engine.storage
        })
      }

      return { ok: true, data: { documents: documentsOut } }
    })
  }

  async function getGeneratedDocumentForDownload({ userId, requestedCompanyId, documentId }) {
    const gate = await resolveCompany(userId, requestedCompanyId)
    if (!gate.ok) return gate
    const { companyId } = gate

    const row = await db('generated_document')
      .select('id', 'company_id', 'file_name', 'file_data')
      .where({ id: documentId })
      .first()

    if (!row || String(row.company_id) !== String(companyId)) {
      return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Documento no encontrado.' }
    }

    return {
      ok: true,
      data: {
        file_name: row.file_name,
        buffer: row.file_data
      }
    }
  }

  return {
    listEligibleTemplates,
    getTemplateDetail,
    generateAndPersist,
    getGeneratedDocumentForDownload,
    DOCUMENT_BUILDER_MAX_EMPLOYEES_PER_BATCH
  }
}

module.exports = {
  createDocumentBuilderService,
  DOCUMENT_BUILDER_MAX_EMPLOYEES_PER_BATCH,
}
