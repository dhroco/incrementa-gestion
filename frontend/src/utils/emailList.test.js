import { describe, it, expect } from 'vitest'
import { emailListToLines, emailListToStored, parseEmailList } from './emailList'
import { buildCompanyMutationPayload } from './companyFormPayload'

describe('emailList', () => {
  it('separa por coma, punto y coma, saltos de línea y espacios, sin repetidas', () => {
    expect(parseEmailList('a@x.cl, b@x.cl;c@x.cl\nA@X.cl')).toEqual(['a@x.cl', 'b@x.cl', 'c@x.cl'])
    expect(parseEmailList('')).toEqual([])
    expect(parseEmailList(null)).toEqual([])
  })
  it('muestra una por línea y guarda separadas por coma', () => {
    expect(emailListToLines('yerko@x.cl, marcela@x.cl')).toBe('yerko@x.cl\nmarcela@x.cl')
    expect(emailListToStored('yerko@x.cl\nmarcela@x.cl\n')).toBe('yerko@x.cl, marcela@x.cl')
    expect(emailListToStored('solo@x.cl')).toBe('solo@x.cl')
  })
  it('el payload de empresa guarda el correo normalizado, o null si está vacío', () => {
    const base = {
      businessName: 'B', shortName: 'S', rut: '1-9', businessActivity: '', address: '', commune: '',
      city: '', region: '', phone: '', nameLegal1: '', rutLegal1: '', nameLegal2: '', rutLegal2: ''
    }
    expect(buildCompanyMutationPayload({ ...base, email: 'a@x.cl\nb@x.cl' }).email).toBe('a@x.cl, b@x.cl')
    expect(buildCompanyMutationPayload({ ...base, email: '  ' }).email).toBeNull()
  })
})
