import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { createInternalCompanyUser } from '../api/internalCompanyUsersApi'
import { selectEnrichedCompany, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { selectSelectedCompanyId } from '../store/sessionCompanySlice'
import { parseRut } from '../utils/rut'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidEmail(v) {
  if (!isNonEmptyString(v)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

const LIST_BASE = '/app/admin-global/usuarios-internos-empresa'

export function CompanyInternalUserCreatePage() {
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

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [rut, setRut] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [tempPassword, setTempPassword] = useState(null)

  const rutCheck = useMemo(() => (rut.trim() ? parseRut(rut) : { ok: true }), [rut])
  const canSubmit = useMemo(() => {
    return !!accessToken && !!companyId && isValidEmail(email) && isNonEmptyString(fullName) && rutCheck.ok
  }, [accessToken, companyId, email, fullName, rutCheck.ok])

  const listPath = useMemo(() => {
    if (profile?.code === 'ADMINISTRADOR_PLATAFORMA' && companyId) {
      return `${LIST_BASE}?companyId=${encodeURIComponent(companyId)}`
    }
    return LIST_BASE
  }, [companyId, profile?.code])

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const payload = {
      email: email.trim(),
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      is_active: isActive
    }
    if (rut.trim()) payload.rut = rut.trim()
    const res = await createInternalCompanyUser(payload, { companyId, accessToken })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    const tp = res.data?.temporary_password
    if (typeof tp === 'string' && tp.length > 0) {
      setTempPassword(tp)
    } else {
      navigate(listPath)
    }
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Usuarios internos empresa', to: listPath },
      { label: 'Nuevo usuario' }
    ],
    [listPath]
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="clause-button" onClick={onSubmit} disabled={!canSubmit || submitting}>
        {submitting ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [canSubmit, onSubmit, submitting]
  )

  if (tempPassword) {
    return (
      <PageShell title="Usuario creado" hideHeader>
        <div className="ph-card clause-card" style={{ maxWidth: '520px' }}>
          <p style={{ margin: '0 0 8px' }}>
            El usuario fue creado correctamente. <strong>Guarde la contraseña temporal</strong>; no se volverá a mostrar.
          </p>
          <div
            style={{
              padding: '10px',
              border: '1px solid #E3E6E8',
              background: '#fff',
              fontFamily: 'monospace',
              marginBottom: '12px',
              wordBreak: 'break-all'
            }}
          >
            {tempPassword}
          </div>
          <button type="button" className="clause-button" onClick={() => navigate(listPath)}>
            Ir al listado
          </button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}
          {!companyId && profile?.code === 'ADMINISTRADOR_PLATAFORMA' ? (
            <div className="clause-error">Indique companyId en la URL (parámetro de consulta) para crear un usuario en esa empresa.</div>
          ) : null}
          {profile?.code === 'CONTADOR' && !selectedCompanyId ? (
            <div className="clause-error">Seleccione una empresa en la barra superior para crear usuarios internos.</div>
          ) : null}
          {companyId ? (
            <>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <label className="clause-field">
                    <span>Correo *</span>
                    <input className="clause-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
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
