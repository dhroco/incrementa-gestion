/**
 * Minimal PDF generation for document-builder POC (plain text, A4, Helvetica).
 * Naive word-wrap (~85 chars per line) sufficient for POC readability.
 * @param {string} text
 * @returns {Promise<Uint8Array>}
 */
async function buildPdfBytesFromPlainText(text) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontSize = 11
  const lineHeight = fontSize * 1.3
  const margin = 48
  const pageWidth = 595.28
  const pageHeight = 841.89
  const maxCharsPerLine = 85

  const raw = String(text || '').replace(/\r\n/g, '\n')

  function wrapParagraph(para) {
    const words = String(para).split(/\s+/u).filter(Boolean)
    const lines = []
    let cur = ''
    for (const w of words) {
      const trial = cur.length ? `${cur} ${w}` : w
      if (trial.length > maxCharsPerLine) {
        if (cur.length) lines.push(cur)
        cur = w.length > maxCharsPerLine ? w.slice(0, maxCharsPerLine) : w
        while (cur.length > maxCharsPerLine) {
          lines.push(cur.slice(0, maxCharsPerLine))
          cur = cur.slice(maxCharsPerLine)
        }
      } else {
        cur = trial
      }
    }
    if (cur.length) lines.push(cur)
    return lines
  }

  const allLines = []
  for (const block of raw.split(/\n/u)) {
    if (block === '') {
      allLines.push('')
      continue
    }
    allLines.push(...wrapParagraph(block))
  }

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }

  for (const line of allLines) {
    if (y < margin + lineHeight) newPage()
    page.drawText(line || ' ', {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    })
    y -= lineHeight
  }

  return pdfDoc.save()
}

module.exports = { buildPdfBytesFromPlainText }
