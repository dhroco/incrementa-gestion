const test = require('node:test')
const assert = require('node:assert/strict')
const { PDFDocument } = require('pdf-lib')
const {
  buildPdfBytesFromTipTapDoc,
  shouldJustifyLine,
  normalizeTextForPdfTokenization,
  justifyGapAfterToken,
  countJustifyGaps,
  shouldMergePdfSplitWord,
  mergeAdjacentPiecesForPdf
} = require('../services/documentBuilderTipTapPdf')
const { applySubstitutionsToTipTapDoc } = require('../services/documentBuilderVariableContext')

test('buildPdfBytesFromTipTapDoc produces valid PDF with headings lists bold alignment', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1, textAlign: 'center' },
        content: [{ type: 'text', text: 'Título central' }]
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [
          { type: 'text', text: 'Normal ' },
          { type: 'text', text: 'negrita', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' y ' },
          { type: 'text', text: 'cursiva', marks: [{ type: 'italic' }] },
          { type: 'hardBreak' },
          { type: 'text', text: 'segunda línea' }
        ]
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Item A' }]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Item B' }]
              }
            ]
          }
        ]
      },
      {
        type: 'orderedList',
        attrs: { start: 1 },
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Uno' }]
              }
            ]
          }
        ]
      }
    ]
  }
  const bytes = await buildPdfBytesFromTipTapDoc(doc)
  assert.ok(Buffer.from(bytes).subarray(0, 4).toString('binary') === '%PDF')
  const pdf = await PDFDocument.load(bytes)
  assert.ok(pdf.getPageCount() >= 1)
})

test('normalizeTextForPdfTokenization joins word split by TAB or NBSP between letters', () => {
  assert.equal(normalizeTextForPdfTokenization('gratifi\tcación'), 'gratificación')
  assert.equal(normalizeTextForPdfTokenization('gratifi\u00a0cación'), 'gratificación')
  assert.equal(normalizeTextForPdfTokenization('gratifi\u200bcación'), 'gratificación')
})

test('normalizeTextForPdfTokenization keeps NBSP after punctuation (Sr. name)', () => {
  assert.equal(normalizeTextForPdfTokenization('Sr.\u00a0Juan'), 'Sr.\u00a0Juan')
})

test('normalizeTextForPdfTokenization does not merge digit-tab-letter (column-like)', () => {
  assert.equal(normalizeTextForPdfTokenization('Col1\tCol2'), 'Col1 Col2')
})

test('mergeAdjacentPiecesForPdf joins mark-split word gratificación', () => {
  const pieces = [
    { text: 'gratif', bold: false, italic: false, underline: false },
    { text: 'cación ', bold: true, italic: false, underline: false }
  ]
  assert.equal(shouldMergePdfSplitWord(pieces[0], pieces[1]), true)
  const merged = mergeAdjacentPiecesForPdf(pieces)
  assert.equal(merged.length, 1)
  assert.ok(merged[0].text.includes('gratif'))
  assert.ok(merged[0].text.includes('cación'))
  assert.equal(merged[0].bold, true)
})

test('mergeAdjacentPiecesForPdf does not join two words separated by space in data', () => {
  const pieces = [
    { text: 'una ', bold: false, italic: false, underline: false },
    { text: 'palabra', bold: true, italic: false, underline: false }
  ]
  assert.equal(shouldMergePdfSplitWord(pieces[0], pieces[1]), false)
  const merged = mergeAdjacentPiecesForPdf(pieces)
  assert.equal(merged.length, 2)
})

test('mergeAdjacentPiecesForPdf does not join para + llevar (different marks)', () => {
  const pieces = [
    { text: 'para', bold: false, italic: false, underline: false },
    { text: 'llevar', bold: true, italic: false, underline: false }
  ]
  assert.equal(shouldMergePdfSplitWord(pieces[0], pieces[1]), false)
  assert.equal(mergeAdjacentPiecesForPdf(pieces).length, 2)
})

test('justifyGapAfterToken: no gap between mark-split word parts; gap after real space', () => {
  const toks = [
    { text: 'gratifi', bold: false, italic: false, underline: false, size: 11 },
    { text: 'cación ', bold: true, italic: false, underline: false, size: 11 }
  ]
  assert.equal(justifyGapAfterToken(toks, 0), false)
  const toks2 = [
    { text: 'una ', bold: false, italic: false, underline: false, size: 11 },
    { text: 'palabra', bold: false, italic: false, underline: false, size: 11 }
  ]
  assert.equal(justifyGapAfterToken(toks2, 0), true)
  assert.equal(countJustifyGaps(toks), 0)
  assert.equal(countJustifyGaps(toks2), 1)
})

test('shouldJustifyLine skips short last line (typographic justify)', () => {
  assert.equal(shouldJustifyLine(0, 3, 400, 500), true)
  assert.equal(shouldJustifyLine(2, 3, 200, 500), false)
  assert.equal(shouldJustifyLine(2, 3, 498, 500), true)
})

test('buildPdfBytesFromTipTapDoc handles textAlign justify without throwing', async () => {
  const longWord = 'palabra '.repeat(40)
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'justify' },
        content: [{ type: 'text', text: `${longWord}fin.` }]
      },
      {
        type: 'paragraph',
        attrs: { textAlign: 'justified' },
        content: [{ type: 'text', text: 'Corto' }]
      }
    ]
  }
  const bytes = await buildPdfBytesFromTipTapDoc(doc)
  const pdf = await PDFDocument.load(bytes)
  assert.ok(pdf.getPageCount() >= 1)
})

test('buildPdfBytesFromTipTapDoc accepts TAB and NBSP in text (WinAnsi-safe)', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Col1\tCol2\u00a0' }]
      }
    ]
  }
  const bytes = await buildPdfBytesFromTipTapDoc(doc)
  const pdf = await PDFDocument.load(bytes)
  assert.ok(pdf.getPageCount() >= 1)
})

test('applySubstitutionsToTipTapDoc then PDF: no variable nodes remain and PDF loads', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hola ' },
          { type: 'variable', attrs: { variableId: 'worker_name', label: 'N', group: 'g' } },
          { type: 'text', text: ' fin {{worker_rut}}' }
        ]
      }
    ]
  }
  const map = { worker_name: 'Pat', worker_rut: '1-9' }
  const resolved = applySubstitutionsToTipTapDoc(doc, map)
  const types = []
  function collectTypes(node) {
    if (!node || typeof node !== 'object') return
    if (node.type) types.push(node.type)
    if (Array.isArray(node.content)) for (const c of node.content) collectTypes(c)
  }
  collectTypes(resolved)
  assert.ok(!types.includes('variable'))
  const bytes = await buildPdfBytesFromTipTapDoc(resolved)
  const pdf = await PDFDocument.load(bytes)
  assert.ok(pdf.getPageCount() >= 1)
})
