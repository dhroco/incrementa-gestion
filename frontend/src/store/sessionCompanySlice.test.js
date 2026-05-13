import { beforeEach, describe, expect, it } from 'vitest'
import { sessionCompanyReducer, hydrateAccountantCompanyContext, setSelectedCompanyId } from './sessionCompanySlice'

function createMemoryStorage() {
  const data = {}
  return {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null
    },
    setItem(k, v) {
      data[k] = String(v)
    },
    removeItem(k) {
      delete data[k]
    },
    clear() {
      for (const key of Object.keys(data)) delete data[key]
    }
  }
}

describe('sessionCompanyReducer', () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage()
    globalThis.sessionStorage = createMemoryStorage()
  })

  it('hydrateAccountantCompanyContext selects first company when nothing stored', () => {
    const state = sessionCompanyReducer(
      undefined,
      hydrateAccountantCompanyContext({
        userId: 'u1',
        assignedCompanies: [
          { id: 'a', business_name: 'A' },
          { id: 'b', business_name: 'B' }
        ]
      })
    )
    expect(state.assignedCompanies).toHaveLength(2)
    expect(state.selectedCompanyId).toBe('a')
  })

  it('hydrateAccountantCompanyContext restores selection from localStorage when still assigned', () => {
    localStorage.setItem('gfa-selected-company:u1', 'b')
    const state = sessionCompanyReducer(
      undefined,
      hydrateAccountantCompanyContext({
        userId: 'u1',
        assignedCompanies: [
          { id: 'a', business_name: 'A' },
          { id: 'b', business_name: 'B' }
        ]
      })
    )
    expect(state.selectedCompanyId).toBe('b')
  })

  it('hydrateAccountantCompanyContext ignores localStorage id not in assigned list and rewrites storage', () => {
    localStorage.setItem('gfa-selected-company:u1', 'revoked')
    const state = sessionCompanyReducer(
      undefined,
      hydrateAccountantCompanyContext({
        userId: 'u1',
        assignedCompanies: [{ id: 'a', business_name: 'A' }]
      })
    )
    expect(state.selectedCompanyId).toBe('a')
    expect(localStorage.getItem('gfa-selected-company:u1')).toBe('a')
  })

  it('setSelectedCompanyId updates selection', () => {
    let state = sessionCompanyReducer(
      undefined,
      hydrateAccountantCompanyContext({
        userId: 'u1',
        assignedCompanies: [{ id: 'a', business_name: 'A' }]
      })
    )
    state = sessionCompanyReducer(state, setSelectedCompanyId({ userId: 'u1', companyId: 'a' }))
    expect(state.selectedCompanyId).toBe('a')
    expect(localStorage.getItem('gfa-selected-company:u1')).toBe('a')
  })
})
