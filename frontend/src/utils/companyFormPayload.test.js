import { describe, expect, it } from 'vitest'
import {
  buildCompanyMutationPayload,
  isValidEmailField,
  validateHeadquartersForCompanySubmit
} from './companyFormPayload'

describe('companyFormPayload', () => {
  it('isValidEmailField accepts empty or whitespace-only', () => {
    expect(isValidEmailField('')).toBe(true)
    expect(isValidEmailField('   ')).toBe(true)
  })

  it('validateHeadquartersForCompanySubmit accepts valid minimal set', () => {
    const v = validateHeadquartersForCompanySubmit({
      businessName: 'Empresa',
      shortName: 'Empresa',
      rut: '76.543.210-3',
      email: 'x@y.cl',
      rutLegal1: '',
      rutLegal2: ''
    })
    expect(v.ok).toBe(true)
  })

  it('buildCompanyMutationPayload maps company fields', () => {
    const p = buildCompanyMutationPayload({
      businessName: 'E',
      rut: '76.543.210-3',
      businessActivity: 'Giro',
      address: 'Calle 1',
      commune: 'Providencia',
      city: 'Santiago',
      region: 'RM',
      email: 'a@b.cl',
      phone: '+56 9 1234 5678',
      nameLegal1: 'Rep 1',
      rutLegal1: '11.111.111-1',
      nameLegal2: '',
      rutLegal2: ''
    })
    expect(p.business_name).toBe('E')
    expect(p.business_activity).toBe('Giro')
    expect(p.commune).toBe('Providencia')
    expect(p.branches).toBeUndefined()
  })
})
