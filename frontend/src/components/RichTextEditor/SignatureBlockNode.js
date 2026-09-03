import { Node } from '@tiptap/core'

export const SignatureBlockNode = Node.create({
  name: 'signatureBlock',

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      party: {
        default: null,
      },
      repIndex: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="signatureBlock"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'signatureBlock', ...HTMLAttributes }, 0]
  },
})
