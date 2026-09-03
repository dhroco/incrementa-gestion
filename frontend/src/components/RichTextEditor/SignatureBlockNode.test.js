// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { SignatureBlockNode } from './SignatureBlockNode'
import { VariableNode } from './VariableNode'

const fixtureDoc = {
  type: 'doc',
  content: [
    {
      type: 'signatureBlock',
      attrs: { party: 'company', repIndex: 1 },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '________________________' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'variable',
              attrs: { variableId: 'company_legal_rep1_name', label: 'Nombre Rep. Legal 1', group: 'company' },
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'p.p. EMPRESA SpA' }] },
      ],
    },
    {
      type: 'signatureBlock',
      attrs: { party: 'supplier', repIndex: null },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '________________________' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'variable',
              attrs: { variableId: 'proveedor_nombre', label: 'Nombre / Razón Social', group: 'proveedor' },
            },
          ],
        },
      ],
    },
  ],
}

describe('SignatureBlockNode round-trip', () => {
  it('preserves signatureBlock wraps after load and getJSON without edits', () => {
    const editor = new Editor({
      extensions: [StarterKit, VariableNode, SignatureBlockNode],
      content: fixtureDoc,
    })

    try {
      const json = editor.getJSON()
      expect(json.content).toHaveLength(2)
      expect(json.content[0].type).toBe('signatureBlock')
      expect(json.content[0].attrs).toEqual({ party: 'company', repIndex: 1 })
      expect(json.content[0].content).toHaveLength(3)
      expect(json.content[1].type).toBe('signatureBlock')
      expect(json.content[1].attrs).toEqual({ party: 'supplier', repIndex: null })
      expect(json.content[1].content).toHaveLength(2)
    } finally {
      editor.destroy()
    }
  })
})
