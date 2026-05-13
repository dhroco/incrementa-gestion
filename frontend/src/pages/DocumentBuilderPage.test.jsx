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
import { DocumentBuilderPage } from './DocumentBuilderPage'
import { ShellProvider } from '../layout/ShellProvider'
import { authReducer } from '../store/authSlice'
import { documentBuilderReducer } from '../store/documentBuilderSlice'
import { sessionCompanyReducer } from '../store/sessionCompanySlice'

vi.mock('../api/employeesApi', () => ({
  fetchEmployeesList: vi.fn(async () => ({
    ok: true,
    data: { items: [{ id: 'e1', full_name: 'Juan Pérez', rut: '1-9' }] },
  })),
}))

vi.mock('../api/documentBuilderApi', () => ({
  fetchDocumentBuilderTemplates: vi.fn(async () => ({
    ok: true,
    data: {
      items: [
        { kind: 'standard', id: 's1', name: 'STD A' },
        { kind: 'company', id: 'c1', name: 'EMP A' },
      ],
    },
  })),
  postDocumentBuilderGenerate: vi.fn(async () => ({ ok: false, status: 500, message: 'no-op' })),
  downloadDocumentBuilderPdf: vi.fn(async () => new Blob([])),
}))

vi.mock('./useEmployeeCompanyScope', () => ({
  useEmployeeCompanyScope: () => ({ companyId: 'co1', blocked: false, message: null }),
}))

function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      documentBuilder: documentBuilderReducer,
      sessionCompany: sessionCompanyReducer,
    },
    preloadedState: {
      auth: {
        initialized: true,
        globalMessage: null,
        session: { access_token: 't', user: { id: 'u1' } },
        user: { id: 'u1' },
        enrichedCompany: { id: 'co1', business_name: 'Empresa X' },
        enrichedNavigation: { tree: [], routes: [], grantedCodes: ['NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO'] },
        enrichmentStatus: 'succeeded',
      },
      sessionCompany: { assignedCompanies: [], selectedCompanyId: null },
      documentBuilder: {
        workersSelected: [],
        templateSelected: null,
        generatedDocuments: [],
        missingFields: {},
      },
    },
  })
}

describe('DocumentBuilderPage (template selection UX)', () => {
  it('renders templates separated in two sections and shows selected template field', async () => {
    const store = makeStore()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)

    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={store}>
            <MemoryRouter initialEntries={['/app/gestion-contratos/constructor-documento']}>
              <ShellProvider>
                <DocumentBuilderPage />
              </ShellProvider>
            </MemoryRouter>
          </Provider>
        )
      })
    })

    // Select one employee to unlock stage 2 (radio list).
    const checkboxes = el.querySelectorAll('input[type="checkbox"]')
    // 0 = "Seleccionar todos", 1 = first employee row
    const firstEmployeeCheckbox = checkboxes?.[1]
    expect(firstEmployeeCheckbox).toBeTruthy()
    await act(async () => {
      firstEmployeeCheckbox.click()
      await new Promise((r) => setTimeout(r, 0))
    })

    const html = el.innerHTML
    expect(html).toContain('Templates estándar')
    expect(html).toContain('Templates por empresa')
    expect(html).toContain('Plantilla seleccionada')
    expect(html).toContain('Ver preview')

    root.unmount()
    document.body.removeChild(el)
  })
})

