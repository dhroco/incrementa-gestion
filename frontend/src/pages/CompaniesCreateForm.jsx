import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { BranchTableEditor, FormSection } from '../components/CompanyFormSections'
import { createCompany } from '../api/companiesApi'
import {
  branchesClientValidationOk,
  buildCompanyMutationPayload,
  isValidEmailField,
  validateHeadquartersForCompanySubmit,
  validateSignificantBranchesForSubmit
} from '../utils/companyFormPayload'
import {
  isCompanyRutConflictResponse,
  isCompanyRutDuplicateUserMessage,
  userMessageFromCompanySaveFailure
} from '../utils/companyApiErrors'
import { parseOptionalRut, parseRut } from '../utils/rut'
import './ClauseForm.css'

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function CompaniesCreateForm() {
  const navigate = useNavigate()
  const ctx = useOutletContext()
  const {
    listPath,
    parentEditPath,
    accessToken,
    businessName,
    setBusinessName,
    rut,
    setRut,
    businessActivity,
    setBusinessActivity,
    address,
    setAddress,
    commune,
    setCommune,
    city,
    setCity,
    region,
    setRegion,
    email,
    setEmail,
    phone,
    setPhone,
    nameLegal1,
    setNameLegal1,
    rutLegal1,
    setRutLegal1,
    nameLegal2,
    setNameLegal2,
    rutLegal2,
    setRutLegal2,
    branches
  } = ctx

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  /** Mensaje del servidor relacionado con el RUT de la empresa (p. ej. duplicado). */
  const [rutServerMessage, setRutServerMessage] = useState(null)

  const rutCheck = useMemo(() => parseRut(rut), [rut])
  const emailOk = useMemo(() => isValidEmailField(email), [email])
  const rutLegal1Check = useMemo(() => parseOptionalRut(rutLegal1), [rutLegal1])
  const rutLegal2Check = useMemo(() => parseOptionalRut(rutLegal2), [rutLegal2])

  const branchesClientOk = useMemo(() => branchesClientValidationOk(branches), [branches])

  const canSubmit = useMemo(() => {
    return (
      !!accessToken &&
      isNonEmptyString(businessName) &&
      rutCheck.ok &&
      emailOk &&
      rutLegal1Check.ok &&
      rutLegal2Check.ok &&
      branchesClientOk
    )
  }, [accessToken, businessName, rutCheck.ok, emailOk, rutLegal1Check.ok, rutLegal2Check.ok, branchesClientOk])

  async function onSubmit() {
    if (!canSubmit) return
    const branchVal = validateSignificantBranchesForSubmit(branches)
    if (!branchVal.ok) {
      setError(branchVal.message)
      return
    }
    const hq = validateHeadquartersForCompanySubmit({
      businessName,
      rut,
      email,
      rutLegal1,
      rutLegal2
    })
    if (!hq.ok) {
      setError(hq.message)
      return
    }

    setSubmitting(true)
    setError(null)
    setRutServerMessage(null)
    const res = await createCompany(
      buildCompanyMutationPayload({
        businessName,
        rut,
        businessActivity,
        address,
        commune,
        city,
        region,
        email,
        phone,
        nameLegal1,
        rutLegal1,
        nameLegal2,
        rutLegal2,
        significantBranches: branchVal.significant
      }),
      { accessToken }
    )
    setSubmitting(false)
    if (!res.ok) {
      const msg = userMessageFromCompanySaveFailure(res)
      setError(msg)
      setRutServerMessage(isCompanyRutConflictResponse(res) ? msg : null)
      return
    }
    navigate(listPath)
  }

  const breadcrumb = useMemo(
    () => [
      { label: 'Empresas', to: listPath },
      { label: 'Nueva empresa' }
    ],
    [listPath]
  )

  const subActions = (
    <button type="button" className="clause-button" onClick={onSubmit} disabled={!canSubmit || submitting}>
      {submitting ? 'Guardando…' : 'Guardar'}
    </button>
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <div className="ph-card clause-card">
        <div className="clause-form">
          {error ? <div className="clause-error">{error}</div> : null}

          <div className="clause-form-row clause-form-row--two-col">
            <div className="clause-form-col">
              <div className="clause-label">Razón Social</div>
              <input className="clause-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="clause-form-col">
              <div className="clause-label">RUT</div>
              <input
                className="clause-input"
                value={rut}
                onChange={(e) => {
                  setRut(e.target.value)
                  setRutServerMessage(null)
                  setError((prev) => (prev && isCompanyRutDuplicateUserMessage(prev) ? null : prev))
                }}
                aria-invalid={Boolean(rutServerMessage) || (!rutCheck.ok && Boolean(rut.trim()))}
                aria-describedby={rutServerMessage ? 'company-rut-server-msg' : undefined}
              />
              {!rutCheck.ok && rut.trim().length ? (
                <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>{rutCheck.message}</div>
              ) : null}
              {rutServerMessage ? (
                <div id="company-rut-server-msg" style={{ fontSize: '12px', color: '#000', opacity: 0.9 }} role="alert">
                  {rutServerMessage}
                </div>
              ) : null}
            </div>
          </div>

          <div className="company-form-level2">
            <div className="clause-form-col">
              <div className="clause-label">Giro</div>
              <input className="clause-input" value={businessActivity} onChange={(e) => setBusinessActivity(e.target.value)} />
            </div>
            <div className="clause-form-col">
              <div className="clause-label">Correo</div>
              <input className="clause-input" value={email} onChange={(e) => setEmail(e.target.value)} />
              {!emailOk && email.trim().length ? (
                <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>Correo inválido.</div>
              ) : null}
            </div>
            <div className="clause-form-col">
              <div className="clause-label">Teléfono</div>
              <input className="clause-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <FormSection title="Domicilio y Jurisdicción">
            <div className="clause-form-row">
              <div className="clause-label">Dirección</div>
              <input className="clause-input" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="clause-form-row clause-form-row--three-equal">
              <div className="clause-form-col">
                <div className="clause-label">Comuna</div>
                <input className="clause-input" value={commune} onChange={(e) => setCommune(e.target.value)} />
              </div>
              <div className="clause-form-col">
                <div className="clause-label">Ciudad</div>
                <input className="clause-input" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="clause-form-col">
                <div className="clause-label">Región</div>
                <input className="clause-input" value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
            </div>
          </FormSection>

          <div className="company-form-rep-row-with-vrule">
            <div className="company-form-rep-col">
              <h3 className="clause-form-section-title">Representante legal 1</h3>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Nombre</div>
                  <input className="clause-input" value={nameLegal1} onChange={(e) => setNameLegal1(e.target.value)} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">RUT</div>
                  <input className="clause-input" value={rutLegal1} onChange={(e) => setRutLegal1(e.target.value)} />
                  {!rutLegal1Check.ok && rutLegal1.trim().length ? (
                    <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>{rutLegal1Check.message}</div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="company-form-rep-vrule" role="separator" aria-orientation="vertical" />
            <div className="company-form-rep-col">
              <h3 className="clause-form-section-title">Representante legal 2</h3>
              <div className="clause-form-row clause-form-row--two-equal">
                <div className="clause-form-col">
                  <div className="clause-label">Nombre</div>
                  <input className="clause-input" value={nameLegal2} onChange={(e) => setNameLegal2(e.target.value)} />
                </div>
                <div className="clause-form-col">
                  <div className="clause-label">RUT</div>
                  <input className="clause-input" value={rutLegal2} onChange={(e) => setRutLegal2(e.target.value)} />
                  {!rutLegal2Check.ok && rutLegal2.trim().length ? (
                    <div style={{ fontSize: '12px', color: '#000', opacity: 0.8 }}>{rutLegal2Check.message}</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="company-form-branches-block clause-form-section clause-form-section--separated">
            <hr className="company-form-section-rule" aria-hidden="true" />
            <BranchTableEditor rows={branches} readOnly={false} branchEditorBasePath={parentEditPath} />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
