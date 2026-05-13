import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { VariableNode } from './VariableNode'
import styles from './styles.module.css'

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

/**
 * Vista previa de documento TipTap (solo lectura), sin tocar `window.currentEditor`.
 * Usada dentro del bloque de cláusula incrustada para mostrar texto + variables.
 */
export function ReadOnlyDocPreview({ content }) {
  const doc = content && typeof content === 'object' && content.type === 'doc' ? content : EMPTY_DOC

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      VariableNode,
    ],
    content: doc,
    editable: false,
    editorProps: {
      attributes: {
        class: 'embedded-clause-pm-root',
      },
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className={styles['embedded-clause-preview-wrap']}>
      <EditorContent editor={editor} className={styles['embedded-clause-preview-editor']} />
    </div>
  )
}
