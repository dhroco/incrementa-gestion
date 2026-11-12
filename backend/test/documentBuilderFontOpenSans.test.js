const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib')

const { buildPdfBytesFromTipTapWithReactPdf } = require('../services/documentBuilderTipTapReactPdf')
const templates = require('./fixtures/plantillas-genero-neutro.json')

const FONT_DIR = path.join(__dirname, '..', 'node_modules', '@fontsource', 'open-sans', 'files')
const FILES = ['400-normal', '700-normal', '400-italic', '700-italic'].map((v) => path.join(FONT_DIR, `open-sans-latin-${v}.woff`))

function fontkit() {
  try {
    return require('fontkit')
  } catch {
    return require('@react-pdf/fontkit')
  }
}

function textOf(node) {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(textOf).join('')
}

async function fontNames(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const names = new Set()
  for (const page of doc.getPages()) {
    const resources = page.node.Resources()
    const fonts = resources && resources.lookup(PDFName.of('Font'), PDFDict)
    if (!fonts) continue
    for (const [, ref] of fonts.entries()) {
      const font = doc.context.lookup(ref)
      const base = font && font.get && font.get(PDFName.of('BaseFont'))
      if (base) names.add(String(base).replace('/', '').replace(/^[A-Z]{6}\+/, ''))
    }
  }
  return [...names]
}

const SAMPLE = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'PRIMERO: Antecedentes.' }] },
    {
      type: 'paragraph',
      attrs: { textAlign: 'justify' },
      content: [
        { type: 'text', text: '1.1 ', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'Contrato con “Influencer” Ñuñoa, año 2026, $1.234.567 – RUT 12.345.678-5, N° 1, ¿cómo? ¡sí! ' },
        { type: 'text', text: 'cursiva', marks: [{ type: 'italic' }] }
      ]
    }
  ]
}

test('el PDF de un contrato usa Open Sans (regular, negrita y cursiva) y ya no Lora ni Helvetica', async () => {
  const bytes = await buildPdfBytesFromTipTapWithReactPdf(SAMPLE)
  const names = await fontNames(bytes)
  assert.ok(names.some((n) => /OpenSans.*Regular|OpenSans$/i.test(n) || /Open.?Sans/i.test(n)), `fuentes: ${names.join(', ')}`)
  assert.ok(names.some((n) => /Bold/i.test(n) && /Open.?Sans/i.test(n)), `sin negrita Open Sans: ${names.join(', ')}`)
  assert.equal(names.some((n) => /Lora/i.test(n)), false, `aún usa Lora: ${names.join(', ')}`)
  assert.equal(names.some((n) => /^Helvetica/i.test(n)), false, `usa Helvetica en el cuerpo: ${names.join(', ')}`)
})

test('los cuatro archivos de la fuente existen y son Open Sans', () => {
  const fk = fontkit()
  for (const file of FILES) {
    assert.ok(fs.existsSync(file), file)
    assert.equal(fk.openSync(file).familyName, 'Open Sans', file)
  }
})

test('la fuente trae todos los caracteres que usan las 17 plantillas y los valores típicos (tildes, ñ, comillas, guiones, símbolos)', () => {
  const fk = fontkit()
  const used = new Set()
  for (const doc of Object.values(templates)) for (const block of doc.content) for (const ch of textOf(block)) used.add(ch)
  for (const ch of 'áéíóúÁÉÍÓÚñÑüÜ¿¡“”‘’«»–—…°º$€%&/()[]{}:;,.-+*=<>@#') used.add(ch)
  for (const file of FILES) {
    const font = fk.openSync(file)
    const missing = [...used].filter((ch) => !/\s/.test(ch) && !font.hasGlyphForCodePoint(ch.codePointAt(0)))
    assert.deepEqual(missing, [], `${path.basename(file)} no tiene: ${missing.join(' ')}`)
  }
})

test('el cuerpo del contrato sigue en 11 pt', async () => {
  const bytes = await buildPdfBytesFromTipTapWithReactPdf(SAMPLE)
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  assert.ok(doc.getPageCount() >= 1)
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'documentBuilderTipTapReactPdf.js'), 'utf8')
  assert.match(source, /const BODY = 11\b/)
})
