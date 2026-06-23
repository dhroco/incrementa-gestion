import { describe, expect, it } from 'vitest'
import { formDirtySnapshot, isFormDirty } from './formDirtySnapshot'

describe('formDirtySnapshot', () => {
  it('detects when fields change', () => {
    const baseline = formDirtySnapshot({ name: 'Contrato', code: 'C-1' })
    expect(isFormDirty(baseline, { name: 'Contrato', code: 'C-1' })).toBe(false)
    expect(isFormDirty(baseline, { name: 'Otro', code: 'C-1' })).toBe(true)
  })

  it('returns false when baseline is null', () => {
    expect(isFormDirty(null, { name: 'x' })).toBe(false)
  })
})
