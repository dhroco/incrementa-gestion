import { Mark } from '@tiptap/core'

export const UppercaseMark = Mark.create({
  name: 'uppercase',

  parseHTML() {
    return [
      { tag: 'span[data-uppercase="true"]' },
      {
        style: 'text-transform',
        getAttrs: (value) => (value === 'uppercase' ? {} : false),
      },
    ]
  },

  renderHTML() {
    return ['span', { 'data-uppercase': 'true', style: 'text-transform: uppercase' }, 0]
  },

  addCommands() {
    return {
      toggleUppercase:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    }
  },
})
