import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import EmbeddedUniversalClauseRenderer from './EmbeddedUniversalClauseRenderer'

export const EmbeddedUniversalClauseNode = Node.create({
  name: 'embeddedUniversalClause',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      accessToken: null,
    }
  },

  addAttributes() {
    return {
      clauseId: { default: null },
      instanceId: { default: null },
      code: { default: '' },
      titleClause: { default: '' },
      clauseKind: { default: 'universal' },
      companyId: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="embedded-universal-clause"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'embedded-universal-clause', ...HTMLAttributes }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbeddedUniversalClauseRenderer)
  },

  addCommands() {
    return {
      insertEmbeddedUniversalClause:
        (attrs) =>
        ({ commands }) => {
          const instanceId =
            attrs.instanceId ||
            (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `emb-${Date.now()}`)
          return commands.insertContent({
            type: this.name,
            attrs: {
              ...attrs,
              instanceId,
              clauseKind: attrs.clauseKind ?? 'universal',
              companyId: attrs.companyId ?? null,
            },
          })
        },
    }
  },
})
