const crypto = require('crypto')
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
const { db: defaultDb } = require('../db/knex')
const { gcsService: defaultGcsService } = require('./gcsService')
const emailServiceDefault = require('./emailService')
const { yearMonthInSantiago } = require('./documentBuilderService')
const { buildPdfBytesFromTipTapWithReactPdf } = require('./documentBuilderTipTapReactPdf')

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

function formatCompanyRut(company) {
  if (!company?.rut_body) return '—'
  const dv = company.rut_dv != null ? String(company.rut_dv).toUpperCase() : ''
  const body = String(company.rut_body).replace(/\D/g, '')
  if (!body) return '—'
  const parts = []
  let i = body.length
  while (i > 0) {
    const start = Math.max(0, i - 3)
    parts.unshift(body.slice(start, i))
    i = start
  }
  return `${parts.join('.')}-${dv}`
}

function formatTimestampSantiago(date = new Date()) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'long',
    timeStyle: 'medium'
  }).format(date)
}

function mapPendingRow(row) {
  const overrides =
    row?.contract_overrides && typeof row.contract_overrides === 'object'
      ? row.contract_overrides
      : {}

  return {
    id: row.id,
    supplier_name: row.supplier_name ?? null,
    supplier_type: row.supplier_type ?? null,
    client_name: row.client_name ?? null,
    template_name: row.template_name ?? null,
    company_name: row.company_name ?? null,
    company_short_name: row.company_short_name ?? null,
    company_email: row.company_email ?? null,
    fecha_contrato: overrides.fecha_contrato ?? null,
    created_at: row.created_at ?? null,
    file_name: row.file_name,
    gcs_path: row.gcs_path
  }
}

function buildSignedGcsPath({ companyId, supplierId, templateCode, docId }) {
  const { year, month } = yearMonthInSantiago()
  const codePart = sanitizeFilePart(templateCode || 'template')
  return `contratos-firmados/${companyId}/${supplierId}/${codePart}/${year}/${month}/${docId}_firmado.pdf`
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function collectCompanyRepIndexesFromSnapshot(snapshotDoc) {
  const out = new Set()

  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node.type === 'signatureBlock' && node.attrs?.party === 'company') {
      const n = node.attrs?.repIndex == null ? null : Number(node.attrs.repIndex)
      if (n === 1 || n === 2) out.add(n)
    }
    if (node.content) walk(node.content)
  }

  walk(snapshotDoc)
  return Array.from(out)
}

async function appendSignaturePage(
  originalBuffer,
  { signerName, company, signedAtFormatted, draftHash, signedHash, stampInjected = false, reRendered = false, hash }
) {
  const pdfDoc = await PDFDocument.load(originalBuffer)
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const margin = 50
  let y = height - 72
  const lineGap = 20

  const draftSha = draftHash ?? hash ?? '—'
  const signedSha = signedHash ?? draftSha

  const drawLine = (text, { bold = false, size = 11 } = {}) => {
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0)
    })
    y -= size + (size >= 14 ? 10 : lineGap - size)
  }

  drawLine('CONSTANCIA DE FIRMA ELECTRÓNICA SIMPLE', { bold: true, size: 16 })
  drawLine('Ley N° 19.799 sobre Firma Electrónica', { size: 10 })
  y -= 4
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75)
  })
  y -= lineGap

  const repShort = company.short_name ? ` (${company.short_name})` : ''
  drawLine(`Usuario plataforma: ${signerName}`)
  drawLine(`Empresa: ${company.business_name}${repShort}`)
  drawLine(`RUT Empresa: ${formatCompanyRut(company)}`)
  drawLine(`Fecha y hora: ${signedAtFormatted}`)
  drawLine(`Hash SHA-256 del borrador revisado: ${draftSha}`, { size: 9 })
  drawLine(`Hash SHA-256 del cuerpo del contrato (sin esta constancia): ${signedSha}`, {
    size: 8
  })

  if (stampInjected) {
    drawLine('La rúbrica reproducida es una imagen registrada por la empresa.')
  } else if (reRendered) {
    drawLine('No se pudo estampar una rúbrica registrada de la empresa.')
  } else {
    drawLine('No se pudo estampar una rúbrica registrada de la empresa.')
    drawLine('El cuerpo del documento no fue re-renderizado.')
  }

  return Buffer.from(await pdfDoc.save())
}

