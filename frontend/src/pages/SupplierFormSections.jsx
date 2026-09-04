import { formatEsDateFromIso } from '../utils/dateUtils'
import { DateInputCL } from '../components/DateInputCL'
import { formatRutDisplay } from '../utils/rut'
import { RutInput } from '../components/RutInput'
import { SupplierTypeChip } from '../components/SupplierTypeChip'
import { SocialNetworkSelector } from '../components/SocialNetworkSelector'
import '../styles/shared-form.css'

function inputClass(readOnly) {
  return readOnly ? 'clause-input clause-input--readonly' : 'clause-input'
}

function displayText(v) {
  if (v == null) return '—'
  const s = String(v).trim()
  return s === '' ? '—' : s
}

function displayIdentifier(v, docType) {
  if (v == null || String(v).trim() === '') return '—'
  if (docType?.validator_key === 'rut_cl') return formatRutDisplay(v, { empty: '—' })
  return String(v).trim()
}

function DocumentField({
  id,
  formKey,
  chileanLabel,
  form,
  onChange,
  readOnly,
  fieldErrors,
  docType,
  optional = false
}) {
  const c = inputClass(readOnly)
  const isRut = docType?.validator_key === 'rut_cl' || (!docType && form.country_code === 'CL')
  const label = isRut ? chileanLabel : docType?.label || 'Identificador'
  const placeholder = docType?.format_example || ''
  const value = form[formKey] ?? ''
  const error = fieldErrors[formKey]

  return (
    <div className="clause-form-col">
      <label className="clause-form-label" htmlFor={id}>
        {label}
        {!readOnly && !optional ? <span className="clause-form-required"> *</span> : null}
      </label>
      {readOnly ? (
        <input id={id} className={c} readOnly value={displayIdentifier(value, docType)} />
      ) : isRut ? (
        <RutInput
          id={id}
          className={c}
          optional={optional}
          value={value}
          onChange={(next) => onChange(formKey, next)}
        />
      ) : (
        <input
          id={id}
          className={c}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => onChange(formKey, e.target.value.toUpperCase())}
        />
      )}
      {error && !readOnly ? <div className="clause-field-error">{error}</div> : null}
    </div>
  )
}

function parsePatternSpec(pattern, role) {
  if (pattern == null || String(pattern).trim() === '') return null
  const raw = String(pattern).trim()
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw)
      return obj?.[role] || obj?.persona_natural || null
    } catch {
      return null
    }
  }
  return raw
}

export function validateCatalogDocument(value, docType, { required = true, role = 'persona_natural', chileanLabel = 'RUT' } = {}) {
  const trimmed = String(value || '').trim()
  const label = docType?.validator_key === 'rut_cl' ? chileanLabel : docType?.label || 'documento'
  if (!trimmed) {
    if (required) return `El ${label} es obligatorio.`
    return null
  }
  if (!docType) return 'Debe indicar el país del proveedor.'
  if (docType.validator_key === 'rut_cl') return null
  const source = parsePatternSpec(docType.pattern, role)
  if (!source) return null
  const canonical = trimmed.toUpperCase().replace(/[\s.-]/g, '')
  try {
    if (!new RegExp(source, 'u').test(canonical)) return `El ${label} ingresado no es válido.`
  } catch {
    return `El ${label} ingresado no es válido.`
  }
  return null
}

function personeriaLabel(type) {
  if (type === 'empresa_en_un_dia') return 'Empresa en un Día'
  if (type === 'escritura_publica') return 'Escritura Pública'
  return 'Sin acreditación'
}

function supplierTypeLabel(type) {
  return type === 'empresa' ? 'Empresa' : 'Persona Natural'
}

export function isSocialNetworkRowComplete(sn) {
  return Boolean(String(sn?.catalog_id || '').trim() && String(sn?.account_name || '').trim())
}

export function validateSocialNetworksForForm(list) {
  const rows = Array.isArray(list) ? list : []
  for (const sn of rows) {
    const catalog_id = String(sn?.catalog_id || '').trim()
    const account_name = String(sn?.account_name || '').trim()
    if (!catalog_id && !account_name) continue
    if (!catalog_id || !account_name) {
      return 'Cada red social debe tener red seleccionada y cuenta.'
    }
  }
  return null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_CHAR_RE = /^[+\d\s().-]+$/

/** Same format rule as backend `isValidEmail`. */
export function validateSupplierEmail(value, { required } = { required: false }) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    if (required) return 'El correo es obligatorio.'
    return null
  }
  if (!EMAIL_RE.test(trimmed)) return 'El correo no tiene un formato válido.'
  return null
}

