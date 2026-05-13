import { describe, expect, it } from 'vitest'
import { branchesToPayload, emptyBranchRow } from './CompanyFormSections'

describe('CompanyFormSections helpers', () => {
  it('emptyBranchRow provides a stable key and empty strings', () => {
    const row = emptyBranchRow()
    expect(typeof row.key).toBe('string')
    expect(row.key.length).toBeGreaterThan(0)
    expect(row.name).toBe('')
    expect(row.email).toBe('')
  })

  it('branchesToPayload trims strings and maps nullables', () => {
    const payload = branchesToPayload([
      {
        key: 'k1',
        name: '  Suc  ',
        address: ' x ',
        commune: '',
        city: null,
        region: ' RM ',
        email: 'a@b.co',
        phone: '  '
      }
    ])
    expect(payload).toEqual([
      {
        name: 'Suc',
        address: 'x',
        commune: null,
        city: null,
        region: 'RM',
        email: 'a@b.co',
        phone: null
      }
    ])
  })
})
