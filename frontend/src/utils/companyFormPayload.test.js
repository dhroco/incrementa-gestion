import { describe, expect, it } from 'vitest'
import {
  branchesClientValidationOk,
  buildCompanyMutationPayload,
  isValidEmailField,
  validateHeadquartersForCompanySubmit,
  validateSignificantBranchesForSubmit
} from './companyFormPayload'

describe('companyFormPayload', () => {
  it('validateSignificantBranchesForSubmit rejects invalid branch email', () => {
    const branches = [
      {
        key: 'k1',
        name: 'Sucursal',
        address: 'x',
        commune: '',
        city: '',
        region: '',
        email: 'not-an-email',
        phone: ''
      }
    ]
    const v = validateSignificantBranchesForSubmit(branches)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.message).toContain('sucursal')
  })

  it('branchesClientValidationOk is false for invalid branch email', () => {
    const ok = branchesClientValidationOk([
      { key: 'k1', name: 'N', address: 'a', commune: '', city: '', region: '', email: 'bad', phone: '' }
    ])
    expect(ok).toBe(false)
  })

  it('isValidEmailField accepts empty or whitespace-only', () => {
    expect(isValidEmailField('')).toBe(true)
    expect(isValidEmailField('   ')).toBe(true)
  })

  it('validateHeadquartersForCompanySubmit accepts valid minimal set', () => {
    const v = validateHeadquartersForCompanySubmit({
      businessName: 'Empresa',
      rut: '76.543.210-3',
      email: 'x@y.cl',
      rutLegal1: '',
      rutLegal2: ''
    })
    expect(v.ok).toBe(true)
  })

  it('buildCompanyMutationPayload maps branches', () => {
    const p = buildCompanyMutationPayload({
      businessName: 'E',
      rut: '76.543.210-3',
      businessActivity: '',
      address: '',
      commune: '',
      city: '',
      region: '',
      email: 'a@b.cl',
      phone: '',
      nameLegal1: '',
      rutLegal1: '',
      nameLegal2: '',
      rutLegal2: '',
      significantBranches: [{ key: 'k', name: ' S1 ', address: ' Calle ', commune: '', city: '', region: '', email: '', phone: '' }]
    })
    expect(p.branches).toEqual([
      {
        name: 'S1',
        address: 'Calle',
        commune: null,
        city: null,
        region: null,
        email: null,
        phone: null
      }
    ])
  })
})
