import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   message?: string,
 *   stayText?: string,
 *   discardText?: string,
 *   saveText?: string,
 *   saving?: boolean,
 *   onStay: () => void,
 *   onDiscard: () => void,
 *   onSave: () => void,
 * }} props
 */
export function UnsavedChangesDialog({
  open,
  title = 'Cambios sin guardar',
  message = 'Tiene cambios sin guardar. ¿Desea guardarlos antes de salir?',
  stayText = 'Cancelar',
  discardText = 'Salir sin guardar',
  saveText = 'Guardar',
  saving = false,
  onStay,
  onDiscard,
  onSave,
}) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape' && !saving) onStay?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onStay, saving])

  if (!open) return null

  return createPortal(
    <div className="gc-modal-overlay" role="presentation" onMouseDown={() => !saving && onStay?.()}>
      <div
        ref={modalRef}
        className="gc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="gc-modal__header">
          <div className="gc-modal__title">{title}</div>
        </div>
        {message ? <div className="gc-modal__body">{message}</div> : null}
        <div className="gc-modal__footer">
          <button type="button" className="btn" onClick={() => onStay?.()} disabled={saving}>
            {stayText}
          </button>
          <button type="button" className="btn btn--danger" onClick={() => onDiscard?.()} disabled={saving}>
            {discardText}
          </button>
          <button type="button" className="btn" onClick={() => onSave?.()} disabled={saving}>
            {saving ? 'Guardando…' : saveText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
