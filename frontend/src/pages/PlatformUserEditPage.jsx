import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import {
  fetchPlatformUserDetail,
  fetchPlatformUserRoleOptions,
  updatePlatformUser
} from '../api/platformUsersPlatformApi'
import { PLATFORM_USERS_LIST_PATH } from '../navigation/platformPaths'
import '../styles/shared-form.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidEmail(v) {
  if (!isNonEmptyString(v)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function PlatformUserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [profileCode, setProfileCode] = useState('')
  const [roles, setRoles] = useState([])
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    return isValidEmail(email) && isNonEmptyString(profileCode)
  }, [email, profileCode])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      const [detailRes, rolesRes] = await Promise.all([
        fetchPlatformUserDetail(id, {}),
        fetchPlatformUserRoleOptions({})
      ])
      if (!active) return
      if (!detailRes.ok) {
        setError(detailRes.message ?? 'No se pudo cargar el usuario.')
        setLoading(false)
        return
      }
      const u = detailRes.data?.user
      if (u) {
        setEmail(u.email ?? '')
        setProfileCode(u.profile_code ?? '')
        setIsActive(u.is_active !== false)
      }
      if (rolesRes.ok) {
        setRoles(Array.isArray(rolesRes.data?.items) ? rolesRes.data.items : [])
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  async function onSubmit() {
    if (!canSubmit || !id) return
    setSubmitting(true)
    setError(null)
    const payload = {
      email: email.trim(),
      profile_code: profileCode.trim(),
      is_active: isActive
    }
    const res = await updatePlatformUser(id, payload, {})
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    navigate(PLATFORM_USERS_LIST_PATH)
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Usuarios', to: PLATFORM_USERS_LIST_PATH },
      { label: 'Editar' }
    ],
    []
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="btn" onClick={onSubmit} disabled={!canSubmit || submitting || loading}>
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
                  <span>Rol *</span>
                  <select className="clause-input" value={profileCode} onChange={(e) => setProfileCode(e.target.value)}>
                    <option value="">Seleccione un rol</option>
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.label ?? role.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="clause-form-row">
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
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
