import { describe, it, expect } from 'vitest'
import { documentBuilderSlice, setWorkersSelected, toggleWorkerId, setTemplateSelected } from './documentBuilderSlice'

describe('documentBuilderSlice', () => {
  it('toggles worker ids', () => {
    let state = documentBuilderSlice.reducer(undefined, { type: '@@INIT' })
    state = documentBuilderSlice.reducer(state, toggleWorkerId('a'))
    state = documentBuilderSlice.reducer(state, toggleWorkerId('b'))
    state = documentBuilderSlice.reducer(state, toggleWorkerId('a'))
    expect(state.workersSelected).toEqual(['b'])
  })

  it('setWorkersSelected replaces list', () => {
    let state = documentBuilderSlice.reducer(undefined, setWorkersSelected(['x', 'y']))
    expect(state.workersSelected).toEqual(['x', 'y'])
    state = documentBuilderSlice.reducer(state, setWorkersSelected([]))
    expect(state.workersSelected).toEqual([])
  })

  it('setTemplateSelected stores kind and id', () => {
    const state = documentBuilderSlice.reducer(undefined, setTemplateSelected({ kind: 'standard', id: 't1' }))
    expect(state.templateSelected).toEqual({ kind: 'standard', id: 't1' })
  })
})
