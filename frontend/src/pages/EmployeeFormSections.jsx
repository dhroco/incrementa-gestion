import { formatEsDateFromIso } from './employeeFormUtils'
import './ClauseForm.css'

function inputClass(readOnly) {
  return readOnly ? 'clause-input clause-input--readonly' : 'clause-input'
}

function roInputClass(extra = '') {
  return `clause-input clause-input--readonly${extra ? ` ${extra}` : ''}`.trim()
}

function displayText(v) {
  if (v == null) return '—'
  const s = String(v).trim()
  return s === '' ? '—' : s
}

function displaySex(s) {
  if (s === 'M' || s === 'F' || s === 'X') return s
  return '—'
}

function formatMoneyReadonly(form, k) {
  const v = form[k]
  if (v != null && String(v).length) {
    return Number(String(v).replace(',', '.')).toLocaleString('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  }
  return '0'
}

/**
 * @param {{
 *  form: Record<string, any>,
 *  onChange: (f: string, v: any) => void,
 *  readOnly?: boolean,
 *  positions: Array<{ id: string, name: string, description?: string | null }>,
 *  workSchedules: Array<{ id: string, name: string }>,
 *  fieldErrors?: Record<string, string>
 * }} props
 */
export function EmployeeFormSections({ form, onChange, readOnly = false, positions = [], workSchedules = [], fieldErrors = {} }) {
  const c = inputClass(readOnly)

  return (
    <div className="clause-form-section employee-form-panel">
      <h3 className="clause-form-section-title">Identificación y contrato</h3>

      <div className="clause-form-row clause-form-row--employee-id">
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-full-name">
            Nombre completo{!readOnly ? <span className="clause-form-required"> *</span> : null}
          </label>
          <input
            id="emp-full-name"
            className={c}
            value={form.full_name ?? ''}
            onChange={(e) => onChange('full_name', e.target.value)}
            readOnly={readOnly}
            autoComplete="name"
          />
          {fieldErrors.full_name && !readOnly ? <div className="clause-field-error">{fieldErrors.full_name}</div> : null}
        </div>
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-rut">
            RUT{!readOnly ? <span className="clause-form-required"> *</span> : null}
          </label>
          <input
            id="emp-rut"
            className={c}
            value={form.rut ?? ''}
            onChange={(e) => onChange('rut', e.target.value)}
            readOnly={readOnly}
          />
          {fieldErrors.rut && !readOnly ? <div className="clause-field-error">{fieldErrors.rut}</div> : null}
        </div>
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-email">
            Correo{!readOnly ? <span className="clause-form-required"> *</span> : null}
          </label>
          {readOnly ? (
            <input
              id="emp-email"
              className={roInputClass()}
              type="text"
              readOnly
              value={displayText(form.email)}
            />
          ) : (
            <input
              id="emp-email"
              className="clause-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email ?? ''}
              onChange={(e) => onChange('email', e.target.value)}
            />
          )}
          {fieldErrors.email && !readOnly ? <div className="clause-field-error">{fieldErrors.email}</div> : null}
        </div>
      </div>

      <div className="clause-form-row clause-form-row--audit-four">
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-nationality">
            Nacionalidad
          </label>
          <input
            id="emp-nationality"
            className={c}
            value={form.nationality ?? ''}
            onChange={(e) => onChange('nationality', e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div className="clause-form-col">
          {readOnly ? (
            <label className="clause-form-label" htmlFor="emp-sex-ro">
              Sexo
            </label>
          ) : (
            <label className="clause-form-label" htmlFor="emp-sex">
              Sexo<span className="clause-form-required"> *</span>
            </label>
          )}
          {readOnly ? (
            <input id="emp-sex-ro" className={roInputClass()} type="text" readOnly value={displaySex(form.sex)} />
          ) : (
            <select
              id="emp-sex"
              className="clause-input"
              value={form.sex ?? ''}
              onChange={(e) => onChange('sex', e.target.value)}
            >
              <option value="">—</option>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="X">X</option>
            </select>
          )}
        </div>
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-marital">
            Estado civil
          </label>
          <input
            id="emp-marital"
            className={c}
            value={form.marital_status ?? ''}
            onChange={(e) => onChange('marital_status', e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-dob">
            Fecha de nacimiento{!readOnly ? <span className="clause-form-required"> *</span> : null}
          </label>
          {readOnly ? (
            <input
              id="emp-dob"
              className={roInputClass()}
              type="text"
              readOnly
              value={formatEsDateFromIso(form.dob)}
            />
          ) : (
            <>
              <input
                id="emp-dob"
                className="clause-input"
                type="date"
                value={form.dob ?? ''}
                onChange={(e) => onChange('dob', e.target.value)}
              />
              {fieldErrors.date_of_birth ? <div className="clause-field-error">{fieldErrors.date_of_birth}</div> : null}
            </>
          )}
        </div>
      </div>

      <div className="clause-form-row clause-form-row--address-line">
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-address">
            Dirección
          </label>
          <input
            id="emp-address"
            className={c}
            value={form.address ?? ''}
            onChange={(e) => onChange('address', e.target.value)}
            readOnly={readOnly}
            autoComplete="street-address"
          />
        </div>
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-commune">
            Comuna
          </label>
          <input
            id="emp-commune"
            className={c}
            value={form.commune ?? ''}
            onChange={(e) => onChange('commune', e.target.value)}
            readOnly={readOnly}
            autoComplete="address-level2"
          />
        </div>
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-city">
            Ciudad
          </label>
          <input
            id="emp-city"
            className={c}
            value={form.city ?? ''}
            onChange={(e) => onChange('city', e.target.value)}
            readOnly={readOnly}
            autoComplete="address-level1"
          />
        </div>
      </div>

      <div className="clause-form-row clause-form-row--three-equal">
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-hire">
            Fecha de ingreso{!readOnly ? <span className="clause-form-required"> *</span> : null}
          </label>
          {readOnly ? (
            <input
              id="emp-hire"
              className={roInputClass()}
              type="text"
              readOnly
              value={formatEsDateFromIso(form.hire)}
            />
          ) : (
            <>
              <input
                id="emp-hire"
                className="clause-input"
                type="date"
                value={form.hire ?? ''}
                onChange={(e) => onChange('hire', e.target.value)}
              />
              {fieldErrors.hire_date ? <div className="clause-field-error">{fieldErrors.hire_date}</div> : null}
            </>
          )}
        </div>
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-pos">
            Cargo{!readOnly ? <span className="clause-form-required"> *</span> : null}
          </label>
          {readOnly ? (
            (() => {
              const pos = positions.find((p) => p.id === form.position_id) || {}
              const d = pos.description && String(pos.description).trim() ? String(pos.description).trim() : ''
              return (
                <div className="clause-readonly-box" id="emp-pos-ro" role="textbox" aria-readonly="true" aria-label="Cargo">
                  <div>{pos.name || '—'}</div>
                  {d ? <div className="clause-line--hint">{d}</div> : null}
                </div>
              )
            })()
          ) : (
            <select
              id="emp-pos"
              className="clause-input"
              value={form.position_id ?? ''}
              onChange={(e) => onChange('position_id', e.target.value)}
            >
              <option value="">—</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id} title={p.description && String(p.description).trim() ? String(p.description).trim() : undefined}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="clause-form-col">
          <label className="clause-form-label" htmlFor="emp-ws">
            Jornada{!readOnly ? <span className="clause-form-required"> *</span> : null}
          </label>
          {readOnly ? (
            <input
              id="emp-ws"
              className={roInputClass()}
              type="text"
              readOnly
              value={displayText((workSchedules.find((w) => w.id === form.work_schedule_id) || {}).name)}
            />
          ) : (
            <select
              id="emp-ws"
              className="clause-input"
              value={form.work_schedule_id ?? ''}
              onChange={(e) => onChange('work_schedule_id', e.target.value)}
            >
              <option value="">—</option>
              {workSchedules.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <hr className="company-form-section-rule" aria-hidden="true" style={{ margin: '4px 0' }} />

      <div className="employee-remuneraciones-block">
        <div className="employee-remuneraciones-grid">
          <h3 className="clause-form-section-title employee-remuneraciones-grid__title-rem">Remuneraciones</h3>
          <h3 className="clause-form-section-title employee-remuneraciones-grid__title-prev">Previsión</h3>
          <div className="employee-remuneraciones-grid__vbar" aria-hidden="true" />
          {[
            ['base_salary', 'emp-bsal', 'Sueldo base', 'employee-remuneraciones-grid__c1r1'],
            ['gratification', 'emp-grat', 'Gratificación', 'employee-remuneraciones-grid__c2r1'],
            ['transport_allowance', 'emp-mov', 'Movilización', 'employee-remuneraciones-grid__c3r1'],
            ['meal_allowance', 'emp-col', 'Colación', 'employee-remuneraciones-grid__c1r2'],
            ['bonuses', 'emp-bon', 'Bonos', 'employee-remuneraciones-grid__c2r2'],
            ['commissions', 'emp-com', 'Comisiones', 'employee-remuneraciones-grid__c3r2']
          ].map(([k, fid, label, cellClass]) => (
            <div className={`clause-form-col ${cellClass}`} key={k}>
              <label className="clause-form-label" htmlFor={fid}>
                {label}
              </label>
              {readOnly ? (
                <input
                  id={fid}
                  className={roInputClass()}
                  type="text"
                  readOnly
                  value={formatMoneyReadonly(form, k)}
                />
              ) : (
                <input
                  id={fid}
                  className="clause-input"
                  type="text"
                  inputMode="decimal"
                  value={form[k] ?? ''}
                  onChange={(e) => onChange(k, e.target.value)}
                />
              )}
            </div>
          ))}
          <div className="clause-form-col employee-remuneraciones-grid__c5r1">
            <label className="clause-form-label" htmlFor="emp-prevision-salud">
              Previsión salud
            </label>
            {readOnly ? (
              <input
                id="emp-prevision-salud"
                className={roInputClass()}
                type="text"
                readOnly
                value={displayText(form.prevision_salud)}
              />
            ) : (
              <input
                id="emp-prevision-salud"
                className={c}
                type="text"
                value={form.prevision_salud ?? ''}
                onChange={(e) => onChange('prevision_salud', e.target.value)}
                autoComplete="off"
              />
            )}
          </div>
          <div className="clause-form-col employee-remuneraciones-grid__c5r2">
            <label className="clause-form-label" htmlFor="emp-fondo-pension">
              Fondo pensión
            </label>
            {readOnly ? (
              <input
                id="emp-fondo-pension"
                className={roInputClass()}
                type="text"
                readOnly
                value={displayText(form.fondo_pension)}
              />
            ) : (
              <input
                id="emp-fondo-pension"
                className={c}
                type="text"
                value={form.fondo_pension ?? ''}
                onChange={(e) => onChange('fondo_pension', e.target.value)}
                autoComplete="off"
              />
            )}
          </div>
        </div>
      </div>

      <hr className="company-form-section-rule" aria-hidden="true" style={{ margin: '4px 0' }} />

      <h3 className="clause-form-section-title" style={{ marginTop: 4 }}>
        Estado
      </h3>
      <div className="clause-form-row">
        {readOnly ? (
          <label className="clause-estado-activo clause-estado-activo--readonly" htmlFor="emp-activo-ro">
            <input
              id="emp-activo-ro"
              type="checkbox"
              checked={form.is_active !== false}
              disabled
              tabIndex={-1}
            />
            <span>Trabajador activo</span>
          </label>
        ) : (
          <label className="clause-estado-activo">
            <input type="checkbox" checked={form.is_active !== false} onChange={(e) => onChange('is_active', e.target.checked)} />
            <span>Trabajador activo</span>
          </label>
        )}
      </div>
    </div>
  )
}
