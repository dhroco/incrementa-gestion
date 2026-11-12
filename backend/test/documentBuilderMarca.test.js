const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const zlib = require('node:zlib')
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')

const { buildPdfBytesFromTipTapWithReactPdf, BRAND_LOGO, BRAND_ICON, BRAND_INSET, MARGIN, PAGE } = require('../services/documentBuilderTipTapReactPdf')
const { appendSignaturePage } = require('../services/contractSigningService')
const { brandImageSize } = require('../lib/pdfBrand')

function longDoc(paragraphs) {
  const content = []
  for (let i = 1; i <= paragraphs; i++) {
    content.push({
      type: 'paragraph',
      attrs: { textAlign: 'justify' },
      content: [
        { type: 'text', text: `${i}.1 `, marks: [{ type: 'bold' }] },
        { type: 'text', text: 'El Influencer se obliga a efectuar dicha eliminación dentro del plazo máximo de 24 (veinticuatro) horas contado desde la notificación escrita, la cual podrá realizarse por correo electrónico o mensaje directo a través del medio habitual de comunicación entre las partes. '.repeat(2) }
      ]
    })
  }
  return { type: 'doc', content }
}

async function imagesPerPage(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  return doc.getPages().map((page) => {
    const resources = page.node.Resources()
    const xobjects = resources && resources.lookup(PDFName.of('XObject'), PDFDict)
    if (!xobjects) return 0
    let n = 0
    for (const [, ref] of xobjects.entries()) {
      const obj = doc.context.lookup(ref)
      const subtype = obj && obj.dict && obj.dict.get(PDFName.of('Subtype'))
      if (subtype && String(subtype) === '/Image') n++
    }
    return n
  })
}

/** Decodifica un PNG RGB de 8 bits (sin entrelazado) a una lista de píxeles [r, g, b]. */
function decodeRgbPng(file) {
  const buf = fs.readFileSync(file)
  let offset = 8
  let width = 0
  let height = 0
  const idat = []
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset)
    const type = buf.subarray(offset + 4, offset + 8).toString('latin1')
    const data = buf.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      assert.equal(data[8], 8, 'profundidad de 8 bits')
      assert.equal(data[9], 2, 'RGB')
      assert.equal(data[12], 0, 'sin entrelazado')
    }
    if (type === 'IDAT') idat.push(data)
    offset += 12 + length
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * 3
  const pixels = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x]
      const left = x >= 3 ? pixels[y * stride + x - 3] : 0
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const upLeft = y > 0 && x >= 3 ? pixels[(y - 1) * stride + x - 3] : 0
      let recon
      if (filter === 0) recon = value
      else if (filter === 1) recon = value + left
      else if (filter === 2) recon = value + up
      else if (filter === 3) recon = value + Math.floor((left + up) / 2)
      else {
        const pa = Math.abs(up - upLeft)
        const pb = Math.abs(left - upLeft)
        const pc = Math.abs(left + up - 2 * upLeft)
        recon = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)
      }
      pixels[y * stride + x] = recon & 255
    }
  }
  const list = []
  for (let i = 0; i < pixels.length; i += 3) list.push([pixels[i], pixels[i + 1], pixels[i + 2]])
  return { width, height, list }
}

const share = (list, predicate) => list.filter(([r, g, b]) => predicate(r, g, b)).length / list.length

test('las dos imágenes de marca existen, son PNG RGB aplanados sobre blanco (sin transparencia) y están recortadas al contenido', () => {
  for (const spec of [BRAND_LOGO, BRAND_ICON]) {
    const header = fs.readFileSync(spec.file).subarray(0, 26)
    assert.equal(header.subarray(1, 4).toString(), 'PNG', spec.file)
    // Sin canal alfa: las imágenes con transparencia (máscara suave) no las leen los lectores de PDF antiguos
    // (p. ej. el pdf-parse de las pruebas: «bad XRef entry»). Sobre la hoja blanca se ven igual.
    assert.equal(header[25], 2, `${spec.file}: debe ser RGB sin alfa (aplanado sobre blanco)`)
  }
  const dims = (spec) => {
    const h = fs.readFileSync(spec.file).subarray(16, 24)
    return { w: h.readUInt32BE(0), h: h.readUInt32BE(4) }
  }
  assert.ok(dims(BRAND_LOGO).w / dims(BRAND_LOGO).h > 3, 'el logo es apaisado')
  assert.ok(dims(BRAND_ICON).w / dims(BRAND_ICON).h < 1, 'el ícono es vertical')
  assert.ok(dims(BRAND_LOGO).w < 1000 && dims(BRAND_ICON).h < 1000, 'sin el margen blanco original de 1080 px')
})

test('el tamaño de las imágenes es el 60% del anterior (logo 24 pt → 14,4 pt; ícono 32 pt → 19,2 pt)', () => {
  assert.equal(BRAND_LOGO.height, 14.4)
  assert.equal(BRAND_ICON.height, 19.2)
})

test('el logo está a la misma distancia del borde superior y del izquierdo; el ícono, del inferior y del derecho', () => {
  assert.equal(BRAND_LOGO.top, BRAND_LOGO.left)
  assert.equal(BRAND_ICON.bottom, BRAND_ICON.right)
  assert.equal(BRAND_LOGO.top, BRAND_INSET)
  assert.equal(BRAND_ICON.bottom, BRAND_INSET)
  assert.ok(BRAND_INSET > 0 && BRAND_INSET < MARGIN, 'dentro de la hoja y más cerca del borde que el texto')
})

