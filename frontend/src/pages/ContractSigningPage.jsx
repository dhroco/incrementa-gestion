import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined'
import { PageShell } from '../components/PageShell'
import { SupplierTypeChip } from '../components/SupplierTypeChip'
import { fetchDraftPdfBlob, fetchPendingSignature, signContract } from '../api/contractSigningApi'
import { AbilityContext } from '../lib/ability'
import '../styles/shared-form.css'

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function formatCreatedAt(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)
}

export function ContractSigningPage() {
  const ability = useAbility(AbilityContext)
  const canSign = ability.can('sign', 'Contract')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loadingPdfId, setLoadingPdfId] = useState(null)
  const [signingId, setSigningId] = useState(null)
  const [pdfErrors, setPdfErrors] = useState(() => ({}))

  const [confirmRow, setConfirmRow] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const [modalError, setModalError] = useState(null)

  const loadItems = useCallback(async () => {
    if (!canSign) {
      setLoading(false)
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetchPendingSignature({})
    setLoading(false)
    if (!res.ok) {
      setError(res.message ?? 'No se pudo cargar el listado de contratos pendientes.')
      setItems([])
      return
    }
    setItems(Array.isArray(res.data?.items) ? res.data.items : [])
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const openPdf = useCallback(
    async (row) => {
      if (!row?.id) return
      setLoadingPdfId(row.id)
      setPdfErrors((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      try {
        const blob = await fetchDraftPdfBlob(row.id, {})
        openPdfBlob(blob)
      } catch (err) {
        setPdfErrors((prev) => ({
          ...prev,
          [row.id]: err instanceof Error ? err.message : 'No se pudo abrir el contrato.'
        }))
      } finally {
        setLoadingPdfId(null)
      }
    },
    []
  )

  const openConfirm = useCallback((row) => {
    setConfirmRow(row)
    setAuthorized(false)
    setModalError(null)
  }, [])

  const closeConfirm = useCallback(() => {
    if (signingId) return
    setConfirmRow(null)
    setAuthorized(false)
    setModalError(null)
  }, [signingId])

  const handleSign = useCallback(async () => {
    if (!confirmRow?.id || !authorized) return
    setSigningId(confirmRow.id)
    setModalError(null)
    const res = await signContract(confirmRow.id, {})
    setSigningId(null)
    if (!res.ok) {
      setModalError(res.message ?? 'No se pudo firmar el contrato.')
      return
    }
    const email = res.data?.companyEmail || confirmRow.company_email || 'la empresa'
    setItems((prev) => prev.filter((item) => item.id !== confirmRow.id))
    setConfirmRow(null)
    setAuthorized(false)
    setSuccess(`Contrato firmado. Email enviado a ${email}`)
    window.setTimeout(() => setSuccess(null), 8000)
  }, [])

  const breadcrumb = useMemo(() => (canSign ? [{ label: 'Firma de documento' }] : null), [canSign])

  return (
    <PageShell title="Firma de documento" breadcrumb={breadcrumb}>
      <div className="clause-list-page">
        {error ? <div className="clause-error">{error}</div> : null}
        {success ? <div className="clause-success">{success}</div> : null}

        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <div className="clause-list-table-wrap">
            <table className="clause-list-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Cliente</th>
                  <th>Empresa</th>
                  <th>Plantilla</th>
                  <th>Fecha contrato</th>
                  <th>Creado</th>
                  <th className="clause-list-col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="clause-list-empty">
                      No hay contratos pendientes de firma.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const pdfBusy = loadingPdfId === row.id
                    const signBusy = signingId === row.id
                    return (
                      <tr key={row.id}>
                        <td>
                          <span className="contracts-supplier-cell">
                            <span>{row.supplier_name || '—'}</span>
                            {row.supplier_type ? (
                              <SupplierTypeChip supplierType={row.supplier_type} />
                            ) : null}
                          </span>
                        </td>
                        <td>{row.client_name || '—'}</td>
                        <td>{row.company_short_name || '—'}</td>
                        <td>{row.template_name || '—'}</td>
                        <td>{row.fecha_contrato || '—'}</td>
                        <td>{formatCreatedAt(row.created_at)}</td>
                        <td className="clause-list-col-actions">
                          <div className="clause-list-actions-group">
                            <button
                              type="button"
                              className="clause-link-button"
                              disabled={pdfBusy || signBusy}
                              onClick={() => void openPdf(row)}
                            >
                              {pdfBusy ? 'Abriendo…' : 'Ver PDF'}
                            </button>
                            <button
                              type="button"
                              className="contracts-sign-chip-btn"
                              disabled={pdfBusy || signBusy}
                              onClick={() => openConfirm(row)}
                            >
                              <DrawOutlinedIcon sx={{ fontSize: 14 }} aria-hidden />
                              {signBusy ? 'Firmando…' : 'Firmar'}
                            </button>
                          </div>
                          {pdfErrors[row.id] ? (
                            <div className="clause-error">{pdfErrors[row.id]}</div>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmRow ? (
        <div
          className="gc-modal-overlay"
          role="presentation"
          onMouseDown={() => !signingId && closeConfirm()}
        >
          <div
            className="gc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="gc-modal__header">
              <div className="gc-modal__title" id="sign-confirm-title">
                Confirmar firma electrónica
              </div>
            </div>
            <div className="gc-modal__body">
              <dl className="contract-sign-confirm-dl">
                <div>
                  <dt>Proveedor</dt>
                  <dd>{confirmRow.supplier_name || '—'}</dd>
                </div>
                <div>
                  <dt>Cliente</dt>
                  <dd>{confirmRow.client_name || '—'}</dd>
                </div>
                <div>
                  <dt>Plantilla</dt>
                  <dd>{confirmRow.template_name || '—'}</dd>
                </div>
                <div>
                  <dt>Empresa</dt>
                  <dd>{confirmRow.company_short_name || '—'}</dd>
                </div>
              </dl>
              <p className="contract-sign-confirm-note">
                Al confirmar, usted firma este documento en representación de{' '}
                <strong>{confirmRow.company_name || confirmRow.company_short_name || 'la empresa'}</strong>{' '}
                y se enviará al correo{' '}
                <strong>{confirmRow.company_email || 'registrado de la empresa'}</strong>.
              </p>
              <label className="contract-sign-confirm-check">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                  disabled={Boolean(signingId)}
                />
                <span>He revisado el contrato y autorizo su firma electrónica</span>
              </label>
              {modalError ? <div className="clause-error">{modalError}</div> : null}
            </div>
            <div className="gc-modal__footer">
              <button type="button" className="btn" disabled={Boolean(signingId)} onClick={closeConfirm}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                disabled={!authorized || Boolean(signingId)}
                onClick={() => void handleSign()}
              >
                {signingId ? 'Firmando…' : 'Firmar y enviar email'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
