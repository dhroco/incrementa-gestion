/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import {
  SupplierBasicDataSection,
  emptySupplierForm,
  validateSupplierEmail,
  validateSupplierPhone
} from './SupplierFormSections'

describe('supplier contact validation', () => {
  it('requires email on create and accepts empty on edit', () => {
    expect(validateSupplierEmail('', { required: true })).toBe('El correo es obligatorio.')
    expect(validateSupplierEmail('   ', { required: true })).toBe('El correo es obligatorio.')
    expect(validateSupplierEmail('', { required: false })).toBeNull()
    expect(validateSupplierEmail('Ana.Gomez@Agencia.CL', { required: true })).toBeNull()
    expect(validateSupplierEmail('no-es-correo', { required: true })).toBe(
      'El correo no tiene un formato válido.'
    )
    expect(validateSupplierEmail('no-es-correo', { required: true })?.includes('no-es-correo')).toBe(
      false
    )
  })

  it('accepts typed foreign phone and rejects letters', () => {
    expect(validateSupplierPhone('')).toBeNull()
    expect(validateSupplierPhone('+52 55 1234 5678')).toBeNull()
    expect(validateSupplierPhone('abc-1234')).toBe('El teléfono no tiene un formato válido.')
    expect(validateSupplierPhone('abc-1234')?.includes('abc-1234')).toBe(false)
  })

  it('renders contact fields for persona natural', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const form = { ...emptySupplierForm(), full_name: 'Ana' }

    await act(async () => {
      flushSync(() => {
        root.render(
          <SupplierBasicDataSection
            form={form}
            onChange={() => {}}
            emailRequired
          />
        )
      })
    })

    expect(container.querySelector('#sup-email')).toBeTruthy()
    expect(container.querySelector('#sup-phone')).toBeTruthy()
    expect(container.querySelector('label[for="sup-email"]')?.textContent).toMatch(/^Correo/)
    expect(container.querySelector('label[for="sup-email"]')?.textContent).not.toMatch(
      /representante legal/
    )
    expect(container.querySelector('.clause-form-hint')).toBeNull()
    expect(container.querySelector('.clause-form-required')).toBeTruthy()

    root.unmount()
    container.remove()
  })

  it('labels email as legal representative mailbox for empresa', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const form = { ...emptySupplierForm(), supplier_type: 'empresa', razon_social: 'Acme SpA' }

    await act(async () => {
      flushSync(() => {
        root.render(
          <SupplierBasicDataSection
            form={form}
            onChange={() => {}}
            emailRequired
          />
        )
      })
    })

    expect(container.querySelector('label[for="sup-email"]')?.textContent).toMatch(
      /Correo del representante legal/
    )
    expect(container.querySelector('.clause-form-hint')?.textContent).toMatch(/firmará el contrato/)

    root.unmount()
    container.remove()
  })

  it('does not mark email required in read-only view', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      flushSync(() => {
        root.render(
          <SupplierBasicDataSection
            form={emptySupplierForm()}
            onChange={() => {}}
            readOnly
            emailRequired={false}
          />
        )
      })
    })

    expect(container.querySelector('#sup-email')?.value).toBe('—')
    expect(container.querySelector('.clause-form-required')).toBeNull()

    root.unmount()
    container.remove()
  })
})
