import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import '../styles/shared-form.css'

function inputClass(readOnly) {
  return readOnly ? 'clause-input clause-input--readonly' : 'clause-input'
}

function displayText(v) {
  if (v == null) return '—'
  const s = String(v).trim()
  return s === '' ? '—' : s
}

export function productCampaignsForSubmit(list) {
  return (Array.isArray(list) ? list : [])
    .map((row) => ({ name: String(row?.name || '').trim() }))
    .filter((row) => row.name)
}

/**
 * @param {{
 *  form: Record<string, any>,
 *  onChange: (field: string, value: unknown) => void,
 *  readOnly?: boolean,
 *  fieldErrors?: Record<string, string>,
 *  onProductCampaignsChange?: (rows: Array<{ name: string }>) => void
 * }} props
 */
function ClientFieldCol({ label, error, children }) {
  return (
    <div className="clause-form-col">
      <label className="clause-field">
        <span className="clause-field-label">{label}</span>
        {children}
        {error ? <span className="clause-field-error">{error}</span> : null}
      </label>
    </div>
  )
}

export function ClientBasicDataSection({ form, onChange, readOnly = false, fieldErrors = {} }) {
  return (
    <div className="clause-form-section clause-form-section--separated employee-form-panel">
      <div className="clause-form-row clause-form-row--three-col">
        <ClientFieldCol label="Nombre" error={fieldErrors.name}>
          {readOnly ? (
            <div className={inputClass(true)}>{displayText(form.name)}</div>
          ) : (
            <input
              type="text"
              className={inputClass(false)}
              value={form.name ?? ''}
              onChange={(e) => onChange('name', e.target.value)}
            />
          )}
        </ClientFieldCol>
        <ClientFieldCol label="Marca" error={fieldErrors.brand}>
          {readOnly ? (
            <div className={inputClass(true)}>{displayText(form.brand)}</div>
          ) : (
            <input
              type="text"
              className={inputClass(false)}
              value={form.brand ?? ''}
              onChange={(e) => onChange('brand', e.target.value)}
            />
          )}
        </ClientFieldCol>
        <ClientFieldCol label="Cuenta marca">
          {readOnly ? (
            <div className={inputClass(true)}>{displayText(form.brand_account)}</div>
          ) : (
            <input
              type="text"
              className={inputClass(false)}
              value={form.brand_account ?? ''}
              onChange={(e) => onChange('brand_account', e.target.value)}
              placeholder="Ej: @marca"
            />
          )}
        </ClientFieldCol>
      </div>
    </div>
  )
}

/**
 * @param {{
 *  form: Record<string, any>,
 *  readOnly?: boolean,
 *  fieldErrors?: Record<string, string>,
 *  onProductCampaignsChange?: (rows: Array<{ name: string }>) => void
 * }} props
 */
export function ClientProductCampaignsSection({
  form,
  readOnly = false,
  fieldErrors = {},
  onProductCampaignsChange
}) {
  const campaigns = Array.isArray(form.product_campaigns) ? form.product_campaigns : []

  function updateRow(index, name) {
    if (!onProductCampaignsChange) return
    const next = campaigns.map((row, i) => (i === index ? { ...row, name } : row))
    onProductCampaignsChange(next)
  }

  function removeRow(index) {
    if (!onProductCampaignsChange) return
    onProductCampaignsChange(campaigns.filter((_, i) => i !== index))
  }

  function addRow() {
    if (!onProductCampaignsChange) return
    onProductCampaignsChange([...campaigns, { name: '' }])
  }

  if (readOnly) {
    if (campaigns.length === 0) {
      return <p className="client-campaigns-empty">No hay productos/campañas registrados.</p>
    }
    return (
      <ul className="client-campaigns-readonly">
        {campaigns.map((row, i) => (
          <li key={row.id || `c-${i}`} className="client-campaigns-readonly-item">
            {displayText(row.name)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="clause-form-section clause-form-section--separated employee-form-panel">
      {fieldErrors.product_campaigns ? (
        <div className="clause-field-error">{fieldErrors.product_campaigns}</div>
      ) : null}
      <div className="client-campaigns-editor">
        {campaigns.length === 0 ? (
          <p className="client-campaigns-empty">Sin productos/campañas. Use «Agregar producto/campaña» para añadir una fila.</p>
        ) : (
          campaigns.map((row, i) => (
            <div key={`edit-${i}`} className="client-campaigns-row">
              <input
                type="text"
                className="clause-input"
                value={row.name ?? ''}
                onChange={(e) => updateRow(i, e.target.value)}
                placeholder="Nombre del producto/campaña"
                aria-label={`Producto/Campaña ${i + 1}`}
              />
              <button
                type="button"
                className="clause-table-remove-btn"
                onClick={() => removeRow(i)}
                aria-label="Eliminar producto/campaña"
                title="Eliminar producto/campaña"
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} aria-hidden />
              </button>
            </div>
          ))
        )}
        <button type="button" className="btn" onClick={addRow}>
          Agregar producto/campaña
        </button>
      </div>
    </div>
  )
}

export function clientToForm(c) {
  if (!c) return emptyClientForm()
  return {
    name: c.name ?? '',
    brand: c.brand ?? '',
    brand_account: c.brand_account ?? '',
    product_campaigns: Array.isArray(c.product_campaigns)
      ? c.product_campaigns.map((row) => ({ name: row.name ?? '' }))
      : []
  }
}

export function emptyClientForm() {
  return {
    name: '',
    brand: '',
    brand_account: '',
    product_campaigns: []
  }
}

/**
 * Layout único para Crear, Editar y Ver: dos bloques apilados (sin pestañas).
 */
export function ClientFormPageStack({
  form,
  readOnly = false,
  onChange,
  fieldErrors = {},
  onProductCampaignsChange
}) {
  const basicProps = readOnly
    ? { form, onChange: () => {}, readOnly: true, fieldErrors }
    : { form, onChange, fieldErrors }
  const campaignsProps = readOnly
    ? { form, readOnly: true, fieldErrors }
    : { form, fieldErrors, onProductCampaignsChange }

  return (
    <div className="company-form-page-stack">
      <div className="ph-card clause-card company-form-block-card">
        <h2 className="company-form-block-title">Datos del cliente</h2>
        <div className="clause-form">
          <ClientBasicDataSection {...basicProps} />
        </div>
      </div>
      <div className="ph-card clause-card company-form-block-card">
        <h2 className="company-form-block-title">Productos/Campañas</h2>
        <div className="clause-form">
          <ClientProductCampaignsSection {...campaignsProps} />
        </div>
      </div>
    </div>
  )
}
