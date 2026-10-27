const { rgb, StandardFonts } = require('pdf-lib')

const STAMP_X = 0.335
const STAMP_Y = 0.8
const STAMP_WIDTH = 0.33
const STAMP_HEIGHT = 0.12
const FIRME_PAGE_BASE = 1
const STAMP_LABEL = 'Firma electrónica del proveedor'

function stampPositionFor(pageCount) {
  return {
    page: pageCount - 1 + FIRME_PAGE_BASE,
    x: STAMP_X,
    y: STAMP_Y
  }
}

async function drawStampBox(pdfDoc) {
  const pages = pdfDoc.getPages()
  const page = pages[pages.length - 1]
  const { width, height } = page.getSize()
  const x = STAMP_X * width
  const y = height - STAMP_Y * height - STAMP_HEIGHT * height
  const boxWidth = STAMP_WIDTH * width
  const boxHeight = STAMP_HEIGHT * height
  page.drawRectangle({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    borderColor: rgb(0.45, 0.45, 0.45),
    borderWidth: 0.75
  })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  page.drawText(STAMP_LABEL, {
    x: x + 6,
    y: y + boxHeight / 2 - 4,
    size: 8,
    font,
    color: rgb(0.35, 0.35, 0.35)
  })
  return pdfDoc
}

module.exports = {
  STAMP_X,
  STAMP_Y,
  STAMP_WIDTH,
  STAMP_HEIGHT,
  FIRME_PAGE_BASE,
  STAMP_LABEL,
  stampPositionFor,
  drawStampBox
}
