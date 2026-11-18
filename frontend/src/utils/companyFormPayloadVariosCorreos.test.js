import { describe, it, expect } from 'vitest'
import { isValidEmailField } from './companyFormPayload'

describe('isValidEmailField con varias direcciones', () => {
  it('acepta una o varias separadas por coma o punto y coma', () => {
    expect(isValidEmailField('')).toBe(true)
    expect(isValidEmailField('a@x.cl')).toBe(true)
    expect(isValidEmailField('a@x.cl, b@y.com')).toBe(true)
    expect(isValidEmailField('a@x.cl;b@y.com')).toBe(true)
  })
  it('rechaza si alguna es inválida', () => {
    expect(isValidEmailField('a@x.cl, malo')).toBe(false)
    expect(isValidEmailField('bad')).toBe(false)
  })
})
