/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import {
  SupplierBasicDataSection,
  buildSupplierFormPayload,
  emptySupplierForm,
  supplierToForm
} from './SupplierFormSections'

function renderSection(form, props = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    flushSync(() => {
      root.render(
        <SupplierBasicDataSection form={form} onChange={() => {}} emailRequired {...props} />
      )
    })
  })
  return {
    container,
    unmount() {
      root.unmount()
      container.remove()
    }
  }
}

const personaReady = {
  ...emptySupplierForm(),
  country_code: 'CL',
  rut: '12.345.678-5',
  email: 'ana@x.cl',
  first_names: 'María José',
  last_name: 'Pérez',
  maternal_last_name: 'Soto',
  full_name: 'No debe viajar'
}

const empresaReady = {
  ...emptySupplierForm(),
  supplier_type: 'empresa',
  country_code: 'CL',
  razon_social: 'Acme SpA',
  rut_empresa: '76.543.210-3',
  email: 'rep@acme.cl'
}

describe('supplier name part fields', () => {
  it('shows three persona natural boxes and does not show Nombre completo', () => {
    const view = renderSection(personaReady)
    expect(view.container.querySelector('label[for="sup-first-names"]')?.textContent).toMatch(/Nombres/)
    expect(view.container.querySelector('label[for="sup-last-name"]')?.textContent).toMatch(/Apellido paterno/)
    expect(view.container.querySelector('label[for="sup-maternal-last-name"]')?.textContent).toMatch(
      /Apellido materno/
    )
    expect(view.container.querySelector('label[for="sup-first-names"] .clause-form-required')).toBeTruthy()
    expect(view.container.querySelector('label[for="sup-last-name"] .clause-form-required')).toBeTruthy()
    expect(view.container.querySelector('label[for="sup-maternal-last-name"] .clause-form-required')).toBeNull()
    expect(view.container.textContent).not.toContain('Nombre completo')
    view.unmount()
  })

  it('shows the same three boxes for the legal representative', () => {
    const view = renderSection(empresaReady)
    expect(view.container.querySelector('label[for="sup-rep-first-names"]')?.textContent).toMatch(/Nombres/)
    expect(view.container.querySelector('label[for="sup-rep-last-name"]')?.textContent).toMatch(/Apellido paterno/)
    expect(view.container.querySelector('label[for="sup-rep-maternal-last-name"]')?.textContent).toMatch(
      /Apellido materno/
    )
    expect(view.container.textContent).toContain('Representante legal')
    expect(view.container.querySelector('label[for="sup-rep-maternal-last-name"] .clause-form-required')).toBeNull()
    view.unmount()
  })

  it('uses the same boxes in read-only view', () => {
    const form = supplierToForm({
      supplier_type: 'persona_natural',
      first_names: 'María José',
      last_name: 'Pérez',
      maternal_last_name: 'Soto',
      full_name: 'María José Pérez Soto'
    })
    const view = renderSection(form, { readOnly: true, emailRequired: false })
    expect(view.container.querySelector('#sup-first-names')?.value).toBe('María José')
    expect(view.container.querySelector('#sup-last-name')?.value).toBe('Pérez')
    expect(view.container.querySelector('#sup-maternal-last-name')?.value).toBe('Soto')
    expect(view.container.querySelector('.clause-form-required')).toBeNull()
    view.unmount()
  })

  it('fills the boxes from an existing supplier detail', () => {
    const form = supplierToForm({
      supplier_type: 'persona_natural',
      first_names: 'María José',
      last_name: 'Pérez',
      maternal_last_name: 'Soto',
      full_name: 'María José Pérez Soto'
    })
    expect(form.full_name).toBe('María José Pérez Soto')
    const view = renderSection(form)
    expect(view.container.querySelector('#sup-first-names')?.value).toBe('María José')
    expect(view.container.querySelector('#sup-last-name')?.value).toBe('Pérez')
    expect(view.container.querySelector('#sup-maternal-last-name')?.value).toBe('Soto')
    view.unmount()
  })

  it('splits a composed name when the detail omits the parts', () => {
    const form = supplierToForm({
      supplier_type: 'persona_natural',
      full_name: 'Ana de la Fuente Soto'
    })
    expect(form.full_name).toBe('Ana de la Fuente Soto')
    expect(form.first_names).toBe('Ana')
    expect(form.last_name).toBe('de la Fuente')
    expect(form.maternal_last_name).toBe('Soto')
    expect(emptySupplierForm().full_name).toBe('')
    expect(emptySupplierForm().first_names).toBe('')
  })

  it('sends persona natural parts and omits full_name', () => {
    const built = buildSupplierFormPayload(personaReady, { emailRequired: true })
    expect(built.ok).toBe(true)
    expect(built.payload.first_names).toBe('María José')
    expect(built.payload.last_name).toBe('Pérez')
    expect(built.payload.maternal_last_name).toBe('Soto')
    expect(Object.prototype.hasOwnProperty.call(built.payload, 'full_name')).toBe(false)
  })

  it('omits representative name keys when the three boxes are empty', () => {
    const built = buildSupplierFormPayload(empresaReady, { emailRequired: true })
    expect(built.ok).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(built.payload, 'rep_first_names')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(built.payload, 'rep_last_name')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(built.payload, 'rep_maternal_last_name')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(built.payload, 'nombre_rep_legal')).toBe(false)
  })

  it('requires given names or paternal surname when only the maternal surname is typed', () => {
    const built = buildSupplierFormPayload(
      { ...empresaReady, rep_maternal_last_name: 'Soto' },
      { emailRequired: true }
    )
    expect(built.ok).toBe(false)
    const messages = Object.values(built.fieldErrors).join(' ')
    expect(
      messages.includes('Los nombres son obligatorios.') ||
        messages.includes('El apellido paterno es obligatorio.')
    ).toBe(true)
  })
})
