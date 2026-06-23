import React, { useMemo, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { VariableNode } from './VariableNode'
import { UppercaseMark } from './UppercaseMark'
import {
  toggleBoldFormatting,
  isBoldFormattingActive,
  toggleItalicFormatting,
  isItalicFormattingActive,
  toggleUnderlineFormatting,
  isUnderlineFormattingActive,
  toggleUppercaseFormatting,
  isUppercaseFormattingActive,
} from './inlineFormatting'
import VariableCatalog from './VariableCatalog'
import 'prosemirror-gapcursor/style/gapcursor.css'
import { blocksFromSanitizedPaste } from '../../utils/sanitizePastedPlainText'
import styles from './styles.module.css'

function AlignIcon({ kind }) {
  const lines =
    kind === 'justify'
      ? [16, 16, 16, 16]
      : kind === 'center'
        ? [12, 16, 14, 16]
        : kind === 'right'
          ? [10, 16, 14, 16]
          : [16, 12, 14, 16] // left

  const x1 =
    kind === 'center'
      ? [2, 0, 1, 0]
      : kind === 'right'
        ? [6, 0, 2, 0]
        : [0, 0, 0, 0]

  const ys = [5, 8, 11, 14]

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden focusable="false">
      {ys.map((y, idx) => (
        <rect key={y} x={x1[idx]} y={y} width={lines[idx]} height="1.6" rx="0.6" fill="currentColor" />
      ))}
    </svg>
  )
}

const RichTextEditor = ({
  content = '',
  onChange,
  variant = 'default',
  readOnly = false,
  documentTitle = null,
  contentVersion = 0,
  onCopyFromButtonClick = null,
}) => {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [zoom, setZoom] = useState(1)

  const zoomState = useMemo(() => {
    const clamp = (v) => Math.min(2, Math.max(0.5, v))
    const step = 0.1
    return {
      value: zoom,
      percent: Math.round(zoom * 100),
      canDec: zoom > 0.5,
      canInc: zoom < 2,
      dec: () => setZoom((z) => clamp(Number((z - step).toFixed(2)))),
      inc: () => setZoom((z) => clamp(Number((z + step).toFixed(2)))),
      reset: () => setZoom(1),
    }
  }, [zoom])

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        dropcursor: {
          color: '#657A8A',
          width: 2,
        },
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      UppercaseMark,
      VariableNode,
    ],
    []
  )

  const editorRef = useRef(null)
  const editor = useEditor(
    {
      editable: !readOnly,
      extensions,
      content,
      onUpdate: ({ editor: ed }) => {
        if (readOnly) return
        if (onChange) {
          onChange(ed.getJSON())
        }
      },
      // handlePaste must return true after insertContent, or ProseMirror also runs its default paste (duplicate).
      editorProps: {
        handlePaste: (_view, event) => {
          if (readOnly) return false
          if (!event?.clipboardData) return false
          const text = event.clipboardData.getData('text/plain')
          const ed = editorRef.current
          if (!text || !ed) return false
          const blocks = blocksFromSanitizedPaste(text)
          if (!blocks.length) return false
          ed.chain().focus().insertContent(blocks).run()
          return true
        },
      },
    },
    [readOnly]
  )

  const lastAppliedContentKeyRef = useRef('')
  const lastContentVersionRef = useRef(0)
  React.useEffect(() => {
    if (!editor) return
    const externalApply = contentVersion > lastContentVersionRef.current
    if (!readOnly && !externalApply) return
    let nextKey = ''
    try {
      nextKey = typeof content === 'string' ? content : JSON.stringify(content ?? null)
    } catch {
      nextKey = String(content ?? '')
    }
    if (!externalApply && nextKey === lastAppliedContentKeyRef.current) return
    lastAppliedContentKeyRef.current = nextKey
    if (externalApply) {
      lastContentVersionRef.current = contentVersion
    }
    // Defer to avoid flushSync warnings from devtools overriding updates.
    let cancelled = false
    const apply = () => {
      if (cancelled) return
      editor.commands.setContent(content ?? '', false)
    }
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(apply)
    } else {
      setTimeout(apply, 0)
    }
    return () => {
      cancelled = true
    }
  }, [editor, readOnly, content, contentVersion])

  React.useEffect(() => {
    editorRef.current = editor ?? null
    return () => {
      editorRef.current = null
    }
  }, [editor])

  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  const handleVariableSelect = (variable) => {
    if (readOnly || !editor) return
    editor.chain().focus().insertVariable(variable).run()
  }

  React.useEffect(() => {
    if (readOnly) {
      window.currentEditor = null
      return undefined
    }
    window.currentEditor = editor
    return () => {
      window.currentEditor = null
    }
  }, [editor, readOnly])

  if (!editor) {
    return null
  }

  const rootClass = [
    variant === 'document' ? `${styles['rich-text-editor']} ${styles['rich-text-editor--document']}` : styles['rich-text-editor'],
    readOnly ? styles['rich-text-editor--readonly'] : '',
  ]
    .filter(Boolean)
    .join(' ')

  const toolbar =
    variant === 'document' || !readOnly ? (
      <Toolbar
        editor={editor}
        variant={variant}
        readOnly={readOnly}
        documentTitle={documentTitle}
        onVariableButtonClick={() => setIsCatalogOpen(true)}
        onCopyFromButtonClick={onCopyFromButtonClick}
        zoomState={zoomState}
      />
    ) : null
  const body =
    variant === 'document' ? (
      <div className={styles['document-zoom-viewport']}>
        <div
          className={styles['document-zoom-stage']}
          /* `zoom` evita `transform: scale` sobre el ancestro de ProseMirror (rompe readDOMChange / posiciones negativas). */
          style={{ zoom: zoomState.value }}
        >
          <div className={styles['document-page']}>
            <EditorContent editor={editor} className={styles['editor-content']} />
          </div>
        </div>
      </div>
    ) : (
      <EditorContent editor={editor} className={styles['editor-content']} />
    )

  return (
    <div className={rootClass}>
      {variant === 'document' ? (
        <div className={styles['document-shell']}>
          {toolbar}
          {body}
        </div>
      ) : (
        <>
          {toolbar}
          {body}
        </>
      )}
      {!readOnly ? (
        <VariableCatalog
          isOpen={isCatalogOpen}
          onClose={() => setIsCatalogOpen(false)}
          onVariableSelect={handleVariableSelect}
        />
      ) : null}
    </div>
  )
}

