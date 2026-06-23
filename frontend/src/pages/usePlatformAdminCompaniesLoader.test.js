import { describe, expect, it } from 'vitest'
import { mapCompaniesFromApi } from './usePlatformAdminCompaniesLoader'

describe('mapCompaniesFromApi', () => {
  it('maps list items to session company shape', () => {
    expect(
      mapCompaniesFromApi([
        { id: 'c1', business_name: 'Uno' },
        { id: 'c2', business_name: null },
        { id: 3 },
        null
      ])
    ).toEqual([
      { id: 'c1', business_name: 'Uno' },
      { id: 'c2', business_name: null }
    ])
  })

  it('returns empty array for non-array input', () => {
    expect(mapCompaniesFromApi(null)).toEqual([])
  })
})
