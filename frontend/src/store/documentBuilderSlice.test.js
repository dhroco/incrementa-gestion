import { describe, it, expect } from 'vitest'
import {
  documentBuilderSlice,
  setSelectedSupplierId,
  setSelectedClientId,
  setTemplateSelected
} from './documentBuilderSlice'

describe('documentBuilderSlice', () => {
  it('setSelectedSupplierId stores supplier id', () => {
    let state = documentBuilderSlice.reducer(undefined, setSelectedSupplierId('s1'))
    expect(state.selectedSupplierId).toBe('s1')
    state = documentBuilderSlice.reducer(state, setSelectedSupplierId(null))
    expect(state.selectedSupplierId).toBeNull()
  })

  it('setSelectedClientId stores client id', () => {
    let state = documentBuilderSlice.reducer(undefined, setSelectedClientId('c1'))
    expect(state.selectedClientId).toBe('c1')
    state = documentBuilderSlice.reducer(state, setSelectedClientId(null))
    expect(state.selectedClientId).toBeNull()
  })

  it('setTemplateSelected stores kind and id', () => {
    const state = documentBuilderSlice.reducer(undefined, setTemplateSelected({ kind: 'standard', id: 't1' }))
    expect(state.templateSelected).toEqual({ kind: 'standard', id: 't1' })
  })
})
