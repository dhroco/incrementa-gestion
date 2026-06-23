/**
 * Whether a TipTap node carries an inline mark (or legacy variable attr).
 * @param {import('@tiptap/pm/model').Node} node
 * @param {string} type
 */
export function nodeHasMark(node, type) {
  if (!node) return false
  if (node.attrs?.[type]) return true
  return Array.isArray(node.marks) && node.marks.some((mark) => mark?.type === type)
}

/**
 * Select the variable node at `pos` in the editor.
 * @param {import('@tiptap/react').Editor} editor
 * @param {number} pos
 */
export function selectVariableNodeAt(editor, pos) {
  if (!editor || typeof pos !== 'number') return
  editor.chain().focus().setNodeSelection(pos).run()
}

export function toggleBoldFormatting(editor) {
  if (!editor) return false
  return editor.chain().focus().toggleBold().run()
}

export function isBoldFormattingActive(editor) {
  return Boolean(editor?.isActive('bold'))
}

export function toggleItalicFormatting(editor) {
  if (!editor) return false
  return editor.chain().focus().toggleItalic().run()
}

export function isItalicFormattingActive(editor) {
  return Boolean(editor?.isActive('italic'))
}

export function toggleUnderlineFormatting(editor) {
  if (!editor) return false
  return editor.chain().focus().toggleUnderline().run()
}

export function isUnderlineFormattingActive(editor) {
  return Boolean(editor?.isActive('underline'))
}

export function toggleUppercaseFormatting(editor) {
  if (!editor) return false
  return editor.chain().focus().toggleUppercase().run()
}

export function isUppercaseFormattingActive(editor) {
  return Boolean(editor?.isActive('uppercase'))
}
