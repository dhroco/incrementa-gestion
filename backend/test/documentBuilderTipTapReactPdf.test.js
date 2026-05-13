const test = require('node:test')
const assert = require('node:assert/strict')
const { buildPdfBytesFromTipTapWithReactPdf } = require('../services/documentBuilderTipTapReactPdf')

const minDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hola', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' mundo.' },
      ],
    },
  ],
}

test('buildPdfBytesFromTipTapWithReactPdf returns PDF signature', async () => {
  const buf = await buildPdfBytesFromTipTapWithReactPdf(minDoc)
  assert.ok(Buffer.isBuffer(buf) || buf instanceof Uint8Array)
  const b = Buffer.from(buf)
  assert.equal(b.slice(0, 4).toString('latin1'), '%PDF', 'first bytes are PDF')
})

test('empty doc still produces PDF', async () => {
  const b = await buildPdfBytesFromTipTapWithReactPdf({ type: 'doc', content: [] })
  assert.equal(Buffer.from(b).slice(0, 4).toString('latin1'), '%PDF')
})

test('paragraph with mixed marks still produces valid PDF', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hola ' },
          { type: 'text', text: 'mundo', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' fin.' },
        ],
      },
    ],
  }
  const b = await buildPdfBytesFromTipTapWithReactPdf(doc)
  assert.equal(Buffer.from(b).slice(0, 4).toString('latin1'), '%PDF')
})

test('paragraph with has-text-align-center class (no textAlign attr) still produces valid PDF', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { class: 'has-text-align-center' },
        content: [{ type: 'text', text: 'Centrado' }],
      },
    ],
  }
  const b = await buildPdfBytesFromTipTapWithReactPdf(doc)
  assert.equal(Buffer.from(b).slice(0, 4).toString('latin1'), '%PDF')
})
