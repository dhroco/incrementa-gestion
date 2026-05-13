import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchInternalCompanyUserDetail, updateInternalCompanyUser } from '../api/internalCompanyUsersApi'
import { selectEnrichedCompany, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { selectSelectedCompanyId } from '../store/sessionCompanySlice'
import { formatRut, parseRut } from '../utils/rut'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidEmail(v) {
  if (!isNonEmptyString(v)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

const LIST_BASE = '/app/admin-global/usuarios-internos-empresa'

export function CompanyInternalUserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = useSelector(selectSession)
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)
  const accessToken = session?.access_token ?? null

  const companyId = useMemo(() => {
    const qCo = searchParams.get('companyId')
    if (profile?.code === 'CONTADOR') return selectedCompanyId
    if (profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR') return enrichedCompany?.id ?? null
    if (profile?.code === 'ADMINISTRADOR_PLATAFORMA') return qCo || null
    return null
  }, [profile?.code, selectedCompanyId, enrichedCompany?.id, searchParams])

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [rut, setRut] = useState('')
  const [isActive, setIsActive] = useState(true)

  const rutCheck = useMemo(() => (rut.trim() ? parseRut(rut) : { ok: true }), [rut])
  const canSubmit = useMemo(() => {
    return !!accessToken && !!id && !!companyId && isNonEmptyString(fullName) && isValidEmail(email) && rutCheck.ok
  }, [accessToken, id, companyId, fullName, email, rutCheck.ok])

  const listPath = useMemo(() => {
    if (profile?.code === 'ADMINISTRADOR_PLATAFORMA' && companyId) {
      return `${LIST_BASE}?companyId=${encodeURIComponent(companyId)}`
    }
    return LIST_BASE
  }, [companyId, profile?.code])

  useEffect(() => {
    let active = true
    async function run() {
      if (!accessToken || !id || !companyId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchInternalCompanyUserDetail({ id, companyId, accessToken })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el usuario.')
        return
      }
      const u = res.data?.user
      if (u) {
        setEmail(u.email ?? '')
        setFullName(u.full_name ?? '')
        setPhone(u.phone ?? '')
        setRut(u.rut_body ? formatRut(u.rut_body, u.rut_dv) : '')
        setIsActive(u.is_active !== false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [accessToken, id, companyId])

  const viewPath = useMemo(() => {
    return `${LIST_BASE}/${id}?companyId=${encodeURIComponent(companyId || '')}`
  }, [id, companyId])

  async function handleSave() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const payload = {
      email: email.trim(),
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      is_active: isActive,
      rut: rut.trim() || null
    }
    const res = await updateInternalCompanyUser(id, payload, { companyId, accessToken })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    navigate(viewPath)
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Usuarios internos empresa', to: listPath },
      { label: 'Editar' }
    ],
    [listPath]
  )

  return (
    <PageShell
      breadcrumb={breadcrumb}
      actions={
        <button type="button" className="clause-button" onClick={handleSave} disabled={!canSubmit || submitting || loading}>
          {submitting ? 'Guardando…' : 'Guardar cambios'}
        </button>
      }
      hideHeader
    >
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}
          {!companyId ? <div className="clause-error">No se pudo determinar la empresa.</div> : null}
          {loading ? (
            <div style={{ fontSize: '13px', color: '#000' }}>Cargando…</div>
          ) : companyId ? (
            <>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <label className="clause-field">
                    <span>Correo *</span>
                    <input className="clause-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                </div>
                <div className="clause-form-col">
                  <label className="clause-field">
                    <span>Nombre completo *</span>
                    <input className="clause-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <label className="clause-field">
                    <span>Teléfono</span>
                    <input className="clause-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </label>
                </div>
                <div className="clause-form-col">
                  <label className="clause-field">
                    <span>RUT</span>
                    <input className="clause-input" value={rut} onChange={(e) => setRut(e.target.value)} />
                    {!rutCheck.ok && rut.trim().length ? (
                      <span style={{ fontSize: '12px', color: '#000', opacity: 0.85 }}>{rutCheck.message}</span>
                    ) : null}
                  </label>
                </div>
              </div>
              <div className="clause-field clause-field--estado-inline" role="group" aria-label="Estado del usuario">
                <span className="clause-label clause-label--estado">Estado</span>
                <label className="clause-estado-activo">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <span>Activo</span>
                </label>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
