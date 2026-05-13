import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { createAccountantPlatform } from '../api/accountantsPlatformApi'
import { fetchCompaniesList } from '../api/companiesApi'
import { ACCOUNTANTS_LIST_PATH } from '../navigation/platformPaths'
import { selectSession } from '../store/authSlice'
import { parseRut } from '../utils/rut'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidEmail(v) {
  if (!isNonEmptyString(v)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function AccountantCreatePage() {
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [rut, setRut] = useState('')
  const [address, setAddress] = useState('')
  const [commune, setCommune] = useState('')
  const [city, setCity] = useState('')
  const [companyIds, setCompanyIds] = useState(() => new Set())
  const [companies, setCompanies] = useState([])
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [tempPassword, setTempPassword] = useState(null)

  const rutCheck = useMemo(() => (rut.trim() ? parseRut(rut) : { ok: true }), [rut])
  const canSubmit = useMemo(() => {
    return !!accessToken && isValidEmail(email) && isNonEmptyString(fullName) && rutCheck.ok
  }, [accessToken, email, fullName, rutCheck.ok])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!accessToken) return
      const res = await fetchCompaniesList({ q: '', accessToken })
      if (!active || !res.ok) return
      const list = res.data?.items
      setCompanies(Array.isArray(list) ? list : [])
    })()
    return () => {
      active = false
    }
  }, [accessToken])

  function toggleCompany(id) {
    setCompanyIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const res = await createAccountantPlatform(
      {
        email: email.trim(),
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        rut: rut.trim() || null,
        address: address.trim() || null,
        commune: commune.trim() || null,
        city: city.trim() || null,
        company_ids: Array.from(companyIds)
      },
      { accessToken }
    )
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    const tp = res.data?.temporary_password
    if (typeof tp === 'string' && tp.length > 0) {
      setTempPassword(tp)
    } else {
      navigate(ACCOUNTANTS_LIST_PATH)
    }
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Contadores', to: ACCOUNTANTS_LIST_PATH },
      { label: 'Nuevo contador' }
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
      <PageShell title="Contador creado" hideHeader>
        <div className="ph-card clause-card" style={{ maxWidth: '520px' }}>
          <p style={{ margin: '0 0 8px' }}>
            El contador fue creado correctamente. <strong>Guarde la contraseña temporal</strong>; no se volverá a
            mostrar.
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
          <button type="button" className="clause-button" onClick={() => navigate(ACCOUNTANTS_LIST_PATH)}>
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
              </label>
            </div>
          </div>
          {!rutCheck.ok && rut.trim().length ? <div className="clause-error">{rutCheck.message}</div> : null}
          <label className="clause-field">
            <span>Dirección</span>
            <input className="clause-input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <div className="clause-form-row clause-form-row--two-equal">
            <div className="clause-form-col">
              <label className="clause-field">
                <span>Comuna</span>
                <input className="clause-input" value={commune} onChange={(e) => setCommune(e.target.value)} />
              </label>
            </div>
            <div className="clause-form-col">
              <label className="clause-field">
                <span>Ciudad</span>
                <input className="clause-input" value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="clause-field clause-field--estado-inline" role="group" aria-label="Estado del contador">
            <span className="clause-label clause-label--estado">Estado</span>
            <label className="clause-estado-activo">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>Activo</span>
            </label>
          </div>
          <div className="clause-field">
            <span>Empresas asignadas</span>
            <div style={{ maxHeight: '180px', overflow: 'auto', border: '1px solid #E3E6E8', padding: '8px' }}>
              {companies.map((c) => (
                <label key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <input type="checkbox" checked={companyIds.has(c.id)} onChange={() => toggleCompany(c.id)} />
                  <span>{c.business_name ?? c.id}</span>
                </label>
              ))}
              {companies.length === 0 ? <span className="clause-muted">No hay empresas disponibles.</span> : null}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
