import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  /** @type {string | null} */
  selectedSupplierId: null,
  /** @type {string | null} */
  selectedClientId: null,
  /** @type {{ kind: 'standard' | 'company', id: string } | null} */
  templateSelected: null,
  /** @type {{ id: string, supplier_id: string, file_name: string }[]} */
  generatedDocuments: [],
  /** @type {Record<string, string>} */
  missingFields: {}
}

export const documentBuilderSlice = createSlice({
  name: 'documentBuilder',
  initialState,
  reducers: {
    setSelectedSupplierId(state, action) {
      const id = action.payload != null ? String(action.payload) : ''
      state.selectedSupplierId = id || null
    },
    setSelectedClientId(state, action) {
      const id = action.payload != null ? String(action.payload) : ''
      state.selectedClientId = id || null
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
      state.selectedSupplierId = null
      state.selectedClientId = null
      state.templateSelected = null
      state.generatedDocuments = []
      state.missingFields = {}
    }
  }
})

export const {
  setSelectedSupplierId,
  setSelectedClientId,
  setTemplateSelected,
  setGeneratedDocuments,
  setMissingField,
  clearMissingFields,
  resetDocumentBuilder
} = documentBuilderSlice.actions

export const documentBuilderReducer = documentBuilderSlice.reducer
