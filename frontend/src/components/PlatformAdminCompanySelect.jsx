import { useDispatch, useSelector } from 'react-redux'
import { selectUser } from '../store/authSlice'
import {
  selectAssignedCompanies,
  selectSelectedCompanyId,
  setSelectedCompanyId
} from '../store/sessionCompanySlice'

function companyLabel(company) {
  if (!company) return '—'
  const name =
    typeof company.business_name === 'string' && company.business_name.trim()
      ? company.business_name.trim()
      : null
  return name ?? company.id
}

/**
 * Selector de empresa en contexto (administrador de plataforma).
 */
export function PlatformAdminCompanySelect({ loading = false, error = null, className = '' }) {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const userId = user?.id ?? null
  const assignedCompanies = useSelector(selectAssignedCompanies)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)

  const rootClass = ['db-company-select', className].filter(Boolean).join(' ')

  if (loading) {
    return (
      <div className={rootClass}>
        <span className="db-company-select__label">Empresa</span>
        <span className="db-muted">Cargando empresas…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={rootClass}>
        <span className="db-company-select__label">Empresa</span>
        <span className="clause-error">{error}</span>
      </div>
    )
  }

  if (assignedCompanies.length === 0) {
    return (
      <div className={rootClass}>
        <span className="db-company-select__label">Empresa</span>
        <span className="db-muted">No hay empresas registradas.</span>
      </div>
    )
  }

  return (
    <label className={`${rootClass} app-subheader__trail-select-label`}>
      <span className="db-company-select__label">Empresa</span>
      <select
        id="platform-admin-company-select"
        className="app-subheader__company-select"
        value={selectedCompanyId ?? ''}
        onChange={(e) => {
          const companyId = e.target.value || null
          if (companyId && userId) {
            dispatch(setSelectedCompanyId({ userId, companyId }))
          }
        }}
        aria-label="Seleccionar empresa en contexto"
      >
        {!selectedCompanyId ? (
          <option value="" disabled>
            Seleccione una empresa…
          </option>
        ) : null}
        {assignedCompanies.map((c) => (
          <option key={c.id} value={c.id}>
            {companyLabel(c)}
          </option>
        ))}
      </select>
    </label>
  )
}
