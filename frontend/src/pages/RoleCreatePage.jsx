import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { createRole } from '../api/rolesApi'
import { ROLES_LIST_PATH } from '../navigation/rolesPaths'
import '../styles/shared-form.css'

function toUpperSnakeCase(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toUpperCase()
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function RoleCreatePage() {
  const navigate = useNavigate()

  const [label, setLabel] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = useMemo(() => {
    return isNonEmptyString(label) && isNonEmptyString(code)
  }, [label, code])

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const res = await createRole({ code: code.trim(), label: label.trim() }, {})
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message ?? 'No se pudo crear el rol.')
      return
    }
    const roleId = res.data?.role?.id
    if (roleId) {
      navigate(`${ROLES_LIST_PATH}/${roleId}`)
    } else {
      navigate(ROLES_LIST_PATH)
    }
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Roles y permisos', to: ROLES_LIST_PATH },
      { label: 'Nuevo rol' }
    ],
    []
  )

  const subActions = useMemo(
    () => (
      <button type="button" className="btn" onClick={onSubmit} disabled={!canSubmit || submitting}>
        {submitting ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [canSubmit, onSubmit, submitting]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}
          <div className="clause-form-row clause-form-row--two-equal">
            <div className="clause-form-col">
              <label className="clause-field">
                <span>Nombre del rol *</span>
                <input className="clause-input" value={label} onChange={(e) => setLabel(e.target.value)} />
              </label>
            </div>
            <div className="clause-form-col">
              <label className="clause-field">
                <span>Código *</span>
                <input
                  className="clause-input"
                  value={code}
                  onChange={(e) => setCode(toUpperSnakeCase(e.target.value))}
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
