/**
 * Wraps manuales para plantillas activas cuyo bloque de firma no calza
 * con el patrón canónico del script automático.
 *
 * Cada entrada es una función (doc) => { doc, applied: boolean }.
 * Se ejecuta antes del detector canónico en wrap-active-template-signature-blocks.js.
 */

const MANUAL_WRAPS_BY_CODE = {
  // Ejemplo (desactivado):
  // PL0999: (doc) => ({ doc, applied: false }),
}

function applyManualSignatureWraps(doc, templateCode) {
  const fn = MANUAL_WRAPS_BY_CODE[templateCode]
  if (typeof fn !== 'function') {
    return { doc, applied: false }
  }
  const out = fn(doc)
  if (!out || typeof out !== 'object' || !out.doc) {
    return { doc, applied: false }
  }
  return { doc: out.doc, applied: Boolean(out.applied) }
}

module.exports = {
  MANUAL_WRAPS_BY_CODE,
  applyManualSignatureWraps,
}
