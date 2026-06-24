import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { createPlatformUser, fetchPlatformUserRoleOptions } from '../api/platformUsersPlatformApi'
import { PLATFORM_USERS_LIST_PATH } from '../navigation/platformPaths'
import '../styles/shared-form.css'

const IDP_NOT_FOUND_MSG =
  'Este email no está registrado en el directorio de Microsoft Entra. El administrador debe crear el usuario en el tenant primero.'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidEmail(v) {
  if (!isNonEmptyString(v)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function PlatformUserCreatePage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [profileCode, setProfileCode] = useState('')
  const [roles, setRoles] = useState([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function loadRoles() {
      setRolesLoading(true)
      const res = await fetchPlatformUserRoleOptions({})
      if (!active) return
      setRolesLoading(false)
      if (!res.ok) {
        setRoles([])
        return
      }
      const items = Array.isArray(res.data?.items) ? res.data.items : []
      setRoles(items)
      if (items.length === 1) {
        setProfileCode(items[0].code ?? '')
      }
    }
    loadRoles()
    return () => {
      active = false
    }
  }, [])

  const canSubmit = useMemo(() => {
    return isValidEmail(email) && isNonEmptyString(profileCode)
  }, [email, profileCode])

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const payload = {
      email: email.trim(),
      profile_code: profileCode.trim(),
      is_active: isActive
    }
    const res = await createPlatformUser(payload, {})
    setSubmitting(false)
    if (!res.ok) {
      if (res.code === 'IDP_USER_NOT_FOUND') {
        setError(IDP_NOT_FOUND_MSG)
      } else {
        setError(res.message)
      }
      return
    }
    navigate(PLATFORM_USERS_LIST_PATH, { state: { createdMessage: 'Usuario registrado correctamente.' } })
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Usuarios', to: PLATFORM_USERS_LIST_PATH },
      { label: 'Nuevo usuario' }
    ],
    []
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="btn" onClick={onSubmit} disabled={!canSubmit || submitting || rolesLoading}>
        {submitting ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [canSubmit, onSubmit, rolesLoading, submitting]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}
          <div className="clause-form-row clause-form-row--two-equal">
            <div className="clause-form-col">
              <label className="clause-field">
                <span>Correo *</span>
                <input className="clause-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
              </label>
            </div>
            <div className="clause-form-col">
              <label className="clause-field">
                <span>Rol *</span>
                <select
                  className="clause-input"
                  value={profileCode}
                  onChange={(e) => setProfileCode(e.target.value)}
                  disabled={rolesLoading || roles.length === 0}
                >
                  <option value="">{rolesLoading ? 'Cargando roles…' : 'Seleccione un rol'}</option>
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
      </div>
    </PageShell>
  )
}
