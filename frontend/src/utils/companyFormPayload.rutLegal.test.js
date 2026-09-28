import { describe, expect, it } from 'vitest'
import { validateHeadquartersForCompanySubmit } from './companyFormPayload'

const DV_MISMATCH = 'El dígito verificador no corresponde al RUT ingresado.'
const REJECTED = { ok: false, message: DV_MISMATCH }

const BASE = {
  businessName: 'Dynamics Corp. SpA',
  shortName: 'Dynamics',
  rut: '76.123.456-0',
  email: '',
  rutLegal1: '',
  rutLegal2: ''
}

describe('validateHeadquartersForCompanySubmit legal representative RUT', () => {
  it.each([
    {
      label: 'rejects a mistyped digit on legal representative 1',
      rutLegal1: '12.345.678-9',
      rutLegal2: '',
      expected: REJECTED
    },
    {
      label: 'rejects a mistyped digit on legal representative 2',
      rutLegal1: '',
      rutLegal2: '12.345.678-9',
      expected: REJECTED
    },
    {
      label: 'reads eight digits without a hyphen as body plus digit',
      rutLegal1: '12345678',
      rutLegal2: '',
      expected: REJECTED
    },
    {
      label: 'accepts a matching digit on legal representative 1',
      rutLegal1: '12.345.678-5',
      rutLegal2: '',
      expected: { ok: true }
    },
    {
      label: 'accepts a matching digit on legal representative 2',
      rutLegal1: '',
      rutLegal2: '12.345.678-5',
      expected: { ok: true }
    },
    {
      label: 'accepts both legal representatives empty',
      rutLegal1: '',
      rutLegal2: '',
      expected: { ok: true }
    },
    {
      label: 'rejects a mistyped second representative when the first is valid',
      rutLegal1: '12.345.678-5',
      rutLegal2: '12.345.678-9',
      expected: REJECTED
    }
  ])('$label', ({ rutLegal1, rutLegal2, expected }) => {
    const result = validateHeadquartersForCompanySubmit({
      ...BASE,
      rutLegal1,
      rutLegal2
    })
    expect(result).toEqual(expected)
  })
})
