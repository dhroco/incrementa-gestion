import { describe, expect, it } from 'vitest'
import { resolveCompanyVariablePreview } from './resolveCompanyVariablePreview'

describe('resolveCompanyVariablePreview', () => {
  const base = {
    business_name: 'Acme SpA',
    rut_body: '76543210',
    rut_dv: '3',
    email: 'contacto@acme.cl',
    address: 'Av. Central 1',
    commune: 'Providencia',
    city: 'Santiago',
    region: 'RM',
    name_legal_representative_1: 'Ana Pérez',
    rut_body_legal_representative_1: '12345678',
    rut_dv_legal_representative_1: '5'
  }

  it('resolves legal name and RUT', () => {
    expect(resolveCompanyVariablePreview('company_legal_name', base)).toBe('Acme SpA')
    expect(resolveCompanyVariablePreview('company_rut', base)).toMatch(/543.*210/)
  })

  it('resolves company email', () => {
    expect(resolveCompanyVariablePreview('company_email', base)).toBe('contacto@acme.cl')
  })

  it('resolves address fields', () => {
    expect(resolveCompanyVariablePreview('company_address', base)).toBe('Av. Central 1')
    expect(resolveCompanyVariablePreview('company_commune', base)).toBe('Providencia')
    expect(resolveCompanyVariablePreview('company_region', base)).toBe('RM')
  })
})
