/**
 * Standard 14 fonts encode text as WinAnsi; TAB (U+0009) and most C0 controls are not encodable.
 * Custom fonts tolerate more glyphs; we still normalize whitespace and strip controls.
 * @param {string} s
 * @returns {string}
 */
function sanitizeTextForWinAnsi(s) {
  return String(s ?? '')
    .replace(/\t/g, ' ')
    .replace(/\v|\f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
}

/**
 * TipTap / paste often inserts TAB, NBSP, or ZWSP *inside* a word. Remove joiners only between
 * letters/digits/marks; leave e.g. "Sr.\u00a0Juan" (punctuation before NBSP) intact.
 * @param {string} s
 * @returns {string}
 */
function normalizeTextForPdfTokenization(s) {
  let t = String(s ?? '')
  t = t.replace(/\u00ad/gu, '')
  t = t.replace(/\u200b|\u200c|\u200d/gu, '')
  t = t.replace(/(?<=\p{L}\p{M}*)[\t\u00a0\u1680\u2000-\u200a](?=\p{L}\p{M}*)/gu, '')
  t = t.replace(/\t|\v|\f/gu, ' ')
  return t
}

module.exports = {
  sanitizeTextForWinAnsi,
  normalizeTextForPdfTokenization
}
