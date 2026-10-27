import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAbility } from '@casl/react'
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined'
import { PageShell } from '../components/PageShell'
import { RutInput } from '../components/RutInput'
import { SupplierTypeChip } from '../components/SupplierTypeChip'
import {
  fetchDraftPdfBlob,
  fetchInSignature,
  fetchPendingSignature,
  refreshSignature,
  resendSignatureLink,
  sendToFirme,
  signContract
} from '../api/contractSigningApi'
import { AbilityContext } from '../lib/ability'
import { formatRutDisplay, parseRut } from '../utils/rut'
import '../styles/shared-form.css'

const LOW_CREDITS_WARNING = 10
const SUCCESS_MS = 8000

const STATUS_LABEL = {
  pending_signature: 'En proceso de firma',
  sending: 'Enviando a firma…',
  rejected: 'Firma rechazada',
  expired: 'Firma vencida',
  cancelled: 'Firma cancelada',
  send_failed: 'Envío fallido',
  hash_mismatch: 'Requiere revisión'
}

function isEmail(value) {
  if (typeof value !== 'string' || /\s/.test(value)) return false
  const parts = value.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return Boolean(local && domain && domain.includes('.'))
}

function emptySignee() {
  return {
    firstName: '',
    lastName: '',
    maternalLastName: '',
    documentNumber: '',
    email: ''
  }
}

function signeeFromSuggestion(suggestion) {
  const source = suggestion || {}
  return {
    firstName: source.first_names || '',
    lastName: source.last_name || '',
    maternalLastName: source.maternal_last_name || '',
    documentNumber: formatRutDisplay(source.document_number, { empty: '' }),
    email: source.email || ''
  }
}

function signeeFromAttempt(row) {
  return {
    firstName: row.signee_first_name || '',
    lastName: row.signee_last_name || '',
    maternalLastName: row.signee_maternal_last_name || '',
    documentNumber: formatRutDisplay(row.signee_rut, { empty: '' }),
    email: row.signee_email || ''
  }
}

function validateSignee(signee) {
  if (!signee.firstName.trim()) return 'El campo nombres del firmante está incompleto.'
  if (!signee.lastName.trim()) return 'El campo apellido paterno del firmante está incompleto.'
  if (!signee.email.trim() || !isEmail(signee.email.trim())) {
    return 'El campo correo del firmante está incompleto.'
  }
  if (!parseRut(signee.documentNumber).ok) return 'El RUT del firmante no es válido.'
  return null
}

function signeePayload(signee) {
  return {
    firstName: signee.firstName.trim(),
    lastName: signee.lastName.trim(),
    maternalLastName: signee.maternalLastName.trim(),
    documentNumber: signee.documentNumber.trim(),
    email: signee.email.trim()
  }
}

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

function firmanteName(row) {
  const parts = [row.signee_first_name, row.signee_last_name, row.signee_maternal_last_name]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part && part !== '.')
  return parts.join(' ') || '—'
}

function signatureActions(status) {
  return {
    refresh: status !== 'sending',
    resendLink: status === 'pending_signature',
    renewLink: status === 'expired',
    resendToFirme: status === 'rejected' || status === 'cancelled' || status === 'send_failed'
  }
}

