const test = require('node:test')
const assert = require('node:assert/strict')
const { buildPdfBytesFromTipTapWithReactPdf, flattenInline, flatToCoalescedParts } = require('../services/documentBuilderTipTapReactPdf')
const { applySubstitutionsToTipTapDoc } = require('../services/documentBuilderVariableContext')

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

test('paragraph with uppercase mark still produces valid PDF', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'contrato', marks: [{ type: 'uppercase' }] }],
      },
    ],
  }
  const b = await buildPdfBytesFromTipTapWithReactPdf(doc)
  assert.equal(Buffer.from(b).slice(0, 4).toString('latin1'), '%PDF')
})

test('resolved variable with bold and uppercase marks flatten for PDF', () => {
  const templateDoc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'variable',
            attrs: { variableId: 'proveedor_nombre', label: 'Nombre', group: 'proveedor' },
            marks: [{ type: 'bold' }, { type: 'uppercase' }],
          },
        ],
      },
    ],
  }
  const resolved = applySubstitutionsToTipTapDoc(templateDoc, { proveedor_nombre: 'Ana Pérez' })
  const parts = flatToCoalescedParts(flattenInline(resolved.content[0].content))
  assert.equal(parts.length, 1)
  assert.equal(parts[0].text, 'ANA PÉREZ')
  assert.equal(parts[0].bold, true)
})
