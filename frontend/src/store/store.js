import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from './authSlice'
import { sessionCompanyReducer } from './sessionCompanySlice'
import { documentBuilderReducer } from './documentBuilderSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sessionCompany: sessionCompanyReducer,
    documentBuilder: documentBuilderReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'auth/fetchEnrichedSession/pending',
          'auth/fetchEnrichedSession/fulfilled',
          'auth/fetchEnrichedSession/rejected'
        ],
        ignoredPaths: ['auth.user']
      }
    })
})