/** Lax shape, same as backend parsePhoneField. Empty is valid. */
export function validateSupplierPhone(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  if (trimmed.length > 32 || !PHONE_CHAR_RE.test(trimmed)) {
    return 'El teléfono no tiene un formato válido.'
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    return 'El teléfono no tiene un formato válido.'
  }
  return null
}

export function socialNetworksForSubmit(list) {
  return (Array.isArray(list) ? list : [])
    .map((sn) => ({
      catalog_id: String(sn?.catalog_id || '').trim(),
      account_name: String(sn?.account_name || '').trim()
    }))
    .filter((sn) => sn.catalog_id && sn.account_name)
}

/** @type {Record<string, 'datos_basicos' | 'redes_sociales'>} */
const SUPPLIER_FIELD_ERROR_TAB = {
  full_name: 'datos_basicos',
  country_code: 'datos_basicos',
  rut: 'datos_basicos',
  email: 'datos_basicos',
  phone: 'datos_basicos',
  razon_social: 'datos_basicos',
  rut_empresa: 'datos_basicos',
  rut_rep_legal: 'datos_basicos',
  social_networks: 'redes_sociales'
}

export const COUNTRY_LABELS = { CL: 'Chile', MX: 'México' }

export function uniqueCountries(types) {
  const seen = new Set()
  const out = []
  for (const t of types || []) {
    const code = String(t.country_code || '').toUpperCase()
    if (!code || seen.has(code)) continue
    seen.add(code)
    out.push({ code, label: COUNTRY_LABELS[code] || code })
  }
  return out
}

export function documentTypeForCountry(types, countryCode) {
  const code = String(countryCode || '').toUpperCase()
  return (types || []).find((t) => String(t.country_code).toUpperCase() === code) || null
}

const SUPPLIER_TAB_ORDER = /** @type {const} */ (['datos_basicos', 'redes_sociales', 'antecedentes'])

/**
 * @param {Record<string, string>} fieldErrors
 * @returns {'datos_basicos' | 'redes_sociales' | 'antecedentes' | null}
 */
export function getFirstSupplierFormTabWithErrors(fieldErrors) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return null
  for (const tab of SUPPLIER_TAB_ORDER) {
    if (tab === 'antecedentes') continue
    for (const field of Object.keys(fieldErrors)) {
      if (!fieldErrors[field]) continue
      if (SUPPLIER_FIELD_ERROR_TAB[field] === tab) return tab
    }
  }
  return null
}

/**
 * @param {{
 *  form: Record<string, any>,
 *  onChange: (f: string, v: any) => void,
 *  readOnly?: boolean,
 *  typeLocked?: boolean,
 *  fieldErrors?: Record<string, string>
 * }} props
 */
