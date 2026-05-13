import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { fetchAccountantPlatformDetail, updateAccountantPlatform } from '../api/accountantsPlatformApi'
import { fetchCompaniesList } from '../api/companiesApi'
import { ACCOUNTANTS_LIST_PATH } from '../navigation/platformPaths'
import { selectSession } from '../store/authSlice'
import { parseRut } from '../utils/rut'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function formatRutForInput(body, dv) {
  if (!body) return ''
  const d = dv ? String(dv).toUpperCase() : ''
  return d ? `${body}-${d}` : String(body)
}

export function AccountantEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [rut, setRut] = useState('')
  const [address, setAddress] = useState('')
  const [commune, setCommune] = useState('')
  const [city, setCity] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [companyIds, setCompanyIds] = useState(() => new Set())
  const [companies, setCompanies] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const rutCheck = useMemo(() => (rut.trim() ? parseRut(rut) : { ok: true }), [rut])
  const canSubmit = useMemo(() => {
    return !!accessToken && isNonEmptyString(fullName) && rutCheck.ok
  }, [accessToken, fullName, rutCheck.ok])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!accessToken || !id) return
      setLoading(true)
      setError(null)
      const [detailRes, companiesRes] = await Promise.all([
        fetchAccountantPlatformDetail(id, { accessToken }),
        fetchCompaniesList({ q: '', accessToken })
      ])
      if (!active) return
      if (!detailRes.ok) {
        setError(detailRes.message ?? 'No se pudo cargar el contador.')
        setLoading(false)
        return
      }
      let companiesList = companiesRes.ok && Array.isArray(companiesRes.data?.items) ? companiesRes.data.items : []
      const a = detailRes.data?.accountant
      const comps = detailRes.data?.companies
      if (Array.isArray(comps) && comps.length > 0) {
        const seen = new Set(companiesList.map((c) => c.id))
        for (const c of comps) {
          if (c?.id && !seen.has(c.id)) {
            companiesList = companiesList.concat([{ id: c.id, business_name: c.business_name ?? c.id }])
            seen.add(c.id)
          }
        }
      }
      setCompanies(companiesList)
      if (a) {
        setEmail(a.email ?? '')
        setFullName(a.full_name ?? '')
        setPhone(a.phone ?? '')
        setRut(formatRutForInput(a.rut_body, a.rut_dv))
        setAddress(a.address ?? '')
        setCommune(a.commune ?? '')
        setCity(a.city ?? '')
        setIsActive(a.is_active !== false)
      }
      if (Array.isArray(comps)) {
        setCompanyIds(new Set(comps.map((c) => c.id).filter(Boolean)))
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [accessToken, id])

  function toggleCompany(cid) {
    setCompanyIds((prev) => {
      const next = new Set(prev)
      if (next.has(cid)) next.delete(cid)
      else next.add(cid)
      return next
    })
  }

  async function onSubmit() {
    if (!canSubmit || !id) return
    setSubmitting(true)
    setError(null)
    const res = await updateAccountantPlatform(
      id,
      {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        rut: rut.trim() || null,
        address: address.trim() || null,
        commune: commune.trim() || null,
        city: city.trim() || null,
        is_active: isActive,
        company_ids: Array.from(companyIds)
      },
      { accessToken }
    )
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    navigate(ACCOUNTANTS_LIST_PATH)
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Contadores', to: ACCOUNTANTS_LIST_PATH },
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
                  <span>Correo</span>
                  <input className="clause-input" type="email" value={email} disabled />
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
            {!rutCheck.ok ? <div className="clause-error">{rutCheck.message}</div> : null}
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
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
