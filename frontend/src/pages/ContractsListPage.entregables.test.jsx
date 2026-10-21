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
import { ContractsListPage } from './ContractsListPage'
import { ShellProvider } from '../layout/ShellProvider'
import { authReducer } from '../store/authSlice'
import { AbilityContext, ability } from '../lib/ability'

vi.mock('../api/clientsApi', () => ({
  fetchClientsList: vi.fn(async () => ({ ok: true, data: { items: [] } }))
}))

vi.mock('../api/suppliersApi', () => ({
  fetchSuppliersList: vi.fn(async () => ({ ok: true, data: { items: [] } }))
}))

vi.mock('../api/standardTemplatesApi', () => ({
  fetchStandardTemplatesList: vi.fn(async () => ({ ok: true, data: { items: [] } }))
}))

vi.mock('../api/contractsApi', () => ({
  fetchContracts: vi.fn(async () => ({
    ok: true,
    data: {
      items: [
        {
          id: 'c-entregables',
          source: 'draft',
          supplier_name: 'Ana',
          client_name: 'Marca',
          template_name: 'Contrato',
          servicios_entregables: 'cinco (5) reels en TikTok y cuatro (4) reels en Facebook',
          proveedor_red_social: 'Instagram',
          proveedor_cuenta_social: '@ana',
          status: 'draft',
          file_name: 'a.pdf',
          gcs_path: 'contratos/a.pdf'
        },
        {
          id: 'c-red',
          source: 'signed',
          supplier_name: 'Bea',
          client_name: 'Marca',
          template_name: 'Contrato',
          proveedor_red_social: 'Instagram',
          proveedor_cuenta_social: '@acme',
          status: 'signed',
          file_name: 'b.pdf',
          gcs_path: 'contratos/b.pdf'
        }
      ],
      pagination: { page: 1, pageSize: 18, total: 2, totalPages: 1 }
    }
  })),
  fetchContractPdfBlob: vi.fn()
}))

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        initialized: true,
        globalMessage: null,
        user: { id: 'u1' },
        enrichmentStatus: 'succeeded',
        enrichedCompany: null
      }
    }
  })
}

describe('ContractsListPage entregables', () => {
  it('shows servicios_entregables when present and the network when absent', async () => {
    ability.update([{ action: 'read', subject: 'Contract' }])
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)

    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={makeStore()}>
            <AbilityContext.Provider value={ability}>
              <MemoryRouter initialEntries={['/app/gestion-contratos/consulta-contratos']}>
                <ShellProvider>
                  <ContractsListPage />
                </ShellProvider>
              </MemoryRouter>
            </AbilityContext.Provider>
          </Provider>
        )
      })
    })

    await act(async () => {
      for (let i = 0; i < 20 && !el.textContent.includes('cinco (5) reels'); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    })

    const cells = [...el.querySelectorAll('tbody td:nth-child(4)')].map((cell) => cell.textContent)
    expect(cells).toContain('cinco (5) reels en TikTok y cuatro (4) reels en Facebook')
    expect(cells).toContain('Instagram — @acme')
    expect(el.querySelector('th:nth-child(4)').textContent).toBe('Red social')

    root.unmount()
    el.remove()
    ability.update([])
  })
})