const Toolbar = ({ editor, variant, readOnly, documentTitle, onVariableButtonClick, onCopyFromButtonClick, zoomState }) => {
  if (!editor) {
    return null
  }

  if (variant === 'document') {
    const b = (labelNode, isActive, onClick, title) => (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`${styles['toolbar-document-button']} ${isActive ? styles['toolbar-document-button-active'] : ''}`}
      >
        {labelNode}
      </button>
    )

    if (readOnly) {
      const title = typeof documentTitle === 'string' && documentTitle.trim().length ? documentTitle.trim() : null
      return (
        <div className={styles['toolbar-document']}>
          <div className={styles['toolbar-document-left']}>
            {title ? <div className={styles['toolbar-document-title']}>{title}</div> : null}
          </div>
          <div className={styles['toolbar-document-right']}>
            <div className={styles['toolbar-document-zoom']}>
              <button
                type="button"
                className={styles['toolbar-document-zoom-btn']}
                onClick={zoomState?.dec}
                disabled={!zoomState?.canDec}
                title="Disminuir zoom"
              >
                −
              </button>
              <button
                type="button"
                className={styles['toolbar-document-zoom-pill']}
                onClick={zoomState?.reset}
                title="Reset 100%"
              >
                {zoomState?.percent ?? 100}%
              </button>
              <button
                type="button"
                className={styles['toolbar-document-zoom-btn']}
                onClick={zoomState?.inc}
                disabled={!zoomState?.canInc}
                title="Aumentar zoom"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className={styles['toolbar-document']}>
        <div className={styles['toolbar-document-left']}>
          {b('H1', editor.isActive('heading', { level: 1 }), () =>
            editor.chain().focus().toggleHeading({ level: 1 }).run(),
            'Título 1'
          )}
          {b('H2', editor.isActive('heading', { level: 2 }), () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
            'Título 2'
          )}
          {b('H3', editor.isActive('heading', { level: 3 }), () =>
            editor.chain().focus().toggleHeading({ level: 3 }).run(),
            'Título 3'
          )}
          <span className={styles['toolbar-document-divider']} aria-hidden />
          {b(
            <span className={styles['toolbar-document-bold']}>B</span>,
            isBoldFormattingActive(editor),
            () => toggleBoldFormatting(editor),
            'Negrita'
          )}
          {b(
            <span className={styles['toolbar-document-italic']}>I</span>,
            isItalicFormattingActive(editor),
            () => toggleItalicFormatting(editor),
            'Cursiva'
          )}
          {b(
            <span className={styles['toolbar-document-underline']}>U</span>,
            isUnderlineFormattingActive(editor),
            () => toggleUnderlineFormatting(editor),
            'Subrayado'
          )}
          {b('S', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Tachado')}
          {b(
            <span className={styles['toolbar-document-uppercase']}>AA</span>,
            isUppercaseFormattingActive(editor),
            () => toggleUppercaseFormatting(editor),
            'Mayúsculas'
          )}
          <span className={styles['toolbar-document-divider']} aria-hidden />
          {(() => {
            const isLeft =
              editor.isActive({ textAlign: 'left' }) ||
              (!editor.isActive({ textAlign: 'center' }) &&
                !editor.isActive({ textAlign: 'right' }) &&
                !editor.isActive({ textAlign: 'justify' }))
            return b(
              <span className={styles['toolbar-document-align-icon']}>
                <AlignIcon kind="left" />
              </span>,
              isLeft,
              () => editor.chain().focus().setTextAlign('left').run(),
              'Alinear a la izquierda'
            )
          })()}
          {b(
            <span className={styles['toolbar-document-align-icon']}>
              <AlignIcon kind="center" />
            </span>,
            editor.isActive({ textAlign: 'center' }),
            () => editor.chain().focus().setTextAlign('center').run(),
            'Centrar'
          )}
          {b(
            <span className={styles['toolbar-document-align-icon']}>
              <AlignIcon kind="right" />
            </span>,
            editor.isActive({ textAlign: 'right' }),
            () => editor.chain().focus().setTextAlign('right').run(),
            'Alinear a la derecha'
          )}
          {b(
            <span className={styles['toolbar-document-align-icon']}>
              <AlignIcon kind="justify" />
            </span>,
            editor.isActive({ textAlign: 'justify' }),
            () => editor.chain().focus().setTextAlign('justify').run(),
            'Justificar'
          )}
          <span className={styles['toolbar-document-divider']} aria-hidden />
          {b(
            <span className={styles['toolbar-document-listicon']} aria-hidden>
              <span className={styles['toolbar-document-listicon-dot']}>•</span>
              <span className={styles['toolbar-document-listicon-lines']}>≡</span>
            </span>,
            editor.isActive('bulletList'),
            () => editor.chain().focus().toggleBulletList().run(),
            'Lista'
          )}
          {b(
            <span className={styles['toolbar-document-listicon']} aria-hidden>
              <span className={styles['toolbar-document-listicon-num']}>1.</span>
              <span className={styles['toolbar-document-listicon-lines']}>≡</span>
            </span>,
            editor.isActive('orderedList'),
            () => editor.chain().focus().toggleOrderedList().run(),
            'Lista numerada'
          )}
        </div>

        <div className={styles['toolbar-document-right']}>
          <div className={styles['toolbar-document-zoom']}>
            <button
              type="button"
              className={styles['toolbar-document-zoom-btn']}
              onClick={zoomState?.dec}
              disabled={!zoomState?.canDec}
              title="Disminuir zoom"
            >
              −
            </button>
            <button
              type="button"
              className={styles['toolbar-document-zoom-pill']}
              onClick={zoomState?.reset}
              title="Reset 100%"
            >
              {zoomState?.percent ?? 100}%
            </button>
            <button
              type="button"
              className={styles['toolbar-document-zoom-btn']}
              onClick={zoomState?.inc}
              disabled={!zoomState?.canInc}
              title="Aumentar zoom"
            >
              +
            </button>
          </div>

          <span className={styles['toolbar-document-divider']} aria-hidden />

          {onCopyFromButtonClick ? (
            <button
              type="button"
              title="Copiar contenido desde otra plantilla"
              onClick={onCopyFromButtonClick}
              className={`${styles['toolbar-document-button']} ${styles['toolbar-document-copy-from']}`}
            >
              Copiar desde
            </button>
          ) : null}

          <button
            type="button"
            title="Insertar variables"
            onClick={onVariableButtonClick}
            className={`${styles['toolbar-document-button']} ${styles['toolbar-document-variable']}`}
          >
            Variables
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`${styles['toolbar-button']} ${editor.isActive('heading', { level: 1 }) ? styles['toolbar-button-active'] : ''}`}
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${styles['toolbar-button']} ${editor.isActive('heading', { level: 2 }) ? styles['toolbar-button-active'] : ''}`}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`${styles['toolbar-button']} ${editor.isActive('heading', { level: 3 }) ? styles['toolbar-button-active'] : ''}`}
      >
        H3
      </button>
      <button
        type="button"
        onClick={() => toggleBoldFormatting(editor)}
        className={`${styles['toolbar-button']} ${isBoldFormattingActive(editor) ? styles['toolbar-button-active'] : ''}`}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => toggleItalicFormatting(editor)}
        className={`${styles['toolbar-button']} ${isItalicFormattingActive(editor) ? styles['toolbar-button-active'] : ''}`}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => toggleUnderlineFormatting(editor)}
        className={`${styles['toolbar-button']} ${isUnderlineFormattingActive(editor) ? styles['toolbar-button-active'] : ''}`}
        title="Subrayado"
      >
        U
      </button>
      <button
        type="button"
        onClick={() => toggleUppercaseFormatting(editor)}
        className={`${styles['toolbar-button']} ${isUppercaseFormattingActive(editor) ? styles['toolbar-button-active'] : ''}`}
        title="Mayúsculas"
      >
        AA
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${styles['toolbar-button']} ${editor.isActive('bulletList') ? styles['toolbar-button-active'] : ''}`}
      >
        UL
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${styles['toolbar-button']} ${editor.isActive('orderedList') ? styles['toolbar-button-active'] : ''}`}
      >
        OL
      </button>
      <div className={styles['toolbar-divider']} />
      <button
        type="button"
        onClick={onVariableButtonClick}
        className={`${styles['toolbar-button']} ${styles['variable-button']}`}
        title="Insertar variable"
      >
        VAR
      </button>
    </div>
  )
}

export default RichTextEditor
