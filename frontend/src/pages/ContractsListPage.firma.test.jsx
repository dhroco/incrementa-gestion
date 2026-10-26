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
          id: 'c-draft',
          source: 'draft',
          supplier_name: 'Borrador',
          status: 'draft',
          file_name: 'a.pdf',
          gcs_path: 'contratos/a.pdf'
        },
        {
          id: 'c-firma',
          source: 'draft',
          supplier_name: 'En firma',
          status: 'in_signature',
          file_name: 'b.pdf',
          gcs_path: 'contratos/b.pdf'
        },
        {
          id: 'c-signed',
          source: 'signed',
          supplier_name: 'Cerrado',
          status: 'signed',
          file_name: 'c.pdf',
          gcs_path: 'contratos-firmados/c.pdf'
        }
      ],
      pagination: { page: 1, pageSize: 18, total: 3, totalPages: 1 }
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

function chipFor(root, supplier) {
  const row = [...root.querySelectorAll('tbody tr')].find((item) => item.textContent.includes(supplier))
  return row.querySelector('.contracts-status-badge').textContent
}

describe('ContractsListPage firma', () => {
  it('shows the in-signature chip and keeps the draft filter label', async () => {
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
      for (let i = 0; i < 20 && !el.textContent.includes('En firma'); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    })

    expect(chipFor(el, 'Borrador')).toBe('En proceso')
    expect(chipFor(el, 'En firma')).toBe('En proceso de firma')
    expect(chipFor(el, 'Cerrado')).toBe('Firmado')

    const statusSelect = [...el.querySelectorAll('select')].find((select) =>
      [...select.options].some((option) => option.value === 'in_signature')
    )
    const options = [...statusSelect.options].map((option) => ({ value: option.value, label: option.textContent }))
    expect(options).toEqual([
      { value: 'all', label: 'Todos' },
      { value: 'draft', label: 'En proceso de firma' },
      { value: 'in_signature', label: 'En proceso de firma' },
      { value: 'signed', label: 'Firmados' }
    ])

    root.unmount()
    el.remove()
    ability.update([])
  })
})
