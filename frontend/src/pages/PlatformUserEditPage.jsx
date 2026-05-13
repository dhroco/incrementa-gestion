import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchPlatformUserDetail, updatePlatformUser } from '../api/platformUsersPlatformApi'
import { fetchCompaniesList } from '../api/companiesApi'
import { PLATFORM_USERS_LIST_PATH } from '../navigation/platformPaths'
import { selectEnrichedCompany, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { formatRut, parseRut } from '../utils/rut'
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

export function PlatformUserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const accessToken = session?.access_token ?? null

  const isCompanyAdmin = profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileCode, setProfileCode] = useState(PROFILE_ADMIN)
  const [companyId, setCompanyId] = useState('')
  const [companies, setCompanies] = useState([])
  const [isActive, setIsActive] = useState(true)
  const [rut, setRut] = useState('')
  const [submitting, setSubmitting] = useState(false)
  /** Empresa fija tras creación: no se puede cambiar en edición para USUARIO_EMPRESA_ADMINISTRADOR */
  const [companyLocked, setCompanyLocked] = useState(false)
  const [assignedCompanyLabel, setAssignedCompanyLabel] = useState('')

  const rutCheck = useMemo(() => (rut.trim() ? parseRut(rut) : { ok: true }), [rut])

  const canSubmit = useMemo(() => {
    if (!accessToken || !isNonEmptyString(fullName)) return false
    if (!isValidEmail(email)) return false
    if (!rutCheck.ok) return false
    if (profileCode === PROFILE_COMPANY && !companyLocked) {
      const cid = isCompanyAdmin ? enrichedCompany?.id || companyId : companyId
      if (!isNonEmptyString(cid)) return false
    }
    return true
  }, [accessToken, fullName, email, profileCode, companyId, companyLocked, isCompanyAdmin, enrichedCompany?.id, rutCheck.ok])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!accessToken || !id) return
      setLoading(true)
      setError(null)
      const [detailRes, companiesRes] = await Promise.all([
        fetchPlatformUserDetail(id, { accessToken }),
        isCompanyAdmin ? Promise.resolve({ ok: true, data: { items: [] } }) : fetchCompaniesList({ q: '', accessToken })
      ])
      if (!active) return
      if (!detailRes.ok) {
        setError(detailRes.message ?? 'No se pudo cargar el usuario.')
        setLoading(false)
        return
      }
      const companiesList = companiesRes.ok && Array.isArray(companiesRes.data?.items) ? companiesRes.data.items : []
      setCompanies(companiesList)
      const u = detailRes.data?.user
      const co = detailRes.data?.company
      if (u) {
        setEmail(u.email ?? '')
        setFullName(u.full_name ?? '')
        setPhone(u.phone ?? '')
        setProfileCode(u.profile_code === PROFILE_COMPANY ? PROFILE_COMPANY : PROFILE_ADMIN)
        setIsActive(u.is_active !== false)
        setRut(u.rut_body ? formatRut(u.rut_body, u.rut_dv) : '')
      }
      setCompanyId(co?.id ?? '')
      setAssignedCompanyLabel(co?.business_name ?? '')
      setCompanyLocked(!!co?.id)
      if (isCompanyAdmin && !co?.id && enrichedCompany?.id) {
        setCompanyId(enrichedCompany.id)
        setAssignedCompanyLabel(enrichedCompany.business_name ?? '')
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [accessToken, id, isCompanyAdmin, enrichedCompany?.id, enrichedCompany?.business_name])

  async function onSubmit() {
    if (!canSubmit || !id) return
    setSubmitting(true)
    setError(null)
    const effectiveProfile = isCompanyAdmin ? PROFILE_COMPANY : profileCode
    const payload = {
      email: email.trim(),
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      profile_code: effectiveProfile,
      is_active: isActive,
      rut: rut.trim() || null
    }
    if (effectiveProfile === PROFILE_COMPANY && !companyLocked) {
      payload.company_id = isCompanyAdmin ? enrichedCompany?.id ?? companyId : companyId
    }
    const res = await updatePlatformUser(id, payload, { accessToken })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    navigate(PLATFORM_USERS_LIST_PATH)
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Usuarios plataforma', to: PLATFORM_USERS_LIST_PATH },
      { label: 'Editar' }
    ],
    []
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="clause-button" onClick={onSubmit} disabled={!canSubmit || submitting || loading}>
        {submitting ? 'Guardando…' : 'Guardar cambios'}
      </button>
    ),
    [canSubmit, loading, onSubmit, submitting]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <div className="ph-card clause-card">
        {loading ? <p className="clause-muted">Cargando…</p> : null}
        {!loading ? (
          <div className="clause-form">
            {error ? <div className="clause-error">{error}</div> : null}
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
            <div className="clause-form-row clause-form-row--two-equal">
              <div className="clause-form-col">
                <label className="clause-field">
                  <span>Perfil *</span>
                  {isCompanyAdmin ? (
                    <input
                      className="clause-input"
                      readOnly
                      value="Usuario empresa administrador"
                      title="Solo puede gestionar usuarios con este perfil en su empresa."
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
            {profileCode === PROFILE_COMPANY && companyLocked ? (
              <label className="clause-field">
                <span>Empresa asignada</span>
                <input
                  className="clause-input"
                  readOnly
                  value={
                    assignedCompanyLabel ||
                    companies.find((c) => c.id === companyId)?.business_name ||
                    companyId ||
                    ''
                  }
                  title="La empresa no se puede cambiar tras la creación del usuario."
                />
                <span className="clause-muted" style={{ display: 'block', marginTop: 6 }}>
                  La empresa asignada no se puede modificar en la edición.
                </span>
              </label>
            ) : null}
            {profileCode === PROFILE_COMPANY && !companyLocked ? (
              isCompanyAdmin ? (
                <label className="clause-field">
                  <span>Empresa</span>
                  <input
                    className="clause-input"
                    readOnly
                    value={enrichedCompany?.business_name ?? enrichedCompany?.id ?? ''}
                  />
                  <span className="clause-muted" style={{ display: 'block', marginTop: 6 }}>
                    El usuario quedará vinculado a su empresa.
                  </span>
                </label>
              ) : (
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
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