function createContractSigningService({
  db = defaultDb,
  gcsService = defaultGcsService,
  emailService = emailServiceDefault
} = {}) {
  async function listPendingSignature() {
    const rows = await db('draft_document as dd')
      .join('supplier as s', 's.id', 'dd.supplier_id')
      .leftJoin('supplier_persona_natural as spn', 'spn.supplier_id', 's.id')
      .leftJoin('supplier_empresa as se', 'se.supplier_id', 's.id')
      .leftJoin('client as c', 'c.id', 'dd.client_id')
      .leftJoin('template as t', 't.id', 'dd.template_id')
      .join('company as co', 'co.id', 'dd.company_id')
      .whereNotIn('dd.status', ['signed', 'rejected'])
      .select(
        'dd.id',
        'dd.file_name',
        'dd.gcs_path',
        'dd.created_at',
        'dd.contract_overrides',
        db.raw('COALESCE(se.razon_social, spn.full_name) as supplier_name'),
        's.supplier_type',
        'c.name as client_name',
        't.name as template_name',
        'co.business_name as company_name',
        'co.short_name as company_short_name',
        'co.email as company_email'
      )
      .orderBy('dd.created_at', 'desc')

    return {
      ok: true,
      data: { items: rows.map(mapPendingRow) }
    }
  }

  async function signContract({ draftDocumentId, signerUserProfileId }) {
    const draft = await db('draft_document').where({ id: draftDocumentId }).first()
    if (!draft) {
      return {
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'Borrador de contrato no encontrado.'
      }
    }

    if (draft.status === 'signed' || draft.status === 'rejected') {
      return {
        ok: false,
        status: 409,
        code: 'INVALID_STATUS',
        message: 'Este contrato no está pendiente de firma.'
      }
    }

    const signer = await db('user_profile').where({ id: signerUserProfileId }).first()
    if (!signer) {
      return {
        ok: false,
        status: 404,
        code: 'SIGNER_NOT_FOUND',
        message: 'No se encontró el perfil del firmante.'
      }
    }

    const company = await db('company').where({ id: draft.company_id }).first()
    if (!company) {
      return {
        ok: false,
        status: 404,
        code: 'COMPANY_NOT_FOUND',
        message: 'Empresa asociada al contrato no encontrada.'
      }
    }

    const template = await db('template').where({ id: draft.template_id }).first()
    if (!template) {
      return {
        ok: false,
        status: 404,
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Plantilla asociada al contrato no encontrada.'
      }
    }

    const supplierRow = await db('supplier as s')
      .leftJoin('supplier_persona_natural as spn', 'spn.supplier_id', 's.id')
      .leftJoin('supplier_empresa as se', 'se.supplier_id', 's.id')
      .where('s.id', draft.supplier_id)
      .select(db.raw('COALESCE(se.razon_social, spn.full_name) as supplier_name'))
      .first()

    const proveedorNombre = supplierRow?.supplier_name || 'Proveedor'

    let originalBuffer
    try {
      originalBuffer = await gcsService.downloadBuffer({ gcsPath: draft.gcs_path })
    } catch (err) {
      console.error('[contractSigningService] GCS download failed:', err)
      return {
        ok: false,
        status: 500,
        code: 'GCS_DOWNLOAD_FAILED',
        message: 'No se pudo descargar el PDF del contrato.'
      }
    }

    const draft_sha256 = sha256Hex(originalBuffer)
    const signedAt = new Date()
    const signedAtFormatted = formatTimestampSantiago(signedAt)

    let bodyBuffer = originalBuffer
    let signed_sha256 = draft_sha256
    let stampInjected = false
    let reRendered = false

    // Si el borrador tiene snapshot materializado, intentamos re-renderizar para inyectar
    // la rúbrica de la empresa (solo para el bloque de firma de representante, mitad 1).
    if (draft.content_snapshot) {
      try {
        const repIndexes = collectCompanyRepIndexesFromSnapshot(draft.content_snapshot)
        const signatureRows = repIndexes.length
          ? await db('legal_rep_signature')
              .select('rep_index', 'gcs_path')
              .where({ company_id: draft.company_id })
          : []

        const signatureImages = {}
        for (const row of signatureRows) {
          if (!repIndexes.includes(row.rep_index)) continue
          const key = row.rep_index === 1 ? 'company:1' : row.rep_index === 2 ? 'company:2' : null
          if (!key) continue

          try {
            const buf = await gcsService.downloadBuffer({ gcsPath: row.gcs_path })
            if (buf) {
              signatureImages[key] = buf
              stampInjected = true
            }
          } catch (err) {
            console.error('[contractSigningService] Signature image download failed:', err)
          }
        }

        bodyBuffer = await buildPdfBytesFromTipTapWithReactPdf(draft.content_snapshot, { signatureImages })
        signed_sha256 = sha256Hex(bodyBuffer)
        reRendered = true
      } catch (err) {
        console.error('[contractSigningService] Re-render failed, falling back to legacy body:', err)
        bodyBuffer = originalBuffer
        signed_sha256 = draft_sha256
        stampInjected = false
        reRendered = false
      }
    }

    let signedBuffer
    try {
      signedBuffer = await appendSignaturePage(bodyBuffer, {
        signerName: signer.full_name || 'Firmante',
        company,
        signedAtFormatted,
        draftHash: draft_sha256,
        signedHash: signed_sha256,
        stampInjected,
        reRendered
      })
    } catch (err) {
      console.error('[contractSigningService] PDF signing failed:', err)
      return {
        ok: false,
        status: 500,
        code: 'PDF_SIGN_FAILED',
        message: 'No se pudo generar la constancia de firma del documento.'
      }
    }

    const documentId = crypto.randomUUID()
    const newGcsPath = buildSignedGcsPath({
      companyId: draft.company_id,
      supplierId: draft.supplier_id,
      templateCode: template.code,
      docId: documentId
    })
    const newFileName = `${documentId}_firmado.pdf`

    try {
      await gcsService.uploadBuffer({
        buffer: signedBuffer,
        gcsPath: newGcsPath,
        contentType: 'application/pdf'
      })
    } catch (err) {
      console.error('[contractSigningService] GCS upload failed:', err)
      return {
        ok: false,
        status: 500,
        code: 'GCS_UPLOAD_FAILED',
        message: 'No se pudo guardar el PDF firmado.'
      }
    }

    const contractOverrides =
      draft.contract_overrides && typeof draft.contract_overrides === 'object'
        ? draft.contract_overrides
        : null

    try {
      await db.transaction(async (trx) => {
        await trx('document').insert({
          id: documentId,
          draft_document_id: draftDocumentId,
          supplier_id: draft.supplier_id,
          company_id: draft.company_id,
          template_id: draft.template_id,
          client_id: draft.client_id ?? null,
          contract_overrides: contractOverrides,
          gcs_path: newGcsPath,
          file_name: newFileName,
          source: 'generated',
          signed_at: signedAt,
          signed_by: signer.full_name || 'Firmante',
          uploaded_by: signerUserProfileId,
          draft_sha256,
          signed_sha256
        })

        await trx('draft_document').where({ id: draftDocumentId }).update({ status: 'signed' })
      })
    } catch (err) {
      console.error('[contractSigningService] DB transaction failed:', err)
      return {
        ok: false,
        status: 500,
        code: 'PERSIST_FAILED',
        message: 'No se pudo registrar el contrato firmado.'
      }
    }

    if (company.email) {
      try {
        await emailService.sendSignedContractEmail({
          to: company.email,
          proveedorNombre,
          templateName: template.name,
          pdfBuffer: signedBuffer,
          fileName: newFileName
        })
      } catch (err) {
        console.error('[contractSigningService] Email send failed:', err)
      }
    }

    return {
      ok: true,
      data: {
        documentId,
        fileName: newFileName,
        companyEmail: company.email ?? null
      }
    }
  }

  return { listPendingSignature, signContract }
}

const defaultService = createContractSigningService()

module.exports = {
  createContractSigningService,
  contractSigningService: defaultService,
  formatCompanyRut,
  formatTimestampSantiago,
  buildSignedGcsPath,
  appendSignaturePage
}
