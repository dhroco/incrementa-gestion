import React, { useEffect, useMemo, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { ConfirmDialog } from '../ConfirmDialog'
import { ReadOnlyDocPreview } from './ReadOnlyDocPreview'
import { resolveClauseContentReadBatched } from '../../api/clauseResolveReadBatcher'
import styles from './styles.module.css'

function parseClauseDocFromAttr(raw) {
  if (!raw) return null
  if (typeof raw === 'object' && raw !== null && raw.type === 'doc') return raw
  if (typeof raw === 'string') {
    try {
      const v1 = JSON.parse(raw)
      if (v1 && typeof v1 === 'object' && v1.type === 'doc') return v1
      // Some historical rows can be double-stringified: "\"{...}\""
      if (typeof v1 === 'string') {
        const v2 = JSON.parse(v1)
        return v2 && typeof v2 === 'object' && v2.type === 'doc' ? v2 : null
      }
      return null
    } catch {
      return null
    }
  }
  return null
}

export default function EmbeddedUniversalClauseRenderer({ node, editor, getPos, extension }) {
  const { clauseId, code, titleClause, clauseKind, companyId } = node.attrs
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAnchorPoint, setConfirmAnchorPoint] = useState(null)
  const [resolvedDoc, setResolvedDoc] = useState(null)
  const [resolveState, setResolveState] = useState({ status: 'idle', message: null })
  const [retryNonce, setRetryNonce] = useState(0)

  const accessToken = extension?.options?.accessToken ?? null
  const canEdit = Boolean(editor && editor.isEditable)

  useEffect(() => {
    let active = true
    async function run() {
      if (!clauseId || !accessToken) {
        setResolvedDoc(null)
        setResolveState({
          status: clauseId ? 'missing_token' : 'missing_id',
          message: clauseId
            ? 'No se pudo cargar la cláusula (falta sesión).'
            : 'No se pudo cargar la cláusula (referencia inválida).',
        })
        return
      }
      setResolveState({ status: 'loading', message: null })
      const kind = clauseKind === 'company' ? 'company' : 'universal'
      const res = await resolveClauseContentReadBatched({
        accessToken,
        clauseId,
        clauseKind: kind,
        companyId: kind === 'company' ? companyId : null,
      })
      if (!active) return
      if (!res?.ok) {
        const msg = res?.status === 403
          ? 'Sin acceso a la cláusula.'
          : res?.status === 404
            ? 'Cláusula no disponible.'
            : (res?.message ?? 'No se pudo cargar la cláusula.')
        setResolvedDoc(null)
        setResolveState({ status: 'error', message: msg })
        return
      }
      const doc = parseClauseDocFromAttr(res.content_json)
      if (!doc) {
        setResolvedDoc(null)
        setResolveState({ status: 'error', message: 'No se pudo interpretar el contenido de la cláusula.' })
        return
      }
      setResolvedDoc(doc)
      setResolveState({ status: 'ready', message: null })
    }
    run()
    return () => {
      active = false
    }
  }, [clauseId, accessToken, clauseKind, companyId, retryNonce])

  const headingLine = useMemo(() => {
    const c = typeof code === 'string' && code.trim().length > 0 ? code.trim() : '—'
    const t = typeof titleClause === 'string' && titleClause.trim().length > 0 ? titleClause.trim() : '—'
    return `CLÁUSULA VINCULADA: ${c} - ${t}`
  }, [code, titleClause])

  function replaceWithTemplateContent() {
    const pos = getPos()
    if (typeof pos !== 'number' || !editor) return
    const end = pos + node.nodeSize
    const blocks = resolvedDoc?.content && Array.isArray(resolvedDoc.content) ? resolvedDoc.content : null

    editor.chain().focus().deleteRange({ from: pos, to: end }).run()

    if (blocks && blocks.length > 0) {
      editor.chain().focus().insertContentAt(pos, blocks).run()
    } else {
      const fallback =
        typeof titleClause === 'string' && titleClause.trim().length > 0
          ? titleClause.trim()
          : String(code || ' ').trim() || ' '
      editor
        .chain()
        .focus()
        .insertContentAt(pos, {
          type: 'paragraph',
          content: [{ type: 'text', text: fallback }],
        })
        .run()
    }
  }

  function onKeyDownCapture(e) {
    if (!canEdit) return
    e.preventDefault()
    e.stopPropagation()
    setConfirmAnchorPoint(null)
    setConfirmOpen(true)
  }

  function openConfirmAtEvent(e) {
    if (!canEdit) return
    const pt =
      e && typeof e.clientX === 'number' && typeof e.clientY === 'number'
        ? { x: e.clientX, y: e.clientY }
        : null
    setConfirmAnchorPoint(pt)
    setConfirmOpen(true)
  }

  return (
    <NodeViewWrapper
      className={styles['embedded-clause-wrapper']}
      data-embedded-clause-id={clauseId}
      contentEditable={false}
      onKeyDownCapture={onKeyDownCapture}
    >
      <div
        className={styles['embedded-clause-block']}
        role="group"
        aria-label="Cláusula universal incrustada"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key.length === 1) {
            e.preventDefault()
            setConfirmOpen(true)
          }
        }}
      >
        <div className={styles['embedded-clause-block__heading']}>{headingLine}</div>
        {resolveState.status === 'loading' ? (
          <div className={styles['embedded-clause-block__missing']}>Cargando cláusula…</div>
        ) : resolvedDoc ? (
          <ReadOnlyDocPreview key={`${clauseId}-${node.attrs.instanceId}`} content={resolvedDoc} />
        ) : (
          <div className={styles['embedded-clause-block__missing']}>
            {resolveState.message ?? 'No se pudo cargar el contenido de la cláusula.'}
            {accessToken && resolveState.status === 'error' ? (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={styles['embedded-clause-block__action']}
                  onClick={() => {
                    setResolvedDoc(null)
                    setResolveState({ status: 'loading', message: null })
                    setRetryNonce((n) => n + 1)
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : null}
          </div>
        )}
        {canEdit ? (
          <button
            type="button"
            className={styles['embedded-clause-block__action']}
            onClick={(e) => openConfirmAtEvent(e)}
            disabled={!resolvedDoc}
          >
            Convertir a texto editable…
          </button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Editar como texto libre"
        message="Si continúa, se perderá el vínculo con la cláusula universal original. El texto y las variables se copiarán al template y podrá editarlos aquí."
        confirmText="Romper vínculo"
        cancelText="Cancelar"
        destructive
        anchorPoint={confirmAnchorPoint}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          replaceWithTemplateContent()
        }}
      />
    </NodeViewWrapper>
  )
}
