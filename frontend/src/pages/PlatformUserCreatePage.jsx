import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { createPlatformUser } from '../api/platformUsersPlatformApi'
import { fetchCompaniesList } from '../api/companiesApi'
import { PLATFORM_USERS_LIST_PATH } from '../navigation/platformPaths'
import { selectEnrichedCompany, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { parseRut } from '../utils/rut'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidEmail(v) {
  if (!isNonEmptyString(v)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

const PROFILE_ADMIN = 'ADMINISTRADOR_PLATAFORMA'
const PROFILE_COMPANY = 'USUARIO_EMPRESA_ADMINISTRADOR'

export function PlatformUserCreatePage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const accessToken = session?.access_token ?? null

  const isCompanyAdmin = profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR'

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileCode, setProfileCode] = useState(PROFILE_ADMIN)
  const [companyId, setCompanyId] = useState('')
  const [companies, setCompanies] = useState([])
  const [rut, setRut] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [tempPassword, setTempPassword] = useState(null)

  const rutCheck = useMemo(() => (rut.trim() ? parseRut(rut) : { ok: true }), [rut])

  const canSubmit = useMemo(() => {
    if (!accessToken || !isValidEmail(email) || !isNonEmptyString(fullName) || !rutCheck.ok) return false
    if (isCompanyAdmin) {
      return Boolean(enrichedCompany?.id)
    }
    if (profileCode === PROFILE_COMPANY && !isNonEmptyString(companyId)) return false
    return true
  }, [accessToken, email, fullName, profileCode, companyId, isCompanyAdmin, enrichedCompany?.id, rutCheck.ok])

  useEffect(() => {
    if (isCompanyAdmin) {
      setProfileCode(PROFILE_COMPANY)
      if (enrichedCompany?.id) setCompanyId(enrichedCompany.id)
    }
  }, [isCompanyAdmin, enrichedCompany?.id])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!accessToken || isCompanyAdmin) return
      const res = await fetchCompaniesList({ q: '', accessToken })
      if (!active || !res.ok) return
      const list = res.data?.items
      setCompanies(Array.isArray(list) ? list : [])
    })()
    return () => {
      active = false
    }
  }, [accessToken, isCompanyAdmin])

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const effectiveProfile = isCompanyAdmin ? PROFILE_COMPANY : profileCode
    const payload = {
      email: email.trim(),
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      profile_code: effectiveProfile,
      is_active: isActive
    }
    if (rut.trim()) payload.rut = rut.trim()
    if (effectiveProfile === PROFILE_COMPANY) {
      payload.company_id = isCompanyAdmin ? enrichedCompany.id : companyId
    }
    const res = await createPlatformUser(payload, { accessToken })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    const tp = res.data?.temporary_password
    if (typeof tp === 'string' && tp.length > 0) {
      setTempPassword(tp)
    } else {
      navigate(PLATFORM_USERS_LIST_PATH)
    }
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Usuarios plataforma', to: PLATFORM_USERS_LIST_PATH },
      { label: 'Nuevo usuario' }
    ],
    []
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
          <button type="button" className="clause-button" onClick={() => navigate(PLATFORM_USERS_LIST_PATH)}>
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
          {isCompanyAdmin && !enrichedCompany?.id ? (
            <div className="clause-error">No se pudo determinar la empresa asociada a su perfil. No puede crear usuarios hasta que exista ese dato en la sesión.</div>
          ) : null}
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
          <div className="clause-form-row clause-form-row--two-equal">
            <div className="clause-form-col">
              <label className="clause-field">
                <span>Perfil *</span>
                {isCompanyAdmin ? (
                  <input
                    className="clause-input"
                    readOnly
                    value="Usuario empresa administrador"
                    title="Su perfil solo permite dar de alta otros usuarios empresa administrador de su empresa."
                  />
                ) : (
                  <select className="clause-input" value={profileCode} onChange={(e) => setProfileCode(e.target.value)}>
                    <option value={PROFILE_ADMIN}>Administrador de plataforma</option>
                    <option value={PROFILE_COMPANY}>Usuario empresa administrador</option>
                  </select>
                )}
              </label>
            </div>
            <div className="clause-form-col">
              <div className="clause-field clause-field--estado-inline" role="group" aria-label="Estado del usuario">
                <span className="clause-label clause-label--estado">Estado</span>
                <label className="clause-estado-activo">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <span>Activo</span>
                </label>
              </div>
            </div>
          </div>
          {isCompanyAdmin && enrichedCompany?.id ? (
            <label className="clause-field">
              <span>Empresa</span>
              <input className="clause-input" readOnly value={enrichedCompany.business_name ?? enrichedCompany.id} />
              <span className="clause-muted" style={{ display: 'block', marginTop: 6 }}>
                Los usuarios que cree quedarán asignados a esta empresa.
              </span>
            </label>
          ) : null}
          {!isCompanyAdmin && profileCode === PROFILE_COMPANY ? (
            <label className="clause-field">
              <span>Empresa *</span>
              <select className="clause-input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">Seleccione…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.business_name ?? c.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
