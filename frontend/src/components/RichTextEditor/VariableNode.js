import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import VariableRenderer from './VariableRenderer';

export const VariableNode = Node.create({
  name: 'variable',

  group: 'inline',

  inline: true,

  atom: true,

  marks: '_',

  addAttributes() {
    return {
      variableId: {
        default: null,
      },
      label: {
        default: '',
      },
      group: {
        default: '',
      },
      uppercase: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-uppercase') === 'true',
        renderHTML: (attributes) =>
          attributes.uppercase ? { 'data-uppercase': 'true' } : {},
      },
      bold: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-bold') === 'true',
        renderHTML: (attributes) => (attributes.bold ? { 'data-bold': 'true' } : {}),
      },
      italic: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-italic') === 'true',
        renderHTML: (attributes) => (attributes.italic ? { 'data-italic': 'true' } : {}),
      },
      underline: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-underline') === 'true',
        renderHTML: (attributes) => (attributes.underline ? { 'data-underline': 'true' } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="variable"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-type': 'variable', ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableRenderer);
  },

  addCommands() {
    return {
      insertVariable: (variable) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: {
            variableId: variable.id,
            label: variable.label,
            group: variable.group,
          },
        });
      },
    };
  },
});
