import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  destructive = false,
  anchorPoint = null,
  anchorOffset = { x: 12, y: 12 },
  onConfirm,
  onCancel
}) {
  const modalRef = useRef(null)
  const [anchoredPos, setAnchoredPos] = useState(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  const shouldAnchor =
    open &&
    anchorPoint &&
    typeof anchorPoint.x === 'number' &&
    typeof anchorPoint.y === 'number' &&
    Number.isFinite(anchorPoint.x) &&
    Number.isFinite(anchorPoint.y)

  useEffect(() => {
    if (!open || !shouldAnchor) {
      setAnchoredPos(null)
      return
    }

    let raf = 0
    raf = window.requestAnimationFrame(() => {
      const el = modalRef.current
      if (!el) return

      const margin = 12
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth || 0
      const vh = window.innerHeight || 0
      const ox = anchorOffset && typeof anchorOffset.x === 'number' ? anchorOffset.x : 12
      const oy = anchorOffset && typeof anchorOffset.y === 'number' ? anchorOffset.y : 12

      let left = anchorPoint.x + ox
      let top = anchorPoint.y + oy

      // Clamp to viewport (keep a small margin).
      left = Math.max(margin, Math.min(left, Math.max(margin, vw - rect.width - margin)))
      top = Math.max(margin, Math.min(top, Math.max(margin, vh - rect.height - margin)))

      setAnchoredPos((prev) => {
        if (prev && prev.left === left && prev.top === top) return prev
        return { left, top }
      })
    })

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [open, shouldAnchor, anchorPoint, anchorOffset])

  const overlayStyle = shouldAnchor
    ? {
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }
    : undefined

  const modalStyle =
    shouldAnchor && anchoredPos
      ? {
          position: 'fixed',
          left: `${anchoredPos.left}px`,
          top: `${anchoredPos.top}px`,
        }
      : undefined

  if (!open) return null

  return createPortal(
    <div className="gc-modal-overlay" style={overlayStyle} role="presentation" onMouseDown={() => onCancel?.()}>
      <div
        ref={modalRef}
        className="gc-modal"
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' && title.trim().length ? title : 'Confirmación'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="gc-modal__header">
          <div className="gc-modal__title">{title}</div>
        </div>
        {message ? <div className="gc-modal__body">{message}</div> : null}
        <div className="gc-modal__footer">
          <button type="button" className="clause-nav-button" onClick={() => onCancel?.()}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`clause-nav-button clause-nav-button--primary${destructive ? ' clause-nav-button--danger' : ''}`}
            onClick={() => onConfirm?.()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

