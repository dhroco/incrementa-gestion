/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { DocumentBuilderPreviewPage } from './DocumentBuilderPreviewPage'
import { ShellProvider } from '../layout/ShellProvider'
import { authReducer } from '../store/authSlice'
import { documentBuilderReducer } from '../store/documentBuilderSlice'
import { sessionCompanyReducer } from '../store/sessionCompanySlice'
import { AbilityContext, ability } from '../lib/ability'

vi.mock('../api/standardTemplatesApi', () => ({
  fetchStandardTemplateById: vi.fn(async () => ({
    ok: true,
    data: {
      id: 's1',
      name: 'STD A',
      content_json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }] },
    },
  })),
}))

vi.mock('./usePlatformAdminCompanyScope', () => ({
  usePlatformAdminCompanyScope: () => ({ companyId: 'co1', blocked: false, message: null })
}))

function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      documentBuilder: documentBuilderReducer,
      sessionCompany: sessionCompanyReducer
    },
    preloadedState: {
      auth: {
        initialized: true,
        globalMessage: null,
        session: { accessToken: 't', user: { id: 'u1' }, company: { id: 'co1', business_name: 'Empresa X' } },
        user: { id: 'u1' },
        enrichmentStatus: 'succeeded',
      },
      sessionCompany: { assignedCompanies: [], selectedCompanyId: null },
      documentBuilder: {
        selectedSupplierId: 's1',
        selectedClientId: null,
        templateSelected: { kind: 'standard', id: 's1' },
        generatedDocuments: [],
        missingFields: {}
      }
    },
  })
}

describe('DocumentBuilderPreviewPage', () => {
  it('renders preview screen title and breadcrumb labels', async () => {
    ability.update([{ action: 'use', subject: 'DocumentBuilder' }])
    const store = makeStore()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)

    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={store}>
            <AbilityContext.Provider value={ability}>
              <MemoryRouter initialEntries={['/app/gestion-contratos/constructor-documento/preview']}>
                <ShellProvider>
                  <DocumentBuilderPreviewPage />
                </ShellProvider>
              </MemoryRouter>
            </AbilityContext.Provider>
          </Provider>
        )
      })
    })

    const html = el.innerHTML
    expect(html).toContain('STD A')

    root.unmount()
    document.body.removeChild(el)
  })
})

