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

vi.mock('../api/companyTemplatesApi', () => ({
  fetchCompanyTemplateById: vi.fn(async () => ({
    ok: true,
    data: {
      id: 'c1',
      name: 'EMP A',
      content_json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }] },
    },
  })),
}))

vi.mock('../api/clauseResolveReadBatcher', () => ({
  resolveClauseContentReadBatched: vi.fn(async () => ({ ok: true, content_json: { type: 'doc', content: [] } })),
}))

vi.mock('./useEmployeeCompanyScope', () => ({
  useEmployeeCompanyScope: () => ({ companyId: 'co1', blocked: false, message: null }),
}))

function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      documentBuilder: documentBuilderReducer,
    },
    preloadedState: {
      auth: {
        initialized: true,
        globalMessage: null,
        session: { access_token: 't', user: { id: 'u1' }, company: { id: 'co1', business_name: 'Empresa X' } },
        user: { id: 'u1' },
        enrichedNavigation: { tree: [], routes: [], grantedCodes: ['NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO'] },
        enrichmentStatus: 'succeeded',
      },
      documentBuilder: {
        workersSelected: ['e1'],
        templateSelected: { kind: 'standard', id: 's1' },
        generatedDocuments: [],
        missingFields: {},
      },
    },
  })
}

describe('DocumentBuilderPreviewPage', () => {
  it('renders preview screen title and breadcrumb labels', async () => {
    const store = makeStore()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)

    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={store}>
            <MemoryRouter initialEntries={['/app/gestion-contratos/constructor-documento/preview']}>
              <ShellProvider>
                <DocumentBuilderPreviewPage />
              </ShellProvider>
            </MemoryRouter>
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

