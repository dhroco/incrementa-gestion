const crypto = require('crypto')
const { PNG } = require('pngjs')
const { db: defaultDb } = require('../db/knex')
const { gcsService: defaultGcsService } = require('./gcsService')

const MAX_SIGNATURE_BYTES = 500 * 1024
const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function parseRepIndex(repIndex) {
  const n = typeof repIndex === 'string' ? Number(repIndex) : repIndex
  if (n === 1 || n === 2) return n
  return null
}

function validateSignaturePngBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) return { ok: false }
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

  if (b.length > MAX_SIGNATURE_BYTES) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'La imagen no puede superar 500 KB.'
    }
  }

  if (b.length < PNG_MAGIC_BYTES.length || !b.subarray(0, PNG_MAGIC_BYTES.length).equals(PNG_MAGIC_BYTES)) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'El archivo debe ser un PNG.'
    }
  }

  let png
  try {
    png = PNG.sync.read(b)
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'El PNG enviado no es válido.'
    }
  }

  const hasAlpha =
    png.colorType === 4 || // grayscale + alpha
    png.colorType === 6 || // rgba
    png.transparency != null

  // "Fondo transparente" se valida por umbral, no por exactitud: una rúbrica escaneada y
  // recortada suele quedar con alfa muy bajo pero distinto de 0 (antialiasing, compresión).
  // Exigir alfa === 0 rechazaba imágenes legítimas; exigir solo el canal alfa aceptaba un
  // PNG RGBA totalmente opaco, que taparía la línea de firma. Se exige que una fracción
  // significativa de los píxeles sea casi transparente.
  const ALPHA_TRANSPARENT_MAX = 32
  const MIN_TRANSPARENT_RATIO = 0.1

  let transparentPixels = 0
  let totalPixels = 0
  if (png.colorType === 6) {
    totalPixels = png.data.length / 4
    for (let i = 3; i < png.data.length; i += 4) {
      if (png.data[i] <= ALPHA_TRANSPARENT_MAX) transparentPixels += 1
    }
  } else if (png.colorType === 4) {
    totalPixels = png.data.length / 2
    for (let i = 1; i < png.data.length; i += 2) {
      if (png.data[i] <= ALPHA_TRANSPARENT_MAX) transparentPixels += 1
    }
  }

  // Con tRNS la transparencia está declarada en el chunk; se acepta por definición.
  const hasTransparentBackground =
    png.transparency != null ||
    (totalPixels > 0 && transparentPixels / totalPixels >= MIN_TRANSPARENT_RATIO)

  if (!hasAlpha || !hasTransparentBackground) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'El PNG debe tener fondo transparente.'
    }
  }

  return { ok: true }
}

function buildSignatureGcsPath({ companyId, repIndex, uuid }) {
  return `firmas-representantes/${companyId}/${repIndex}/${uuid}.png`
}

function createLegalRepSignatureService({ db = defaultDb, gcsService = defaultGcsService } = {}) {
  async function uploadSignature({ companyId, repIndex, userProfileId, signatureBuffer }) {
    const parsed = parseRepIndex(repIndex)
    if (!parsed) {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'repIndex inválido. Use 1 o 2.' }
    }

    const v = validateSignaturePngBuffer(signatureBuffer)
    if (!v.ok) return v

    const company = await db('company').where({ id: companyId }).first()
    if (!company) {
      return { ok: false, status: 404, code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada.' }
    }

    const existing = await db('legal_rep_signature')
      .select('gcs_path')
      .where({ company_id: companyId, rep_index: parsed })
      .first()

    const uuid = crypto.randomUUID()
    const gcs_path = buildSignatureGcsPath({ companyId, repIndex: parsed, uuid })

    await gcsService.uploadBuffer({
      buffer: Buffer.from(signatureBuffer),
      gcsPath: gcs_path,
      contentType: 'image/png'
    })

    if (existing?.gcs_path) {
      await db('legal_rep_signature')
        .where({ company_id: companyId, rep_index: parsed })
        .update({ gcs_path, uploaded_by: userProfileId })
    } else {
      await db('legal_rep_signature').insert({
        company_id: companyId,
        rep_index: parsed,
        gcs_path,
        uploaded_by: userProfileId
      })
    }

    if (existing?.gcs_path && existing.gcs_path !== gcs_path) {
      try {
        await gcsService.deleteFile({ gcsPath: existing.gcs_path })
      } catch {
        // best-effort cleanup
      }
    }

    const url = await gcsService.getSignedUrl({ gcsPath: gcs_path, expiresInMinutes: 60 })
    return { ok: true, data: { rep_index: parsed, url } }
  }

  async function deleteSignature({ companyId, repIndex }) {
    const parsed = parseRepIndex(repIndex)
    if (!parsed) {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'repIndex inválido. Use 1 o 2.' }
    }

    const row = await db('legal_rep_signature')
      .select('gcs_path')
      .where({ company_id: companyId, rep_index: parsed })
      .first()

    if (!row) {
      return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Firma no encontrada.' }
    }

    try {
      await gcsService.deleteFile({ gcsPath: row.gcs_path })
    } catch {
      // ignore
    }

    await db('legal_rep_signature')
      .where({ company_id: companyId, rep_index: parsed })
      .delete()

    return { ok: true, data: {} }
  }

  return {
    uploadSignature,
    deleteSignature
  }
}

module.exports = { createLegalRepSignatureService }

