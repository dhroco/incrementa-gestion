import React, { useMemo, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { VariableNode } from './VariableNode'
import { EmbeddedUniversalClauseNode } from './EmbeddedUniversalClauseNode'
import VariableCatalog from './VariableCatalog'
import EmbeddedClauseCatalog from './EmbeddedClauseCatalog'
import EmbeddedClauseCatalogTabbed from './EmbeddedClauseCatalogTabbed'
import 'prosemirror-gapcursor/style/gapcursor.css'
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
  enableEmbeddedUniversalClauses = false,
  embeddedUniversalClausesOptions = [],
  enableEmbeddedCompanyClauses = false,
  embeddedCompanyClausesOptions = [],
  /** Empresa ancla para atributos `companyId` en nodos de cláusula por empresa */
  embeddedClauseCompanyId = null,
  /** Requerido para cargar el contenido completo de la cláusula al insertar el bloque incrustado */
  accessToken = null,
  /** `unified`: un botón y modal con pestañas (p. ej. templates por empresa). */
  clauseCatalogMode = 'split',
}) => {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [isClauseCatalogOpen, setIsClauseCatalogOpen] = useState(false)
  const [isCompanyClauseCatalogOpen, setIsCompanyClauseCatalogOpen] = useState(false)
  const [isUnifiedClauseCatalogOpen, setIsUnifiedClauseCatalogOpen] = useState(false)
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

  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        dropcursor: {
          color: '#657A8A',
          width: 2,
        },
        heading: {
          levels: [1, 2, 3],
        },
        pasteRules: [
          {
            find: /style="[^"]*"/g,
            replace: '',
          },
          {
            find: /class="[^"]*"/g,
            replace: '',
          },
        ],
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      VariableNode,
    ]
    if (enableEmbeddedUniversalClauses || enableEmbeddedCompanyClauses) {
      base.push(EmbeddedUniversalClauseNode.configure({ accessToken }))
    }
    return base
  }, [enableEmbeddedUniversalClauses, enableEmbeddedCompanyClauses, accessToken])

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
      // Tiptap Editor options: onPaste(clipboardEvent, slice) — not { event, editor }.
      onPaste: (event) => {
        if (readOnly) return
        if (!event || typeof event.preventDefault !== 'function') return
        event.preventDefault()
        if (!event.clipboardData) return
        const text = event.clipboardData.getData('text/plain')
        const ed = editorRef.current
        if (!text || !ed) return
        ed.chain().focus().insertContent(text).run()
      },
    },
    [readOnly, enableEmbeddedUniversalClauses, enableEmbeddedCompanyClauses]
  )

  const lastAppliedContentKeyRef = useRef('')
  React.useEffect(() => {
    if (!editor || !readOnly) return
    let nextKey = ''
    try {
      nextKey = typeof content === 'string' ? content : JSON.stringify(content ?? null)
    } catch {
      nextKey = String(content ?? '')
    }
    if (nextKey === lastAppliedContentKeyRef.current) return
    lastAppliedContentKeyRef.current = nextKey
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
  }, [editor, readOnly, content])

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

  const handleEmbeddedClauseSelect = async (row) => {
    if (readOnly || !editor || !row?.id) return
    editor
      .chain()
      .focus()
      .insertEmbeddedUniversalClause({
        clauseId: row.id,
        code: row.code ?? '',
        titleClause: row.title_clause ?? '',
        clauseKind: 'universal',
        companyId: null,
      })
      .run()
  }

  const handleEmbeddedCompanyClauseSelect = async (row) => {
    if (readOnly || !editor || !row?.id) return
    const cid =
      typeof embeddedClauseCompanyId === 'string' && embeddedClauseCompanyId.trim().length > 0
        ? embeddedClauseCompanyId.trim()
        : null
    if (!cid) return
    editor
      .chain()
      .focus()
      .insertEmbeddedUniversalClause({
        clauseId: row.id,
        code: row.code ?? '',
        titleClause: row.title_clause ?? '',
        clauseKind: 'company',
        companyId: cid,
      })
      .run()
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

  const hasCompanyClauseCompanyId =
    typeof embeddedClauseCompanyId === 'string' && embeddedClauseCompanyId.trim().length > 0
  const canUseCompanyClauses = enableEmbeddedCompanyClauses && hasCompanyClauseCompanyId
  const canUseUniversalClauses = enableEmbeddedUniversalClauses
  const useUnifiedClauseCatalog = !readOnly && clauseCatalogMode === 'unified'
  const showUnifiedClauseButton = useUnifiedClauseCatalog && (canUseCompanyClauses || canUseUniversalClauses)
  const onUnifiedClauseButtonClick = showUnifiedClauseButton ? () => setIsUnifiedClauseCatalogOpen(true) : null
  const onSplitUniversalClause = canUseUniversalClauses && !useUnifiedClauseCatalog ? () => setIsClauseCatalogOpen(true) : null
  const onSplitCompanyClause = canUseCompanyClauses && !useUnifiedClauseCatalog ? () => setIsCompanyClauseCatalogOpen(true) : null

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
        onUnifiedClauseButtonClick={onUnifiedClauseButtonClick}
        onClauseButtonClick={onSplitUniversalClause}
        onCompanyClauseButtonClick={onSplitCompanyClause}
        zoomState={zoomState}
      />
    ) : null
  const body =
    variant === 'document' ? (
      <div className={styles['document-zoom-viewport']}>
        <div className={styles['document-zoom-stage']} style={{ transform: `scale(${zoomState.value})` }}>
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
        <>
          <VariableCatalog
            isOpen={isCatalogOpen}
            onClose={() => setIsCatalogOpen(false)}
            onVariableSelect={handleVariableSelect}
          />
          {useUnifiedClauseCatalog && (canUseCompanyClauses || canUseUniversalClauses) ? (
            <EmbeddedClauseCatalogTabbed
              isOpen={isUnifiedClauseCatalogOpen}
              onClose={() => setIsUnifiedClauseCatalogOpen(false)}
              showCompanyTab={canUseCompanyClauses}
              showUniversalTab={canUseUniversalClauses}
              companyOptions={embeddedCompanyClausesOptions}
              universalOptions={embeddedUniversalClausesOptions}
              onSelectCompany={handleEmbeddedCompanyClauseSelect}
              onSelectUniversal={handleEmbeddedClauseSelect}
            />
          ) : null}
          {!useUnifiedClauseCatalog && enableEmbeddedUniversalClauses ? (
            <EmbeddedClauseCatalog
              isOpen={isClauseCatalogOpen}
              onClose={() => setIsClauseCatalogOpen(false)}
              options={embeddedUniversalClausesOptions}
              onSelect={handleEmbeddedClauseSelect}
            />
          ) : null}
          {!useUnifiedClauseCatalog && enableEmbeddedCompanyClauses && hasCompanyClauseCompanyId ? (
            <EmbeddedClauseCatalog
              isOpen={isCompanyClauseCatalogOpen}
              onClose={() => setIsCompanyClauseCatalogOpen(false)}
              options={embeddedCompanyClausesOptions}
              onSelect={handleEmbeddedCompanyClauseSelect}
              catalogTitle="Insertar cláusula por empresa"
              emptyMessage="No hay cláusulas por empresa disponibles para esta empresa."
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

const Toolbar = ({
  editor,
  variant,
  readOnly,
  documentTitle,
  onVariableButtonClick,
  onUnifiedClauseButtonClick,
  onClauseButtonClick,
  onCompanyClauseButtonClick,
  zoomState,
}) => {
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
            editor.isActive('bold'),
            () => editor.chain().focus().toggleBold().run(),
            'Negrita'
          )}
          {b(
            <span className={styles['toolbar-document-italic']}>I</span>,
            editor.isActive('italic'),
            () => editor.chain().focus().toggleItalic().run(),
            'Cursiva'
          )}
          {b(
            <span className={styles['toolbar-document-underline']}>U</span>,
            editor.isActive('underline'),
            () => editor.chain().focus().toggleUnderline().run(),
            'Subrayado'
          )}
          {b('S', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Tachado')}
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

          <button
            type="button"
            title="Insertar variables"
            onClick={onVariableButtonClick}
            className={`${styles['toolbar-document-button']} ${styles['toolbar-document-variable']}`}
          >
            Variables
          </button>
          {onUnifiedClauseButtonClick ? (
            <button
              type="button"
              title="Insertar cláusula (por empresa o universales)"
              onClick={onUnifiedClauseButtonClick}
              className={`${styles['toolbar-document-button']} ${styles['toolbar-document-variable']}`}
            >
              Cláusula
            </button>
          ) : null}
          {!onUnifiedClauseButtonClick && onClauseButtonClick ? (
            <button
              type="button"
              title="Insertar cláusula universal"
              onClick={onClauseButtonClick}
              className={`${styles['toolbar-document-button']} ${styles['toolbar-document-variable']}`}
            >
              {onCompanyClauseButtonClick ? 'Cláusula U.' : 'Cláusula'}
            </button>
          ) : null}
          {!onUnifiedClauseButtonClick && onCompanyClauseButtonClick ? (
            <button
              type="button"
              title="Insertar cláusula por empresa"
              onClick={onCompanyClauseButtonClick}
              className={`${styles['toolbar-document-button']} ${styles['toolbar-document-variable']}`}
            >
              Cláusula empresa
            </button>
          ) : null}
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
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${styles['toolbar-button']} ${editor.isActive('bold') ? styles['toolbar-button-active'] : ''}`}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${styles['toolbar-button']} ${editor.isActive('italic') ? styles['toolbar-button-active'] : ''}`}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`${styles['toolbar-button']} ${editor.isActive('underline') ? styles['toolbar-button-active'] : ''}`}
        title="Subrayado"
      >
        U
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
      {onUnifiedClauseButtonClick ? (
        <button
          type="button"
          onClick={onUnifiedClauseButtonClick}
          className={`${styles['toolbar-button']} ${styles['variable-button']}`}
          title="Insertar cláusula (por empresa o universales)"
        >
          CLA
        </button>
      ) : null}
      {!onUnifiedClauseButtonClick && onClauseButtonClick ? (
        <button
          type="button"
          onClick={onClauseButtonClick}
          className={`${styles['toolbar-button']} ${styles['variable-button']}`}
          title="Insertar cláusula universal"
        >
          {onCompanyClauseButtonClick ? 'CLA-U' : 'CLA'}
        </button>
      ) : null}
      {!onUnifiedClauseButtonClick && onCompanyClauseButtonClick ? (
        <button
          type="button"
          onClick={onCompanyClauseButtonClick}
          className={`${styles['toolbar-button']} ${styles['variable-button']}`}
          title="Insertar cláusula por empresa"
        >
          CLA-E
        </button>
      ) : null}
    </div>
  )
}

export default RichTextEditor