test('el logo y el ícono quedan FUERA del bloque de texto: en la esquina, sobre la primera línea y bajo la última', () => {
  // Logo: parte desde fuera del margen izquierdo del texto y termina antes de que empiece el texto (margen superior).
  assert.ok(BRAND_LOGO.left < MARGIN, 'el logo empieza fuera de la columna de texto')
  assert.ok(BRAND_LOGO.top + BRAND_LOGO.height < MARGIN, 'el logo termina antes de la primera línea de texto')
  // Ícono: empieza fuera del margen derecho y termina antes de la última línea posible (margen inferior).
  assert.ok(BRAND_ICON.right < MARGIN, 'el ícono empieza fuera de la columna de texto')
  assert.ok(BRAND_ICON.bottom + BRAND_ICON.height < MARGIN, 'el ícono queda bajo la última línea de texto')
})

test('las hojas del contrato son tamaño carta (Letter, 612 x 792 pt = 8,5 x 11 pulgadas)', async () => {
  assert.deepEqual(PAGE, { W: 612, H: 792 })
  const bytes = await buildPdfBytesFromTipTapWithReactPdf(longDoc(60))
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  assert.ok(doc.getPageCount() >= 3)
  for (const page of doc.getPages()) assert.deepEqual([page.getWidth(), page.getHeight()], [612, 792])
})

test('la hoja de constancia de firma tiene el mismo tamaño que el contrato (carta; y A4 en un borrador antiguo)', async () => {
  const company = { business_name: 'Empresa SpA', short_name: 'Empresa', rut_body: '76123456', rut_dv: '7' }
  const opts = { signerName: 'Ana Usuario', company, signedAtFormatted: '1 de junio de 2026, 10:00', hash: 'abc123' }
  const letter = await buildPdfBytesFromTipTapWithReactPdf(longDoc(2))
  const withLetter = await PDFDocument.load(await appendSignaturePage(letter, opts))
  const sizesLetter = withLetter.getPages().map((p) => [p.getWidth(), p.getHeight()])
  assert.ok(sizesLetter.length >= 2)
  sizesLetter.forEach((size) => assert.deepEqual(size, [612, 792]))

  const a4 = await PDFDocument.create()
  a4.addPage([595.28, 841.89])
  const withA4 = await PDFDocument.load(await appendSignaturePage(Buffer.from(await a4.save()), opts))
  withA4.getPages().forEach((p) => assert.deepEqual([p.getWidth(), p.getHeight()], [595.28, 841.89]))
})

test('en un contrato de varias hojas, CADA hoja lleva las dos imágenes', async () => {
  const bytes = await buildPdfBytesFromTipTapWithReactPdf(longDoc(60))
  const perPage = await imagesPerPage(bytes)
  assert.ok(perPage.length >= 3, `debería tener varias hojas, tiene ${perPage.length}`)
  perPage.forEach((n, i) => assert.equal(n, 2, `hoja ${i + 1}: ${n} imágenes`))
})

test('un contrato de una sola hoja también las lleva, y las imágenes no se duplican en el archivo', async () => {
  const bytes = await buildPdfBytesFromTipTapWithReactPdf(longDoc(2))
  assert.deepEqual(await imagesPerPage(bytes), [2])
  const many = await buildPdfBytesFromTipTapWithReactPdf(longDoc(60))
  const doc = await PDFDocument.load(many, { ignoreEncryption: true })
  let imageObjects = 0
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const subtype = obj && obj.dict && obj.dict.get && obj.dict.get(PDFName.of('Subtype'))
    if (subtype && String(subtype) === '/Image') imageObjects++
  }
  assert.ok(imageObjects <= 6, `las imágenes se reutilizan entre hojas (hay ${imageObjects} objetos de imagen)`)
})

test('los colores de las imágenes son los de la marca (no están desteñidos ni mal interpretados)', () => {
  const logo = decodeRgbPng(BRAND_LOGO.file)
  assert.ok(share(logo.list, (r, g, b) => r < 90 && g < 90 && b < 90) > 0.08, 'el logo tiene letras gris oscuro')
  assert.ok(share(logo.list, (r, g, b) => b > 150 && r < 170 && g < 190) > 0.005, 'el logo tiene el azul/violeta del ícono')
  assert.ok(share(logo.list, (r, g, b) => r > 245 && g > 245 && b > 245) > 0.4, 'y fondo blanco')

  const icon = decodeRgbPng(BRAND_ICON.file)
  assert.ok(share(icon.list, (r, g, b) => b > 180 && r < 160 && g < 190) > 0.1, 'el ícono tiene azul y violeta')
  assert.ok(share(icon.list, (r, g, b) => r > 170 && b > 130 && g < 120) > 0.1, 'el ícono termina en magenta')
  assert.ok(share(icon.list, (r, g, b) => r > 245 && g > 245 && b > 245) < 0.5, 'y no es una imagen casi toda blanca')
})

test('el recuadro del timbre de Firme no queda cubierto por el logo ni el ícono', () => {
  const { STAMP_X, STAMP_Y, STAMP_WIDTH, STAMP_HEIGHT } = require('../lib/firmeStamp')
  const W = 612
  const H = 792
  const box = { left: STAMP_X * W, right: (STAMP_X + STAMP_WIDTH) * W, top: STAMP_Y * H, bottom: (STAMP_Y + STAMP_HEIGHT) * H }
  const logoSize = brandImageSize(BRAND_LOGO)
  const iconSize = brandImageSize(BRAND_ICON)
  const logo = { left: BRAND_LOGO.left, right: BRAND_LOGO.left + logoSize.width, top: BRAND_LOGO.top, bottom: BRAND_LOGO.top + logoSize.height }
  const icon = { left: W - BRAND_ICON.right - iconSize.width, right: W - BRAND_ICON.right, top: H - BRAND_ICON.bottom - iconSize.height, bottom: H - BRAND_ICON.bottom }
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  assert.equal(overlaps(logo, box), false)
  assert.equal(overlaps(icon, box), false)
})
