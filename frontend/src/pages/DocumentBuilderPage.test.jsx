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
import { DocumentBuilderPage, buildDuplicateDraftMessage, draftStatusLabel } from './DocumentBuilderPage'
import { fetchDocumentBuilderTemplates } from '../api/documentBuilderApi'
import { ShellProvider } from '../layout/ShellProvider'
import { authReducer } from '../store/authSlice'
import { documentBuilderReducer } from '../store/documentBuilderSlice'
import { sessionCompanyReducer } from '../store/sessionCompanySlice'
import { AbilityContext, ability } from '../lib/ability'

vi.mock('../api/clientsApi', () => ({
  fetchClientsList: vi.fn(async () => ({ ok: true, data: { items: [] } }))
}))

vi.mock('../api/suppliersApi', () => ({
  fetchSuppliersList: vi.fn(async () => ({
    ok: true,
    data: {
      items: [
        {
          id: 's1',
          supplier_type: 'persona_natural',
          display_name: 'Juan Pérez',
          rut: '1-9'
        }
      ]
    }
  }))
}))

vi.mock('../api/documentBuilderApi', () => ({
  fetchDocumentBuilderTemplates: vi.fn(async () => ({
    ok: true,
    data: {
      items: [{ kind: 'standard', id: 's1', name: 'STD A' }]
    }
  })),
  postDocumentBuilderGenerate: vi.fn(async () => ({ ok: false, status: 500, message: 'no-op' })),
  downloadDocumentBuilderPdf: vi.fn(async () => new Blob([]))
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
        user: { id: 'u1' },
        enrichedCompany: { id: 'co1', business_name: 'Empresa X' },
        enrichmentStatus: 'succeeded'
      },
      sessionCompany: { assignedCompanies: [], selectedCompanyId: null },
      documentBuilder: {
        selectedSupplierId: null,
        selectedClientId: null,
        templateSelected: null,
        generatedDocuments: [],
        missingFields: {}
      }
    }
  })
}

describe('DocumentBuilderPage (template selection UX)', () => {
  it('renders standard templates section and shows selected template field', async () => {
    ability.update([
      { action: 'use', subject: 'DocumentBuilder' },
      { action: 'read', subject: 'Supplier' }
    ])
    const store = makeStore()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)

    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={store}>
            <AbilityContext.Provider value={ability}>
              <MemoryRouter initialEntries={['/app/gestion-contratos/constructor-documento']}>
                <ShellProvider>
                  <DocumentBuilderPage />
                </ShellProvider>
              </MemoryRouter>
            </AbilityContext.Provider>
          </Provider>
        )
      })
    })

    const supplierRadio = el.querySelector('input[type="radio"][name="supplier"]')
    expect(supplierRadio).toBeTruthy()
    await act(async () => {
      supplierRadio.click()
      await new Promise((r) => setTimeout(r, 0))
    })

    const html = el.innerHTML
    expect(html).toContain('Templates estándar')
    expect(html).not.toContain('Templates por empresa')
    expect(html).toContain('Plantilla seleccionada')
    expect(html).toContain('Ver preview')

    expect(fetchDocumentBuilderTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'co1',
        supplierType: 'persona_natural'
      })
    )

    root.unmount()
    document.body.removeChild(el)
  })

  it('builds duplicate draft confirmation message with translated status', () => {
    expect(draftStatusLabel('draft')).toBe('Borrador')
    expect(draftStatusLabel('pending_signature')).toBe('Pendiente de firma')
    const msg = buildDuplicateDraftMessage({
      file_name: 'contrato_prev.pdf',
      created_at: '2026-05-15T15:00:00.000Z',
      status: 'draft'
    })
    expect(msg).toContain('contrato_prev.pdf')
    expect(msg).toContain('Borrador')
    expect(msg).toContain('¿Deseas reemplazarlo?')
  })
})