export function ContractSigningPage() {
  const ability = useAbility(AbilityContext)
  const canSign = ability.can('sign', 'Contract')

  const [tab, setTab] = useState('approve')
  const [items, setItems] = useState([])
  const [inSignatureItems, setInSignatureItems] = useState([])
  const [credits, setCredits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loadingPdfId, setLoadingPdfId] = useState(null)
  const [signingId, setSigningId] = useState(null)
  const [actionKey, setActionKey] = useState(null)
  const [pdfErrors, setPdfErrors] = useState(() => ({}))
  const [rowErrors, setRowErrors] = useState(() => ({}))

  const [confirmRow, setConfirmRow] = useState(null)
  const [confirmKind, setConfirmKind] = useState(null)
  const [warnNewCredit, setWarnNewCredit] = useState(false)
  const [signee, setSignee] = useState(emptySignee)
  const [authorized, setAuthorized] = useState(false)
  const [modalError, setModalError] = useState(null)
  const successTimer = useRef(null)

  const showSuccess = useCallback((message) => {
    setSuccess(message)
    if (successTimer.current) window.clearTimeout(successTimer.current)
    successTimer.current = window.setTimeout(() => setSuccess(null), SUCCESS_MS)
  }, [])

  useEffect(() => () => {
    if (successTimer.current) window.clearTimeout(successTimer.current)
  }, [])

  const loadPending = useCallback(async () => {
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
  }, [canSign])

  const loadInSignature = useCallback(async ({ quiet } = {}) => {
    if (!canSign) {
      setLoading(false)
      setInSignatureItems([])
      setCredits(null)
      return
    }
    if (!quiet) {
      setLoading(true)
      setError(null)
    }
    const res = await fetchInSignature({})
    if (!quiet) setLoading(false)
    if (!res.ok) {
      setError(res.message ?? 'No se pudo cargar los contratos en firma.')
      if (!quiet) setInSignatureItems([])
      return
    }
    setInSignatureItems(Array.isArray(res.data?.items) ? res.data.items : [])
    const rawCredits = res.meta?.credits
    setCredits(rawCredits == null || !Number.isFinite(Number(rawCredits)) ? null : Number(rawCredits))
    setRowErrors({})
  }, [canSign])

  useEffect(() => {
    if (tab === 'approve') void loadPending()
    else void loadInSignature()
  }, [tab, loadPending, loadInSignature])

  const openPdf = useCallback(async (row) => {
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
  }, [])

  const closeConfirm = useCallback(() => {
    if (signingId) return
    setConfirmRow(null)
    setConfirmKind(null)
    setWarnNewCredit(false)
    setSignee(emptySignee())
    setAuthorized(false)
    setModalError(null)
  }, [signingId])

  const openInternal = useCallback((row) => {
    setConfirmRow(row)
    setConfirmKind('internal')
    setWarnNewCredit(false)
    setAuthorized(false)
    setModalError(null)
  }, [])

  const openFirme = useCallback((row, { newCredit, fromAttempt } = {}) => {
    setConfirmRow(row)
    setConfirmKind('firme')
    setWarnNewCredit(Boolean(newCredit))
    setSignee(fromAttempt ? signeeFromAttempt(row) : signeeFromSuggestion(row.signee_suggestion))
    setAuthorized(false)
    setModalError(null)
  }, [])

  const handleSign = useCallback(async () => {
    if (!confirmRow?.id || !authorized || confirmKind !== 'internal') return
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
    setConfirmKind(null)
    setAuthorized(false)
    showSuccess(`Contrato firmado. Email enviado a ${email}`)
  }, [confirmRow, authorized, confirmKind, showSuccess])

  const handleSendToFirme = useCallback(async () => {
    if (!confirmRow?.id || !authorized || confirmKind !== 'firme') return
    const problem = validateSignee(signee)
    if (problem) {
      setModalError(problem)
      return
    }
    setSigningId(confirmRow.id)
    setModalError(null)
    const res = await sendToFirme(confirmRow.id, signeePayload(signee), {})
    setSigningId(null)
    if (!res.ok) {
      setModalError(res.message ?? 'No se pudo enviar el contrato a firma.')
      return
    }
    const sentId = confirmRow.id
    setItems((prev) => prev.filter((item) => item.id !== sentId))
    setInSignatureItems((prev) => prev.filter((item) => item.id !== sentId))
    setConfirmRow(null)
    setConfirmKind(null)
    setWarnNewCredit(false)
    setSignee(emptySignee())
    setAuthorized(false)
    showSuccess('Contrato en proceso de firma.')
  }, [confirmRow, authorized, confirmKind, signee, showSuccess])

  const handleRefresh = useCallback(async (row) => {
    if (!row?.id) return
    setActionKey(`${row.id}:refresh`)
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    const res = await refreshSignature(row.id, {})
    setActionKey(null)
    if (!res.ok) {
      setRowErrors((prev) => ({
        ...prev,
        [row.id]: res.message ?? 'No se pudo actualizar el estado de firma.'
      }))
      return
    }
    if (res.data?.status === 'signed') {
      setInSignatureItems((prev) => prev.filter((item) => item.id !== row.id))
      showSuccess('Contrato firmado.')
      return
    }
    await loadInSignature({ quiet: true })
  }, [loadInSignature, showSuccess])

  const handleResendLink = useCallback(async (row) => {
    if (!row?.id) return
    setActionKey(`${row.id}:link`)
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    const res = await resendSignatureLink(row.id, {})
    setActionKey(null)
    if (!res.ok) {
      setRowErrors((prev) => ({
        ...prev,
        [row.id]: res.message ?? 'No se pudo reenviar el enlace de firma.'
      }))
      return
    }
    await loadInSignature({ quiet: true })
  }, [loadInSignature])

  const updateSignee = useCallback((field, value) => {
    setSignee((prev) => ({ ...prev, [field]: value }))
  }, [])

  const breadcrumb = useMemo(() => (canSign ? [{ label: 'Firma de documento' }] : null), [canSign])
  const companyLabel = confirmRow?.company_name || confirmRow?.company_short_name || 'la empresa'
  const lowCredits = credits != null && credits <= LOW_CREDITS_WARNING
  const modalBusy = Boolean(signingId)

  return (
    <PageShell title="Firma de documento" breadcrumb={breadcrumb}>
      <div className="clause-list-page">
        <div className="company-form-tabs-layout">
          <div className="company-shell-tabs">
            <div className="company-shell-tabs-bar" role="tablist" aria-label="Firma de documento">
              <button
                type="button"
                role="tab"
                className="company-shell-tab"
                aria-selected={tab === 'approve'}
                onClick={() => setTab('approve')}
              >
                Por aprobar
              </button>
              <button
                type="button"
                role="tab"
                className="company-shell-tab"
                aria-selected={tab === 'in_signature'}
                onClick={() => setTab('in_signature')}
              >
                En firma
              </button>
            </div>
            <div className="company-shell-tabs-panel">
              {error ? <div className="clause-error">{error}</div> : null}
              {success ? <div className="clause-success">{success}</div> : null}

              {tab === 'in_signature' && credits != null ? (
                <p className="contract-sign-confirm-note">Créditos de firma disponibles: {credits}</p>
              ) : null}
              {tab === 'in_signature' && lowCredits ? (
                <p className="contract-sign-confirm-note">Saldo bajo de créditos de firma.</p>
              ) : null}

              {loading ? (
                <div className="clause-list-loading">Cargando…</div>
              ) : tab === 'approve' ? (
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
                          const mode = row.signing_mode || 'internal'
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
                                    disabled={pdfBusy}
                                    onClick={() => void openPdf(row)}
                                  >
                                    {pdfBusy ? 'Abriendo…' : 'Ver PDF'}
                                  </button>
                                  {mode === 'blocked' ? (
                                    <button type="button" className="contracts-sign-chip-btn" disabled>
                                      Firma deshabilitada: Firme aún no está configurado en producción.
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="contracts-sign-chip-btn"
                                      disabled={pdfBusy || signBusy}
                                      onClick={() => (mode === 'firme' ? openFirme(row) : openInternal(row))}
                                    >
                                      <DrawOutlinedIcon sx={{ fontSize: 14 }} aria-hidden />
                                      {signBusy ? 'Firmando…' : 'Firmar'}
                                    </button>
                                  )}
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
              ) : (
                <div className="clause-list-table-wrap">
                  <table className="clause-list-table">
                    <thead>
                      <tr>
                        <th>Proveedor</th>
                        <th>Firmante</th>
                        <th>Enviado el</th>
                        <th>Estado</th>
                        <th className="clause-list-col-actions">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inSignatureItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="clause-list-empty">
                            No hay contratos en proceso de firma.
                          </td>
                        </tr>
                      ) : (
                        inSignatureItems.map((row) => {
                          const actions = signatureActions(row.status)
                          const pdfBusy = loadingPdfId === row.id
                          const refreshing = actionKey === `${row.id}:refresh`
                          const linking = actionKey === `${row.id}:link`
                          return (
                            <tr key={row.id}>
                              <td>{row.supplier_name || '—'}</td>
                              <td>
                                <div>{firmanteName(row)}</div>
                                {row.signee_email ? <div>{row.signee_email}</div> : null}
                              </td>
                              <td>{formatCreatedAt(row.approved_at)}</td>
                              <td>
                                <span className="contracts-status-badge contracts-status-badge--draft">
                                  {STATUS_LABEL[row.status] || row.status || '—'}
                                </span>
                                {row.last_error_message ? (
                                  <div className="clause-error">{row.last_error_message}</div>
                                ) : null}
                                {row.status === 'rejected' && row.rejection_reason ? (
                                  <div>{row.rejection_reason}</div>
                                ) : null}
                              </td>
                              <td className="clause-list-col-actions">
                                <div className="clause-list-actions-group">
                                  {actions.refresh ? (
                                    <button
                                      type="button"
                                      className="clause-link-button"
                                      disabled={refreshing || linking}
                                      onClick={() => void handleRefresh(row)}
                                    >
                                      Actualizar estado
                                    </button>
                                  ) : null}
                                  {actions.resendLink ? (
                                    <button
                                      type="button"
                                      className="clause-link-button"
                                      disabled={refreshing || linking}
                                      onClick={() => void handleResendLink(row)}
                                    >
                                      Reenviar enlace
                                    </button>
                                  ) : null}
                                  {actions.renewLink ? (
                                    <button
                                      type="button"
                                      className="clause-link-button"
                                      disabled={refreshing || linking}
                                      onClick={() => void handleResendLink(row)}
                                    >
                                      Renovar enlace
                                    </button>
                                  ) : null}
                                  {actions.resendToFirme ? (
                                    <button
                                      type="button"
                                      className="clause-link-button"
                                      disabled={refreshing || linking}
                                      onClick={() => openFirme(row, { newCredit: true, fromAttempt: true })}
                                    >
                                      Reenviar a firma
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="clause-link-button"
                                    disabled={pdfBusy}
                                    onClick={() => void openPdf(row)}
                                  >
                                    {pdfBusy ? 'Abriendo…' : 'Ver PDF'}
                                  </button>
                                </div>
                                {rowErrors[row.id] ? <div className="clause-error">{rowErrors[row.id]}</div> : null}
                                {pdfErrors[row.id] ? <div className="clause-error">{pdfErrors[row.id]}</div> : null}
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
          </div>
        </div>
      </div>

      {confirmRow && confirmKind === 'internal' ? (
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
                  disabled={modalBusy}
                />
                <span>He revisado el contrato y autorizo su firma electrónica</span>
              </label>
              {modalError ? <div className="clause-error">{modalError}</div> : null}
            </div>
            <div className="gc-modal__footer">
              <button type="button" className="btn" disabled={modalBusy} onClick={closeConfirm}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                disabled={!authorized || modalBusy}
                onClick={() => void handleSign()}
              >
                {modalBusy ? 'Firmando…' : 'Firmar y enviar email'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRow && confirmKind === 'firme' ? (
        <div
          className="gc-modal-overlay"
          role="presentation"
          onMouseDown={() => !signingId && closeConfirm()}
        >
          <div
            className="gc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="firme-confirm-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="gc-modal__header">
              <div className="gc-modal__title" id="firme-confirm-title">
                Aprobar y enviar a firma
              </div>
            </div>
            <div className="gc-modal__body">
              {warnNewCredit ? (
                <p className="contract-sign-confirm-note">Esto usará 1 crédito nuevo de firma.</p>
              ) : null}
              <div className="clause-form">
                <label className="clause-field">
                  <span>Nombres</span>
                  <input
                    className="clause-input"
                    value={signee.firstName}
                    onChange={(e) => updateSignee('firstName', e.target.value)}
                    disabled={modalBusy}
                  />
                </label>
                <label className="clause-field">
                  <span>Apellido paterno</span>
                  <input
                    className="clause-input"
                    value={signee.lastName}
                    onChange={(e) => updateSignee('lastName', e.target.value)}
                    disabled={modalBusy}
                  />
                </label>
                <label className="clause-field">
                  <span>Apellido materno</span>
                  <input
                    className="clause-input"
                    value={signee.maternalLastName}
                    onChange={(e) => updateSignee('maternalLastName', e.target.value)}
                    disabled={modalBusy}
                  />
                </label>
                <label className="clause-field">
                  <span>RUT</span>
                  <RutInput
                    value={signee.documentNumber}
                    onChange={(value) => updateSignee('documentNumber', value)}
                    disabled={modalBusy}
                  />
                </label>
                <label className="clause-field">
                  <span>Correo</span>
                  <input
                    className="clause-input"
                    type="email"
                    value={signee.email}
                    onChange={(e) => updateSignee('email', e.target.value)}
                    disabled={modalBusy}
                  />
                </label>
              </div>
              <p className="contract-sign-confirm-note">
                Al confirmar, usted aprueba este contrato en representación de{' '}
                <strong>{companyLabel}</strong>; su rúbrica quedará estampada y se enviará a{' '}
                <strong>{signee.email.trim() || 'el correo indicado'}</strong> para su firma electrónica.
              </p>
              <label className="contract-sign-confirm-check">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                  disabled={modalBusy}
                />
                <span>He revisado el contrato y autorizo su envío a firma</span>
              </label>
              {modalError ? <div className="clause-error">{modalError}</div> : null}
            </div>
            <div className="gc-modal__footer">
              <button type="button" className="btn" disabled={modalBusy} onClick={closeConfirm}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                disabled={!authorized || modalBusy}
                onClick={() => void handleSendToFirme()}
              >
                {modalBusy ? 'Enviando…' : 'Aprobar y enviar a firma'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
