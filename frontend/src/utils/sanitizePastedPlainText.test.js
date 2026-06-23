import { describe, expect, it } from 'vitest'
import {
  blocksFromSanitizedPaste,
  classifyPasteLine,
  paragraphsFromSanitizedPaste,
  sanitizePastedPlainText,
} from './sanitizePastedPlainText'

describe('sanitizePastedPlainText', () => {
  it('normalizes Windows and old-Mac line endings', () => {
    expect(sanitizePastedPlainText('Línea 1\r\nLínea 2\rLínea 3')).toBe('Línea 1\nLínea 2\nLínea 3')
  })

  it('removes Word/PDF invisible characters', () => {
    const withHidden = 'con\u200Bten\u00ADido\u00A0oculto'
    expect(sanitizePastedPlainText(withHidden)).toBe('contenido oculto')
  })

  it('converts tabs and exotic spaces to regular spaces', () => {
    expect(sanitizePastedPlainText('col1\tcol2\u2009col3')).toBe('col1 col2 col3')
  })

  it('strips BOM and trims trailing spaces per line', () => {
    expect(sanitizePastedPlainText('\uFEFFPárrafo 1   \nPárrafo 2  ')).toBe('Párrafo 1\nPárrafo 2')
  })

  it('collapses excessive blank lines', () => {
    expect(sanitizePastedPlainText('A\n\n\n\nB')).toBe('A\n\nB')
  })

  it('maps form feed and vertical tab to line breaks', () => {
    expect(sanitizePastedPlainText('Antes\fDespués\vFinal')).toBe('Antes\nDespués\nFinal')
  })
})

describe('classifyPasteLine', () => {
  it('detects bullet markers from Word and plain text', () => {
    expect(classifyPasteLine('• Primer ítem')).toEqual({ kind: 'bullet', depth: 0, text: 'Primer ítem' })
    expect(classifyPasteLine('- Guion')).toEqual({ kind: 'bullet', depth: 0, text: 'Guion' })
    expect(classifyPasteLine('  • Subítem')).toEqual({ kind: 'bullet', depth: 1, text: 'Subítem' })
  })

  it('detects numbered markers', () => {
    expect(classifyPasteLine('1. Primero')).toEqual({
      kind: 'ordered',
      depth: 0,
      text: 'Primero',
      number: 1,
    })
    expect(classifyPasteLine('2) Segundo')).toEqual({
      kind: 'ordered',
      depth: 0,
      text: 'Segundo',
      number: 2,
    })
    expect(classifyPasteLine('(3) Tercero')).toEqual({
      kind: 'ordered',
      depth: 0,
      text: 'Tercero',
      number: 3,
    })
    expect(classifyPasteLine('4 - Cuarto')).toEqual({
      kind: 'ordered',
      depth: 0,
      text: 'Cuarto',
      number: 4,
    })
  })

  it('treats non-list lines as paragraphs', () => {
    expect(classifyPasteLine('Cláusula general')).toEqual({
      kind: 'paragraph',
      depth: 0,
      text: 'Cláusula general',
    })
  })
})

describe('blocksFromSanitizedPaste', () => {
  it('returns empty array for whitespace-only paste', () => {
    expect(blocksFromSanitizedPaste('  \n  \u00A0  ')).toEqual([])
  })

  it('builds paragraph nodes from plain text', () => {
    expect(blocksFromSanitizedPaste('Título\r\n\r\nCuerpo')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Título' }] },
      { type: 'paragraph', content: [] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Cuerpo' }] },
    ])
  })

  it('converts consecutive bullet lines into a bulletList', () => {
    expect(blocksFromSanitizedPaste('Intro\n• Uno\n• Dos\nFin')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Uno' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dos' }] }] },
        ],
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'Fin' }] },
    ])
  })

  it('converts consecutive numbered lines into an orderedList with start attr', () => {
    expect(blocksFromSanitizedPaste('3. Tercero\n4. Cuarto')).toEqual([
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tercero' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cuarto' }] }] },
        ],
      },
    ])
  })

  it('builds nested bullet lists from indentation', () => {
    expect(blocksFromSanitizedPaste('• Padre\n  • Hijo\n• Otro')).toEqual([
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Padre' }] },
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hijo' }] }],
                  },
                ],
              },
            ],
          },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Otro' }] }] },
        ],
      },
    ])
  })

  it('splits mixed list types into separate lists', () => {
    expect(blocksFromSanitizedPaste('• Viñeta\n1. Número')).toEqual([
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Viñeta' }] }] },
        ],
      },
      {
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Número' }] }] },
        ],
      },
    ])
  })
})

describe('paragraphsFromSanitizedPaste alias', () => {
  it('delegates to blocksFromSanitizedPaste', () => {
    expect(paragraphsFromSanitizedPaste('• Uno')).toEqual(blocksFromSanitizedPaste('• Uno'))
  })
})
