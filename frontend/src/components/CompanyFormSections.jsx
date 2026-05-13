/* eslint-disable react-refresh/only-export-components -- helpers (emptyBranchRow, mapApiBranchToRow, branchesToPayload) shared with pages */
import { Link } from 'react-router-dom'

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function emptyBranchRow() {
  return {
    key: newKey(),
    id: undefined,
    name: '',
    address: '',
    commune: '',
    city: '',
    region: '',
    email: '',
    phone: ''
  }
}

export function mapApiBranchToRow(b) {
  return {
    key: b.id || newKey(),
    id: b.id,
    name: b.name ?? '',
    address: b.address ?? '',
    commune: b.commune ?? '',
    city: b.city ?? '',
    region: b.region ?? '',
    email: b.email ?? '',
    phone: b.phone ?? ''
  }
}

export function branchesToPayload(rows) {
  return rows.map((r) => ({
    name: r.name.trim(),
    address: r.address?.trim() || null,
    commune: r.commune?.trim() || null,
    city: r.city?.trim() || null,
    region: r.region?.trim() || null,
    email: r.email?.trim() || null,
    phone: r.phone?.trim() || null
  }))
}

/**
 * Sección con separadores horizontales opcionales (sin caja con borde).
 * Por defecto regla arriba y abajo; ajustar `ruleAfter`/`ruleBefore` para evitar dobles líneas entre bloques.
 */
export function FormSection({ title, children, ruleBefore = true, ruleAfter = true }) {
  return (
    <section className="clause-form-section clause-form-section--separated">
      {ruleBefore ? <hr className="company-form-section-rule" aria-hidden="true" /> : null}
      <h3 className="clause-form-section-title">{title}</h3>
      <div className="clause-form-section-body">{children}</div>
      {ruleAfter ? <hr className="company-form-section-rule" aria-hidden="true" /> : null}
    </section>
  )
}

/**
 * Tabla de sucursales. Si `branchEditorBasePath` está definido y no es solo lectura,
 * alta/edición navega a rutas hijas bajo esa base (área de trabajo).
 */
export function BranchTableEditor({ rows, readOnly = false, branchEditorBasePath = null }) {
  const base = branchEditorBasePath ? String(branchEditorBasePath).replace(/\/$/, '') : ''
  const useWorkArea = Boolean(base && !readOnly)

  return (
    <div className="company-branch-editor company-branch-editor--separated">
      <div className="clause-form-section-title-row">
        <h3 className="clause-form-section-title">Sucursales</h3>
        {!readOnly && useWorkArea ? (
          <Link className="clause-link-button" to={`${base}/sucursales/nueva`}>
            Agregar Sucursal
          </Link>
        ) : null}
      </div>
      <div className="clause-list-table-wrap company-branch-table-wrap">
        <table className="clause-list-table company-branch-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Dirección</th>
              <th>Correo</th>
              <th>Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="clause-list-empty">
                  No hay sucursales registradas.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {readOnly ? (
                      <span>{row.name || '—'}</span>
                    ) : useWorkArea ? (
                      <Link className="company-branch-name-link" to={`${base}/sucursales/${encodeURIComponent(row.key)}`}>
                        {row.name || '—'}
                      </Link>
                    ) : (
                      <span>{row.name || '—'}</span>
                    )}
                  </td>
                  <td>{row.address || '—'}</td>
                  <td>{row.email || '—'}</td>
                  <td>{row.phone || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** @deprecated Usar BranchTableEditor */
export function BranchListEditor(props) {
  return <BranchTableEditor {...props} />
}
