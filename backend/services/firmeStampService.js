const { PDFDocument } = require('pdf-lib')
const { drawStampBox, stampPositionFor } = require('../lib/firmeStamp')
const {
  appendSignaturePage,
  collectCompanyRepIndexesFromSnapshot,
  formatTimestampSantiago,
  sha256Hex
} = require('./contractSigningService')
const { buildPdfBytesFromTipTapWithReactPdf } = require('./documentBuilderTipTapReactPdf')

const RUBRICA_MESSAGE =
  'La empresa no tiene registrada la rúbrica del representante; no se puede enviar a firma.'

function rubricaError() {
  const err = new Error(RUBRICA_MESSAGE)
  err.code = 'RUBRICA_NO_DISPONIBLE'
  err.status = 422
  return err
}

function createFirmeStampService({ db, storageService, now = () => new Date() } = {}) {
  async function buildStampedPdf({ draft, company, signer, template }) {
    void template
    if (!draft?.content_snapshot) throw rubricaError()

    const repIndexes = collectCompanyRepIndexesFromSnapshot(draft.content_snapshot)
    const signatureRows = repIndexes.length
      ? await db('legal_rep_signature').where({ company_id: draft.company_id })
      : []
    const byIndex = new Map((signatureRows || []).map((row) => [row.rep_index, row]))
    const signatureImages = {}

    for (const repIndex of repIndexes) {
      const row = byIndex.get(repIndex)
      if (!row?.gcs_path) throw rubricaError()
      let image
      try {
        image = await storageService.downloadBuffer({ gcsPath: row.gcs_path })
      } catch {
        throw rubricaError()
      }
      if (!image || !image.length) throw rubricaError()
      const key = repIndex === 1 ? 'company:1' : repIndex === 2 ? 'company:2' : null
      if (!key) throw rubricaError()
      signatureImages[key] = image
    }

    const originalBuffer = await storageService.downloadBuffer({ gcsPath: draft.gcs_path })
    const draftSha = sha256Hex(originalBuffer)

    let bodyBuffer
    try {
      bodyBuffer = await buildPdfBytesFromTipTapWithReactPdf(draft.content_snapshot, { signatureImages })
    } catch {
      throw rubricaError()
    }

    const bodySha = sha256Hex(bodyBuffer)
    const signedAt = now()
    let withConstancia
    try {
      withConstancia = await appendSignaturePage(bodyBuffer, {
        signerName: signer?.full_name || 'Firmante',
        company,
        signedAtFormatted: formatTimestampSantiago(signedAt),
        draftHash: draftSha,
        signedHash: bodySha,
        stampInjected: repIndexes.length > 0,
        reRendered: true
      })
    } catch {
      throw rubricaError()
    }

    const pdfDoc = await PDFDocument.load(withConstancia)
    await drawStampBox(pdfDoc)
    const buffer = Buffer.from(await pdfDoc.save())
    return {
      buffer,
      sha256: sha256Hex(buffer),
      byteLength: buffer.length,
      stamp: stampPositionFor(pdfDoc.getPageCount()),
      draftSha
    }
  }

  return { buildStampedPdf }
}

module.exports = { createFirmeStampService }
