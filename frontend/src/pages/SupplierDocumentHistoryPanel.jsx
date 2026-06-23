import { useCallback, useEffect, useState } from 'react'
import { downloadSupplierDocumentPdf, fetchSupplierDocuments } from '../api/suppliersApi'
import { formatEsDateFromIso } from '../utils/dateUtils'

const DRAFT_STATUS_LABELS = {
  draft: 'Borrador',
  pending_signature: 'Pendiente firma',
  rejected: 'Rechazado'
}

function draftStatusLabel(status) {
  const key = String(status || '').trim()
  return DRAFT_STATUS_LABELS[key] || key || '—'
}

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * @param {{ supplierId: string | null | undefined: string | null }} props
 */
export function SupplierDocumentHistoryPanel({ supplierId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [signedDocuments, setSignedDocuments] = useState([])
  const [draftDocuments, setDraftDocuments] = useState([])
  const [loadingPdfId, setLoadingPdfId] = useState(null)
  const [pdfErrors, setPdfErrors] = useState(() => ({}))

  useEffect(() => {
    let active = true
    async function run() {
      if (!supplierId) {
        setLoading(false)
        setSignedDocuments([])
        setDraftDocuments([])
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchSupplierDocuments({ id: supplierId })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el historial de contratos.')
        setSignedDocuments([])
        setDraftDocuments([])
        return
      }
      setSignedDocuments(Array.isArray(res.data?.signed_documents) ? res.data.signed_documents : [])
      setDraftDocuments(Array.isArray(res.data?.draft_documents) ? res.data.draft_documents : [])
    }
    run()
    return () => {
      active = false
    }
  }, [supplierId])

  const clearRowPdfError = useCallback((id) => {
    setPdfErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [supplierId])

  const openPdf = useCallback(
    async (row) => {
      if (!supplierId || !row?.id) return
      setLoadingPdfId(row.id)
      clearRowPdfError(row.id)
      try {
        const blob = await downloadSupplierDocumentPdf({
          supplierId,
          documentId: row.id
        })
        openPdfBlob(blob)
      } catch (e) {
        setPdfErrors((prev) => ({
          ...prev,
          [row.id]: e instanceof Error ? e.message : 'No se pudo abrir el PDF.'
        }))
      } finally {
        setLoadingPdfId(null)
      }
    },
    [clearRowPdfError, supplierId]
  )

  if (loading) {
    return <div className="clause-list-loading">Cargando...</div>
  }

  if (error) {
    return <div className="clause-error">{error}</div>
  }

  return (
    <div className="supplier-document-history-wrap">
      <h3 className="clause-form-section-title">Contratos firmados</h3>
      {signedDocuments.length === 0 ? (
        <p className="clause-list-empty">No hay contratos firmados registrados.</p>
      ) : (
        <div className="clause-list-table-wrap">
          <table className="clause-list-table">
            <thead>
              <tr>
                <th>Plantilla</th>
                <th>Nombre de archivo</th>
                <th>Fecha firma</th>
                <th>Vigencia desde</th>
                <th>Vigencia hasta</th>
                <th className="clause-list-col-actions">Acción</th>
              </tr>
            </thead>
            <tbody>
              {signedDocuments.map((row) => {
                const busy = loadingPdfId === row.id
                return (
                  <tr key={row.id}>
                    <td>{row.template_name || '—'}</td>
                    <td>{row.file_name || '—'}</td>
                    <td>{row.signed_at ? formatEsDateFromIso(row.signed_at) : '—'}</td>
                    <td>{row.effective_from ? formatEsDateFromIso(row.effective_from) : '—'}</td>
                    <td>{row.effective_until ? formatEsDateFromIso(row.effective_until) : '—'}</td>
                    <td className="clause-list-col-actions">
                      <button type="button" className="btn" disabled={busy} onClick={() => void openPdf(row)}>
                        {busy ? '…' : 'Ver'}
                      </button>
                      {pdfErrors[row.id] ? <div className="clause-error">{pdfErrors[row.id]}</div> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="clause-form-section-title" style={{ marginTop: '16px' }}>
        Contratos en progreso
      </h3>
      {draftDocuments.length === 0 ? (
        <p className="clause-list-empty">No hay contratos en progreso.</p>
      ) : (
        <div className="clause-list-table-wrap">
          <table className="clause-list-table">
            <thead>
              <tr>
                <th>Plantilla</th>
                <th>Nombre de archivo</th>
                <th>Estado</th>
                <th>Fecha creación</th>
                <th className="clause-list-col-actions">Acción</th>
              </tr>
            </thead>
            <tbody>
              {draftDocuments.map((row) => {
                const busy = loadingPdfId === row.id
                return (
                  <tr key={row.id}>
                    <td>{row.template_name || '—'}</td>
                    <td>{row.file_name || '—'}</td>
                    <td>{draftStatusLabel(row.status)}</td>
                    <td>{row.created_at ? formatEsDateFromIso(row.created_at) : '—'}</td>
                    <td className="clause-list-col-actions">
                      <button type="button" className="btn" disabled={busy} onClick={() => void openPdf(row)}>
                        {busy ? '…' : 'Ver'}
                      </button>
                      {pdfErrors[row.id] ? <div className="clause-error">{pdfErrors[row.id]}</div> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
