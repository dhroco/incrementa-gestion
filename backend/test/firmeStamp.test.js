const test = require('node:test')
const assert = require('node:assert/strict')
const { PDFDocument } = require('pdf-lib')

const { createFirmeStampService } = require('../services/firmeStampService')
const {
  STAMP_X,
  STAMP_Y,
  STAMP_WIDTH,
  STAMP_HEIGHT,
  FIRME_PAGE_BASE,
  stampPositionFor,
  drawStampBox
} = require('../lib/firmeStamp')

test('stamp position follows the page base and stays inside the margins', () => {
  const position = stampPositionFor(3)
  assert.equal(position.page, 3 - 1 + FIRME_PAGE_BASE)
  assert.equal(position.x, STAMP_X)
  assert.equal(position.y, STAMP_Y)
  assert.ok(STAMP_X >= 0.05)
  assert.ok(STAMP_Y >= 0.05)
  assert.ok(STAMP_Y >= 0.5)
  assert.ok(STAMP_X + STAMP_WIDTH <= 0.95)
  assert.ok(STAMP_Y + STAMP_HEIGHT <= 0.95)
})

test('drawStampBox paints the rectangle on the last page', async () => {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.addPage([300, 400])
  pdfDoc.addPage([300, 400])
  await drawStampBox(pdfDoc)

  const first = pdfDoc.getPage(0).getContentStream().operators || []
  const last = pdfDoc.getPage(1).getContentStream()
  const drawn = (last.operators || []).map((operator) => String(operator)).join('\n')
  assert.equal(first.length, 0)
  const width = 300
  const height = 400
  const x = STAMP_X * width
  const y = height - STAMP_Y * height - STAMP_HEIGHT * height
  const boxWidth = STAMP_WIDTH * width
  const boxHeight = STAMP_HEIGHT * height
  const top = y + boxHeight
  assert.match(drawn, new RegExp(`1 0 0 1 ${x} ${y} cm`))
  assert.ok(top < height / 2, 'el borde superior del recuadro queda en la mitad inferior')
  assert.match(drawn, new RegExp(`0 ${boxHeight} l`))
  assert.match(drawn, new RegExp(`${boxWidth} ${boxHeight} l`))
  assert.match(drawn, /4669726D6120656C65637472F36E6963612064656C2070726F766565646F72/)
})

test('missing rubric does not produce a PDF', async () => {
  const db = () => ({
    where: async () => []
  })
  let downloaded = false
  const storageService = {
    async downloadBuffer() {
      downloaded = true
      return Buffer.from('original')
    }
  }
  const service = createFirmeStampService({ db, storageService })
  await assert.rejects(
    () =>
      service.buildStampedPdf({
        draft: {
          company_id: 'c1',
          gcs_path: 'contratos/a.pdf',
          content_snapshot: {
            type: 'doc',
            content: [{ type: 'signatureBlock', attrs: { party: 'company', repIndex: 1 } }]
          }
        },
        company: { business_name: 'Empresa' },
        signer: { full_name: 'Ana' },
        template: { code: 'T' }
      }),
    (err) => {
      assert.equal(err.code, 'RUBRICA_NO_DISPONIBLE')
      assert.equal(err.message, 'La empresa no tiene registrada la rúbrica del representante; no se puede enviar a firma.')
      return true
    }
  )
  assert.equal(downloaded, false)
})
