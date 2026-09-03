import { useEffect, useRef, useState } from 'react'
import { deleteLegalRepSignature, uploadLegalRepSignature } from '../api/legalRepSignatureApi'

const MAX_SIGNATURE_BYTES = 500 * 1024

/**
 * @param {{
 *   companyId: string,
 *   repIndex: 1 | 2,
 *   signatureUrl?: string | null,
 *   canMutate?: boolean,
 *   onSignatureChange?: (next: { rep_index: number, url: string } | null) => void,
 * }} props
 */
export function LegalRepSignatureField({
  companyId,
  repIndex,
  signatureUrl = null,
  canMutate = false,
  onSignatureChange,
}) {
  const fileInputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const displayUrl = previewUrl ?? signatureUrl ?? null
  const hasSignature = Boolean(displayUrl)
  const busy = uploading || deleting

  async function onFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !companyId || !canMutate) return

    setError(null)

    if (file.size > MAX_SIGNATURE_BYTES) {
      setError('La imagen no puede superar 500 KB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      return objectUrl
    })
    setUploading(true)

    const res = await uploadLegalRepSignature(companyId, repIndex, file, {})
    setUploading(false)

    if (!res.ok) {
      setError(res.message || 'No se pudo subir la firma.')
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    const url = res.data && typeof res.data.url === 'string' ? res.data.url : null
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    if (url && onSignatureChange) {
      onSignatureChange({ rep_index: repIndex, url })
    }
  }

  async function onDelete() {
    if (!companyId || !canMutate || !hasSignature) return
    setError(null)
    setDeleting(true)

    const res = await deleteLegalRepSignature(companyId, repIndex, {})
    setDeleting(false)

    if (!res.ok) {
      setError(res.message || 'No se pudo eliminar la firma.')
      return
    }

    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    if (onSignatureChange) onSignatureChange(null)
  }

  return (
    <div className="legal-rep-signature-field">
      <div className="clause-label">Firma escrita</div>
      <p className="legal-rep-signature-field__hint">PNG con fondo transparente, máximo 500 KB.</p>

      {displayUrl ? (
        <div className="legal-rep-signature-field__preview-wrap">
          <img
            src={displayUrl}
            alt={`Vista previa firma representante ${repIndex}`}
            className="legal-rep-signature-field__preview"
          />
        </div>
      ) : (
        <div className="legal-rep-signature-field__empty">Sin firma registrada.</div>
      )}

      {error ? <div className="legal-rep-signature-field__error">{error}</div> : null}

      {canMutate ? (
        <div className="legal-rep-signature-field__actions">
          <button
            type="button"
            className="btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {uploading ? 'Subiendo…' : hasSignature ? 'Reemplazar' : 'Subir firma'}
          </button>
          {hasSignature ? (
            <button type="button" className="btn btn--danger" onClick={onDelete} disabled={busy}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            className="legal-rep-signature-field__file-input"
            onChange={onFileSelected}
            tabIndex={-1}
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  )
}
