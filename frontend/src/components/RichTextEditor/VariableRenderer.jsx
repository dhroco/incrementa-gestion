import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import styles from './styles.module.css';

const VariableRenderer = ({ node, updateAttributes }) => {
  const { variableId, label, group } = node.attrs;

  const handleClick = () => {
    // Seleccionar la variable completa al hacer clic
    const editor = window.currentEditor; // Referencia global al editor
    if (editor) {
      const { from, to } = editor.state.selection;
      editor.chain().focus().setTextSelection({ from, to }).run();
    }
  };

  return (
    <NodeViewWrapper className={styles['variable-wrapper']}>
      <span
        className={styles['variable-node']}
        onClick={handleClick}
        title={`${group}: ${label}`}
        data-variable-id={variableId}
        data-group={group}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
};

export default VariableRenderer;
