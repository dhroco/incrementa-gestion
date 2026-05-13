import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import VariableRenderer from './VariableRenderer';

export const VariableNode = Node.create({
  name: 'variable',

  group: 'inline',

  inline: true,

  atom: true,

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