export function SupplierBasicDataSection({
  form,
  onChange,
  readOnly = false,
  typeLocked = false,
  fieldErrors = {},
  emailRequired = false,
  identityDocumentTypes = []
}) {
  const c = inputClass(readOnly)
  const isEmpresa = form.supplier_type === 'empresa'
  const isPersona = form.supplier_type === 'persona_natural'
  const personeria = form.personeria_type || ''
  const countries = uniqueCountries(identityDocumentTypes)
  const docType = documentTypeForCountry(identityDocumentTypes, form.country_code)

  const showPersoneriaEmpresa =
    isEmpresa &&
    (readOnly
      ? personeria === 'empresa_en_un_dia' &&
        (form.fecha_certificado_estatuto || form.codigo_cve)
      : personeria === 'empresa_en_un_dia')
  const showPersoneriaEscritura =
    isEmpresa &&
    (readOnly
      ? personeria === 'escritura_publica' &&
        (form.fecha_escritura_publica || form.nombre_notaria || form.nombre_notario)
      : personeria === 'escritura_publica')
  const showPersoneriaSection =
    isEmpresa &&
    (readOnly ? personeria === 'empresa_en_un_dia' || personeria === 'escritura_publica' : true)

  return (
    <div className="clause-form-section clause-form-section--separated employee-form-panel">
      <h3 className="clause-form-section-title">Tipo de proveedor</h3>
      {readOnly || typeLocked ? (
        <div className="clause-form-row">
          <div className="clause-form-col">
            <SupplierTypeChip supplierType={form.supplier_type} />
          </div>
        </div>
      ) : (
        <div className="clause-form-row clause-form-row--inline">
          <label className="clause-form-label-inline">
            <input
              type="radio"
              name="supplier_type"
              value="persona_natural"
              checked={form.supplier_type === 'persona_natural'}
              onChange={() => onChange('supplier_type', 'persona_natural')}
            />
            <SupplierTypeChip supplierType="persona_natural" />
          </label>
          <label className="clause-form-label-inline">
            <input
              type="radio"
              name="supplier_type"
              value="empresa"
              checked={form.supplier_type === 'empresa'}
              onChange={() => onChange('supplier_type', 'empresa')}
            />
            <SupplierTypeChip supplierType="empresa" />
          </label>
        </div>
      )}

      <h3 className="clause-form-section-title">País</h3>
      <div className="clause-form-row">
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="sup-country">
            País{!readOnly ? <span className="clause-form-required"> *</span> : null}
          </label>
          {readOnly ? (
            <input
              id="sup-country"
              className={c}
              readOnly
              value={COUNTRY_LABELS[form.country_code] || form.country_code || '—'}
            />
          ) : (
            <select
              id="sup-country"
              className={c}
              value={form.country_code ?? ''}
              onChange={(e) => onChange('country_code', e.target.value)}
            >
              <option value="">Seleccione un país</option>
              {countries.map((co) => (
                <option key={co.code} value={co.code}>
                  {co.label}
                </option>
              ))}
            </select>
          )}
          {fieldErrors.country_code && !readOnly ? (
            <div className="clause-field-error">{fieldErrors.country_code}</div>
          ) : null}
        </div>
      </div>

      {isPersona ? (
        <>
          <h3 className="clause-form-section-title">Identificación</h3>
          <div className="clause-form-row clause-form-row--two-col">
            <div className="clause-form-col">
              <label className="clause-form-label" htmlFor="sup-full-name">
                Nombre completo{!readOnly ? <span className="clause-form-required"> *</span> : null}
              </label>
              {readOnly ? (
                <input id="sup-full-name" className={c} readOnly value={displayText(form.full_name)} />
              ) : (
                <input
                  id="sup-full-name"
                  className={c}
                  value={form.full_name ?? ''}
                  onChange={(e) => onChange('full_name', e.target.value)}
                />
              )}
              {fieldErrors.full_name && !readOnly ? (
                <div className="clause-field-error">{fieldErrors.full_name}</div>
              ) : null}
            </div>
            <DocumentField
              id="sup-rut"
              formKey="rut"
              chileanLabel="RUT"
              form={form}
              onChange={onChange}
              readOnly={readOnly}
              fieldErrors={fieldErrors}
              docType={docType}
            />
          </div>
        </>
      ) : null}

      {isEmpresa ? (
        <>
          <h3 className="clause-form-section-title">Datos empresa</h3>
          <div className="clause-form-row clause-form-row--two-col">
            <div className="clause-form-col">
              <label className="clause-form-label" htmlFor="sup-razon">
                Razón social{!readOnly ? <span className="clause-form-required"> *</span> : null}
              </label>
              {readOnly ? (
                <input id="sup-razon" className={c} readOnly value={displayText(form.razon_social)} />
              ) : (
                <input
                  id="sup-razon"
                  className={c}
                  value={form.razon_social ?? ''}
                  onChange={(e) => onChange('razon_social', e.target.value)}
                />
              )}
              {fieldErrors.razon_social && !readOnly ? (
                <div className="clause-field-error">{fieldErrors.razon_social}</div>
              ) : null}
            </div>
            <DocumentField
              id="sup-rut-empresa"
              formKey="rut_empresa"
              chileanLabel="RUT empresa"
              form={form}
              onChange={onChange}
              readOnly={readOnly}
              fieldErrors={fieldErrors}
              docType={docType}
            />
          </div>
        </>
      ) : null}

      {isPersona || isEmpresa ? (
        <>
          <h3 className="clause-form-section-title">Contacto</h3>
          <div className="clause-form-row clause-form-row--two-col">
            <div className="clause-form-col">
              <label className="clause-form-label" htmlFor="sup-email">
                {isEmpresa ? 'Correo del representante legal' : 'Correo'}
                {!readOnly && emailRequired ? <span className="clause-form-required"> *</span> : null}
              </label>
              {readOnly ? (
                <input id="sup-email" className={c} readOnly value={displayText(form.email)} />
              ) : (
                <input
                  id="sup-email"
                  className={c}
                  type="email"
                  autoComplete="off"
                  value={form.email ?? ''}
                  onChange={(e) => onChange('email', e.target.value)}
                />
              )}
              {isEmpresa ? (
                <p className="clause-form-hint">
                  Casilla de quien firmará el contrato, no un correo general de la empresa.
                </p>
              ) : null}
              {fieldErrors.email && !readOnly ? <div className="clause-field-error">{fieldErrors.email}</div> : null}
            </div>
            <div className="clause-form-col">
              <label className="clause-form-label" htmlFor="sup-phone">
                Teléfono
              </label>
              {readOnly ? (
                <input id="sup-phone" className={c} readOnly value={displayText(form.phone)} />
              ) : (
                <input
                  id="sup-phone"
                  className={c}
                  type="tel"
                  autoComplete="off"
                  value={form.phone ?? ''}
                  onChange={(e) => onChange('phone', e.target.value)}
                />
              )}
              {fieldErrors.phone && !readOnly ? <div className="clause-field-error">{fieldErrors.phone}</div> : null}
            </div>
          </div>
        </>
      ) : null}

      {isPersona ? (
        <div className="clause-form-row">
          <div className="clause-form-col">
            <label className="clause-form-label" htmlFor="sup-address">
              Dirección
            </label>
            {readOnly ? (
              <input id="sup-address" className={c} readOnly value={displayText(form.address)} />
            ) : (
              <input
                id="sup-address"
                className={c}
                value={form.address ?? ''}
                onChange={(e) => onChange('address', e.target.value)}
              />
            )}
          </div>
        </div>
      ) : null}

      {isEmpresa ? (
        <>
          <div className="clause-form-row clause-form-row--two-equal">
            <div className="clause-form-col">
              <label className="clause-form-label" htmlFor="sup-giro">
                Giro
              </label>
              {readOnly ? (
                <input id="sup-giro" className={c} readOnly value={displayText(form.giro)} />
              ) : (
                <input
                  id="sup-giro"
                  className={c}
                  value={form.giro ?? ''}
                  onChange={(e) => onChange('giro', e.target.value)}
                />
              )}
            </div>
            <div className="clause-form-col">
              <label className="clause-form-label" htmlFor="sup-dir-empresa">
                Dirección empresa
              </label>
              {readOnly ? (
                <input id="sup-dir-empresa" className={c} readOnly value={displayText(form.direccion_empresa)} />
              ) : (
                <input
                  id="sup-dir-empresa"
                  className={c}
                  value={form.direccion_empresa ?? ''}
                  onChange={(e) => onChange('direccion_empresa', e.target.value)}
                />
              )}
            </div>
          </div>

          <h3 className="clause-form-section-title">Representante legal</h3>
          <div className="clause-form-row clause-form-row--two-col">
            <div className="clause-form-col">
              <label className="clause-form-label" htmlFor="sup-rep-name">
                Nombre representante legal
              </label>
              {readOnly ? (
                <input id="sup-rep-name" className={c} readOnly value={displayText(form.nombre_rep_legal)} />
              ) : (
                <input
                  id="sup-rep-name"
                  className={c}
                  value={form.nombre_rep_legal ?? ''}
                  onChange={(e) => onChange('nombre_rep_legal', e.target.value)}
                />
              )}
            </div>
            <DocumentField
              id="sup-rep-rut"
              formKey="rut_rep_legal"
              chileanLabel="RUT representante legal"
              form={form}
              onChange={onChange}
              readOnly={readOnly}
              fieldErrors={fieldErrors}
              docType={docType}
              optional
            />
          </div>

          {showPersoneriaSection ? (
            <>
              <h3 className="clause-form-section-title">Acreditación de personería</h3>
              {readOnly ? (
                <div className="clause-form-row">
                  <div className="clause-form-col">
                    <label className="clause-form-label">Tipo</label>
                    <input className={c} readOnly value={personeriaLabel(personeria)} />
                  </div>
                </div>
              ) : (
                <div className="clause-form-row clause-form-row--inline">
                  <label className="clause-form-label-inline">
                    <input
                      type="radio"
                      name="personeria_type"
                      checked={!personeria}
                      onChange={() => onChange('personeria_type', '')}
                    />
                    Sin acreditación
                  </label>
                  <label className="clause-form-label-inline">
                    <input
                      type="radio"
                      name="personeria_type"
                      checked={personeria === 'empresa_en_un_dia'}
                      onChange={() => onChange('personeria_type', 'empresa_en_un_dia')}
                    />
                    Empresa en un Día
                  </label>
                  <label className="clause-form-label-inline">
                    <input
                      type="radio"
                      name="personeria_type"
                      checked={personeria === 'escritura_publica'}
                      onChange={() => onChange('personeria_type', 'escritura_publica')}
                    />
                    Escritura Pública
                  </label>
                </div>
              )}

              {showPersoneriaEmpresa ? (
                <div className="clause-form-row">
                  <div className="clause-form-col">
                    <label className="clause-form-label" htmlFor="sup-fecha-cert">
                      Fecha certificado estatuto actualizado
                    </label>
                    {readOnly ? (
                      <input
                        id="sup-fecha-cert"
                        className={c}
                        readOnly
                        value={formatEsDateFromIso(form.fecha_certificado_estatuto)}
                      />
                    ) : (
                      <DateInputCL
                        id="sup-fecha-cert"
                        className={c}
                        value={form.fecha_certificado_estatuto ?? ''}
                        onChange={(v) => onChange('fecha_certificado_estatuto', v)}
                      />
                    )}
                  </div>
                  <div className="clause-form-col">
                    <label className="clause-form-label" htmlFor="sup-cve">
                      Código CVE
                    </label>
                    {readOnly ? (
                      <input id="sup-cve" className={c} readOnly value={displayText(form.codigo_cve)} />
                    ) : (
                      <input
                        id="sup-cve"
                        className={c}
                        value={form.codigo_cve ?? ''}
                        onChange={(e) => onChange('codigo_cve', e.target.value)}
                      />
                    )}
                  </div>
                </div>
              ) : null}

              {showPersoneriaEscritura ? (
                <div className="clause-form-row">
                  <div className="clause-form-col">
                    <label className="clause-form-label" htmlFor="sup-fecha-esc">
                      Fecha escritura pública
                    </label>
                    {readOnly ? (
                      <input
                        id="sup-fecha-esc"
                        className={c}
                        readOnly
                        value={formatEsDateFromIso(form.fecha_escritura_publica)}
                      />
                    ) : (
                      <DateInputCL
                        id="sup-fecha-esc"
                        className={c}
                        value={form.fecha_escritura_publica ?? ''}
                        onChange={(v) => onChange('fecha_escritura_publica', v)}
                      />
                    )}
                  </div>
                  <div className="clause-form-col">
                    <label className="clause-form-label" htmlFor="sup-notaria">
                      Nombre notaría
                    </label>
                    {readOnly ? (
                      <input id="sup-notaria" className={c} readOnly value={displayText(form.nombre_notaria)} />
                    ) : (
                      <input
                        id="sup-notaria"
                        className={c}
                        value={form.nombre_notaria ?? ''}
                        onChange={(e) => onChange('nombre_notaria', e.target.value)}
                      />
                    )}
                  </div>
                  <div className="clause-form-col">
                    <label className="clause-form-label" htmlFor="sup-notario">
                      Nombre notario
                    </label>
                    {readOnly ? (
                      <input id="sup-notario" className={c} readOnly value={displayText(form.nombre_notario)} />
                    ) : (
                      <input
                        id="sup-notario"
                        className={c}
                        value={form.nombre_notario ?? ''}
                        onChange={(e) => onChange('nombre_notario', e.target.value)}
                      />
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *  form: Record<string, any>,
 *  readOnly?: boolean,
 *  fieldErrors?: Record<string, string>,
 *  onSocialNetworksChange?: (networks: Array<{ catalog_id: string, account_name: string, code?: string, name?: string }>) => void,
 *  accessToken?: string | null
 * }} props
 */
export function SupplierSocialNetworksSection({
  form,
  readOnly = false,
  fieldErrors = {},
  onSocialNetworksChange = null
}) {
  const socialNetworks = Array.isArray(form.social_networks) ? form.social_networks : []

  return (
    <div className="clause-form-section clause-form-section--separated employee-form-panel">
      <SocialNetworkSelector
        value={socialNetworks}
        onChange={readOnly ? undefined : onSocialNetworksChange}
        readOnly={readOnly}
        fieldError={fieldErrors.social_networks}
        />
    </div>
  )
}

/**
 * @param {{
 *  form: Record<string, any>,
 *  onChange: (f: string, v: any) => void,
 *  readOnly?: boolean,
 *  typeLocked?: boolean,
 *  fieldErrors?: Record<string, string>,
 *  onSocialNetworksChange?: (networks: Array<{ catalog_id: string, account_name: string, code?: string, name?: string }>) => void,
 *  accessToken?: string | null
 * }} props
 */
export function SupplierFormSections({
  form,
  onChange,
  readOnly = false,
  typeLocked = false,
  fieldErrors = {},
  onSocialNetworksChange = null,
  emailRequired = false,
  identityDocumentTypes = []
}) {
  return (
    <>
      <SupplierBasicDataSection
        form={form}
        onChange={onChange}
        readOnly={readOnly}
        typeLocked={typeLocked}
        fieldErrors={fieldErrors}
        emailRequired={emailRequired}
        identityDocumentTypes={identityDocumentTypes}
      />
      <SupplierSocialNetworksSection
        form={form}
        readOnly={readOnly}
        fieldErrors={fieldErrors}
        onSocialNetworksChange={onSocialNetworksChange}
        />
    </>
  )
}

export function supplierToForm(s) {
  if (!s) return emptySupplierForm()
  const isEmpresa = s.supplier_type === 'empresa'
  return {
    supplier_type: s.supplier_type ?? 'persona_natural',
    country_code: s.country_code ?? '',
    full_name: s.full_name ?? '',
    rut: isEmpresa ? '' : s.document_display || s.rut || '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    address: s.address ?? '',
    razon_social: s.razon_social ?? '',
    rut_empresa: isEmpresa ? s.document_display || s.rut || '' : '',
    giro: s.giro ?? '',
    direccion_empresa: s.direccion_empresa ?? '',
    nombre_rep_legal: s.nombre_rep_legal ?? '',
    rut_rep_legal: s.rep_document_display || '',
    personeria_type: s.personeria_type ?? '',
    fecha_certificado_estatuto: s.fecha_certificado_estatuto?.slice?.(0, 10) ?? s.fecha_certificado_estatuto ?? '',
    codigo_cve: s.codigo_cve ?? '',
    fecha_escritura_publica: s.fecha_escritura_publica?.slice?.(0, 10) ?? s.fecha_escritura_publica ?? '',
    nombre_notaria: s.nombre_notaria ?? '',
    nombre_notario: s.nombre_notario ?? '',
    social_networks: Array.isArray(s.social_networks)
      ? s.social_networks.map((n) => ({
          catalog_id: n.catalog_id ?? '',
          account_name: n.account_name ?? '',
          code: n.code ?? '',
          name: n.name ?? ''
        }))
      : []
  }
}

export function emptySupplierForm() {
  return {
    supplier_type: 'persona_natural',
    country_code: '',
    full_name: '',
    rut: '',
    email: '',
    phone: '',
    address: '',
    razon_social: '',
    rut_empresa: '',
    giro: '',
    direccion_empresa: '',
    nombre_rep_legal: '',
    rut_rep_legal: '',
    personeria_type: '',
    fecha_certificado_estatuto: '',
    codigo_cve: '',
    fecha_escritura_publica: '',
    nombre_notaria: '',
    nombre_notario: '',
    social_networks: []
  }
}
