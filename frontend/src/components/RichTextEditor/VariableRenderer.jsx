import React from 'react'
import { NodeViewWrapper, useCurrentEditor } from '@tiptap/react'
import styles from './styles.module.css'
import { nodeHasMark, selectVariableNodeAt } from './inlineFormatting'

const VariableRenderer = ({ node, getPos, selected }) => {
  const { editor } = useCurrentEditor()
  const { variableId, label, group } = node.attrs
  const bold = nodeHasMark(node, 'bold')
  const italic = nodeHasMark(node, 'italic')
  const underline = nodeHasMark(node, 'underline')
  const uppercase = nodeHasMark(node, 'uppercase')

  const handleMouseDown = (event) => {
    event.preventDefault()
    if (!editor || typeof getPos !== 'function') return
    const pos = getPos()
    if (typeof pos !== 'number') return
    selectVariableNodeAt(editor, pos)
  }

  const className = [
    styles['variable-node'],
    selected ? styles['variable-node--selected'] : '',
    bold ? styles['variable-node--bold'] : '',
    italic ? styles['variable-node--italic'] : '',
    underline ? styles['variable-node--underline'] : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <NodeViewWrapper className={styles['variable-wrapper']} as="span">
      <span
        className={className}
        onMouseDown={handleMouseDown}
        title={`${group}: ${label}`}
        data-variable-id={variableId}
        data-group={group}
        data-uppercase={uppercase ? 'true' : undefined}
        data-bold={bold ? 'true' : undefined}
      >
        {label}
      </span>
    </NodeViewWrapper>
  )
}

export default VariableRenderer
