import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  /** @type {string[]} */
  workersSelected: [],
  /** @type {{ kind: 'standard' | 'company', id: string } | null} */
  templateSelected: null,
  /** @type {{ id: string, employee_id: string, file_name: string }[]} */
  generatedDocuments: [],
  /** @type {Record<string, string>} */
  missingFields: {}
}

export const documentBuilderSlice = createSlice({
  name: 'documentBuilder',
  initialState,
  reducers: {
    toggleWorkerId(state, action) {
      const id = String(action.payload || '')
      if (!id) return
      const set = new Set(state.workersSelected)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      state.workersSelected = [...set]
    },
    setWorkersSelected(state, action) {
      state.workersSelected = Array.isArray(action.payload) ? action.payload.map(String) : []
    },
    setTemplateSelected(state, action) {
      state.templateSelected = action.payload ?? null
    },
    setGeneratedDocuments(state, action) {
      state.generatedDocuments = Array.isArray(action.payload) ? action.payload : []
    },
    setMissingField(state, action) {
      const key = typeof action.payload?.key === 'string' ? action.payload.key : ''
      const value = typeof action.payload?.value === 'string' ? action.payload.value : ''
      if (!key) return
      state.missingFields[key] = value
    },
    clearMissingFields(state) {
      state.missingFields = {}
    },
    resetDocumentBuilder(state) {
      state.workersSelected = []
      state.templateSelected = null
      state.generatedDocuments = []
      state.missingFields = {}
    }
  }
})

export const {
  toggleWorkerId,
  setWorkersSelected,
  setTemplateSelected,
  setGeneratedDocuments,
  setMissingField,
  clearMissingFields,
  resetDocumentBuilder
} = documentBuilderSlice.actions

export const documentBuilderReducer = documentBuilderSlice.reducer
