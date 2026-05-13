import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchEmployeeDetail } from '../api/employeesApi'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { canMutateTrabajadores } from '../navigation/trabajadoresAuth'
import { useEmployeeCompanyScope } from './useEmployeeCompanyScope'
import { EmployeeFormSections } from './EmployeeFormSections'
import { normalizeIsoDateOrNull } from './employeeFormUtils'
import './ClauseForm.css'

function mapEmpToForm(emp) {
  if (!emp) return null
  return {
    full_name: emp.full_name ?? '',
    rut: emp.rut ? String(emp.rut) : '',
    email: emp.email != null ? String(emp.email) : '',
    nationality: emp.nationality ?? '',
    sex: emp.sex ?? '',
    marital_status: emp.marital_status ?? '',
    address: emp.address != null ? String(emp.address) : '',
    commune: emp.commune != null ? String(emp.commune) : '',
    city: emp.city != null ? String(emp.city) : '',
    dob: normalizeIsoDateOrNull(emp.date_of_birth) ?? '',
    hire: normalizeIsoDateOrNull(emp.hire_date) ?? '',
    position_id: emp.position_id ?? '',
    work_schedule_id: emp.work_schedule_id ?? '',
    base_salary: emp.base_salary != null ? String(emp.base_salary) : '',
    gratification: emp.gratification != null ? String(emp.gratification) : '',
    transport_allowance: emp.transport_allowance != null ? String(emp.transport_allowance) : '',
    meal_allowance: emp.meal_allowance != null ? String(emp.meal_allowance) : '',
    bonuses: emp.bonuses != null ? String(emp.bonuses) : '',
    commissions: emp.commissions != null ? String(emp.commissions) : '',
    prevision_salud: emp.prevision_salud != null ? String(emp.prevision_salud) : '',
    fondo_pension: emp.fondo_pension != null ? String(emp.fondo_pension) : '',
    is_active: emp.is_active !== false
  }
}

export function EmployeeViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null
  const { companyId, blocked, message: scopeMessage } = useEmployeeCompanyScope()
  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canRead = grantedCodes.has('NAV_ACTION_TRABAJADORES_TRABAJADORES_READ')
  const canEdit = canMutateTrabajadores(grantedCodes)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [emp, setEmp] = useState(null)
  const [form, setForm] = useState(null)

  useEffect(() => {
    let a = true
    async function load() {
      if (!id || !accessToken || !companyId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchEmployeeDetail({ id, companyId, accessToken })
      if (!a) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message)
        setEmp(null)
        setForm(null)
        return
      }
      const e = res.data?.employee
      setEmp(e || null)
      setForm(e ? mapEmpToForm(e) : null)
    }
    load()
    return () => {
      a = false
    }
  }, [id, accessToken, companyId])

  const positions = useMemo(() => {
    if (!emp) return []
    if (emp.position_id && (emp.position_name != null)) {
      return [
        {
          id: emp.position_id,
          name: emp.position_name,
          description: emp.position_description != null ? String(emp.position_description) : null
        }
      ]
    }
    return []
  }, [emp])
  const workSchedules = useMemo(() => {
    if (!emp) return []
    if (emp.work_schedule_id && emp.work_schedule_name != null) {
      return [{ id: emp.work_schedule_id, name: emp.work_schedule_name }]
    }
    return []
  }, [emp])

  const listPath = '/app/trabajadores'
  const breadcrumb = useMemo(
    () => (canRead ? [{ label: 'Trabajadores', to: listPath }, { label: 'Detalle' }] : null),
    [canRead, listPath]
  )

  const noop = () => {}

  const subActions = useMemo(() => {
    if (!emp || !canEdit || !id) return null
    return (
      <button type="button" className="clause-button" onClick={() => navigate(`/app/trabajadores/${id}/edit`)}>
        Editar
      </button>
    )
  }, [canEdit, emp, id, navigate])

  if (!canRead) {
    return (
      <PageShell title="Trabajador" breadcrumb={breadcrumb} actions={subActions}>
        <div className="clause-list-card">
          <div className="clause-error">No tiene permiso para ver trabajadores.</div>
        </div>
      </PageShell>
    )
  }

  if (blocked && scopeMessage) {
    return (
      <PageShell title="Trabajador" breadcrumb={breadcrumb} actions={subActions}>
        <div className="clause-list-card">
          <div className="clause-error">{scopeMessage}</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      className="clause-universal-list-page"
      breadcrumb={breadcrumb}
      actions={subActions}
      hideHeader
    >
      {error ? <div className="clause-error">{error}</div> : null}
      {loading ? (
        <div className="clause-list-loading">Cargando…</div>
      ) : form && emp ? (
        <div className="employee-trabajador-form">
          <EmployeeFormSections
            form={form}
            onChange={noop}
            readOnly
            positions={positions}
            workSchedules={workSchedules}
          />
        </div>
      ) : (
        <div className="clause-error">No se encontró el trabajador.</div>
      )}
    </PageShell>
  )
}
