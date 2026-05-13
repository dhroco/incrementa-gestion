import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import {
  createEmployee,
  fetchEmployeeDetail,
  fetchEmployeesLookup,
  updateEmployee
} from '../api/employeesApi'
import { selectEnrichedNavigation, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { canMutateTrabajadores } from '../navigation/trabajadoresAuth'
import { useEmployeeCompanyScope } from './useEmployeeCompanyScope'
import { EmployeeFormSections } from './EmployeeFormSections'
import { isValidEmailField } from '../utils/companyFormPayload'
import { normalizeIsoDateOrNull, parseMoneyToDecimalString } from './employeeFormUtils'
import './ClauseForm.css'

const emptyForm = () => ({
  full_name: '',
  rut: '',
  email: '',
  nationality: '',
  sex: '',
  marital_status: '',
  address: '',
  commune: '',
  city: '',
  dob: '',
  hire: '',
  position_id: '',
  work_schedule_id: '',
  base_salary: '',
  gratification: '',
  transport_allowance: '',
  meal_allowance: '',
  bonuses: '',
  commissions: '',
  prevision_salud: '',
  fondo_pension: '',
  is_active: true
})

function employeeToForm(emp) {
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

export function EmployeeCreatePage() {
  return <EmployeeUpsertContent mode="create" />
}

export function EmployeeEditPage() {
  return <EmployeeUpsertContent mode="edit" />
}

function EmployeeUpsertContent({ mode }) {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const accessToken = session?.access_token ?? null
  const { companyId, blocked, message: scopeMessage } = useEmployeeCompanyScope()
  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const can =
    mode === 'create' ? grantedCodes.has('NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE') : canMutateTrabajadores(grantedCodes)

  const [form, setForm] = useState(emptyForm)
  const [positions, setPositions] = useState([])
  const [workSchedules, setWorkSchedules] = useState([])
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const setF = useCallback((k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
  }, [])

  useEffect(() => {
    let a = true
    async function loadLookups() {
      if (!accessToken || !companyId || blocked) return
      const res = await fetchEmployeesLookup({ companyId, accessToken })
      if (!a || !res.ok) return
      setPositions(Array.isArray(res.data?.positions) ? res.data.positions : [])
      setWorkSchedules(Array.isArray(res.data?.work_schedules) ? res.data.work_schedules : [])
    }
    loadLookups()
    return () => {
      a = false
    }
  }, [accessToken, companyId, blocked])

  useEffect(() => {
    if (mode !== 'edit' || !routeId) return
    let a = true
    async function load() {
      if (!accessToken || !companyId) return
      setLoading(true)
      setError(null)
      const res = await fetchEmployeeDetail({ id: routeId, companyId, accessToken })
      if (!a) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el trabajador.')
        return
      }
      const emp = res.data?.employee
      if (emp) {
        setForm(employeeToForm(emp))
      }
    }
    load()
    return () => {
      a = false
    }
  }, [mode, routeId, accessToken, companyId])

  const listHref = '/app/trabajadores'
  const breadcrumb = useMemo(() => {
    if (mode === 'create') return [{ label: 'Trabajadores', to: listHref }, { label: 'Nuevo' }]
    return [{ label: 'Trabajadores', to: listHref }, { label: 'Editar' }]
  }, [listHref, mode])

  const title = mode === 'create' ? 'Nuevo trabajador' : 'Editar trabajador'
  const hidePageTitle = mode === 'create'

  const subActions = useMemo(
    () => (
      <button
        type="submit"
        form="employee-upsert-form"
        className="clause-button"
        disabled={saving || !companyId || loading}
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    ),
    [saving, companyId, loading]
  )

  function buildPayload() {
    const fe = {}
    const dob = normalizeIsoDateOrNull(form.dob)
    const hire = normalizeIsoDateOrNull(form.hire)
    if (!dob) fe.date_of_birth = 'Indique la fecha de nacimiento.'
    if (!hire) fe.hire_date = 'Indique la fecha de ingreso.'
    const em = String(form.email || '').trim()
    if (!em) fe.email = 'El correo electrónico es obligatorio.'
    else if (!isValidEmailField(em)) fe.email = 'Ingrese un correo electrónico válido.'
    setFieldErrors(fe)
    if (Object.keys(fe).length) return null

    return {
      full_name: form.full_name,
      rut: form.rut,
      email: em,
      nationality: form.nationality || null,
      sex: form.sex,
      marital_status: form.marital_status || null,
      address: String(form.address || '').trim() || null,
      commune: String(form.commune || '').trim() || null,
      city: String(form.city || '').trim() || null,
      date_of_birth: dob,
      hire_date: hire,
      position_id: form.position_id,
      work_schedule_id: form.work_schedule_id,
      base_salary: Number(parseMoneyToDecimalString(form.base_salary)),
      gratification: Number(parseMoneyToDecimalString(form.gratification)),
      transport_allowance: Number(parseMoneyToDecimalString(form.transport_allowance)),
      meal_allowance: Number(parseMoneyToDecimalString(form.meal_allowance)),
      bonuses: Number(parseMoneyToDecimalString(form.bonuses)),
      commissions: Number(parseMoneyToDecimalString(form.commissions)),
      prevision_salud: String(form.prevision_salud || '').trim() || null,
      fondo_pension: String(form.fondo_pension || '').trim() || null,
      is_active: form.is_active !== false
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!can || !companyId) return
    const p = buildPayload()
    if (!p) return
    setSaving(true)
    if (mode === 'create') {
      const res = await createEmployee(p, { companyId, accessToken })
      setSaving(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo crear el trabajador.')
        return
      }
      navigate('/app/trabajadores', { replace: true })
    } else {
      const res = await updateEmployee(routeId, p, { companyId, accessToken })
      setSaving(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo actualizar el trabajador.')
        return
      }
      navigate('/app/trabajadores', { replace: true })
    }
  }

  if (!can) {
    return (
      <PageShell
        title={title}
        breadcrumb={breadcrumb}
        className="clause-universal-list-page"
        hideHeader={hidePageTitle}
      >
        <div className="clause-list-card">
          <div className="clause-error">No tiene permiso para {mode === 'create' ? 'crear' : 'editar'} trabajadores.</div>
        </div>
      </PageShell>
    )
  }

  if (blocked && scopeMessage) {
    return (
      <PageShell
        title={title}
        breadcrumb={breadcrumb}
        className="clause-universal-list-page"
        hideHeader={hidePageTitle}
      >
        <div className="clause-list-card">
          <div className="clause-error">{scopeMessage}</div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      breadcrumb={breadcrumb}
      className="clause-universal-list-page"
      actions={subActions}
      hideHeader
    >
      <form id="employee-upsert-form" className="employee-trabajador-form" onSubmit={onSubmit} noValidate>
        {error ? <div className="clause-error">{error}</div> : null}
        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <EmployeeFormSections
            form={form}
            onChange={setF}
            readOnly={false}
            positions={positions}
            workSchedules={workSchedules}
            fieldErrors={fieldErrors}
          />
        )}
      </form>
    </PageShell>
  )
}
