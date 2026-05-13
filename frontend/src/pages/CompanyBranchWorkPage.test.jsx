/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Suspense, useMemo, useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { CompanyBranchWorkPage } from './CompanyBranchWorkPage'
import { ShellProvider } from '../layout/ShellProvider'
import { store } from '../store/store'
import { SubheaderActionsDump } from './__testonly__/SubheaderActionsDump'
import * as companiesApi from '../api/companiesApi'

vi.mock('../api/companiesApi', () => ({
  updateCompany: vi.fn()
}))

function EditOutletLayout() {
  const [branches] = useState([
    { key: 'b1', id: 'br-1', name: 'S Norte', address: 'X', commune: '', city: '', region: '', email: '', phone: '' }
  ])
  const setBranches = vi.fn()
  const ctx = useMemo(
    () => ({
      variant: 'edit',
      listPath: '/empresas',
      parentEditPath: '/edit',
      branches,
      setBranches,
      businessName: 'ACME SpA',
      rut: '76.543.210-3',
      businessActivity: '',
      address: '',
      commune: '',
      city: '',
      region: '',
      email: 'contacto@acme.cl',
      phone: '',
      nameLegal1: '',
      rutLegal1: '',
      nameLegal2: '',
      rutLegal2: '',
      companyId: 'c99',
      accessToken: 'token',
      allowedToEdit: true
    }),
    [branches, setBranches]
  )
  return (
    <Suspense fallback={null}>
      <Outlet context={ctx} />
    </Suspense>
  )
}

function renderBranchEdit() {
  const router = createMemoryRouter(
    [
      {
        path: '/edit',
        element: <EditOutletLayout />,
        children: [{ path: 'sucursales/:branchKey', element: <CompanyBranchWorkPage mode="edit" /> }]
      }
    ],
    { initialEntries: ['/edit/sucursales/b1'] }
  )
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => {
    root.render(
      <Provider store={store}>
        <ShellProvider>
          <SubheaderActionsDump />
          <RouterProvider router={router} />
        </ShellProvider>
      </Provider>
    )
  })
  return { root, el, router }
}

describe('CompanyBranchWorkPage', () => {
  beforeEach(() => {
    vi.mocked(companiesApi.updateCompany).mockReset()
  })

  it('delete cancel does not call updateCompany', async () => {
    const { root, el } = renderBranchEdit()
    const dump = () => document.querySelector('[data-testid="subheader-actions-dump"]')
    await act(async () => {
      const del = [...(dump()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes('Eliminar sucursal'))
      expect(del).toBeTruthy()
      del?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      const modal = document.querySelector('.gc-modal')
      const cancel = modal?.querySelector('button.clause-nav-button')
      expect(cancel?.textContent).toBe('Cancelar')
      cancel?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(companiesApi.updateCompany).not.toHaveBeenCalled()
    root.unmount()
    document.body.removeChild(el)
  })

  it('delete confirm calls updateCompany without the removed branch', async () => {
    vi.mocked(companiesApi.updateCompany).mockResolvedValue({
      ok: true,
      data: { branches: [] }
    })
    const { root, el } = renderBranchEdit()
    const dump = () => document.querySelector('[data-testid="subheader-actions-dump"]')
    await act(async () => {
      const del = [...(dump()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes('Eliminar sucursal'))
      del?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      const modal = document.querySelector('.gc-modal')
      const confirm = modal?.querySelector('button.clause-nav-button--danger')
      expect(confirm?.textContent).toBe('Eliminar')
      confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(companiesApi.updateCompany).toHaveBeenCalledTimes(1)
    const [, body] = vi.mocked(companiesApi.updateCompany).mock.calls[0]
    expect(body.branches).toEqual([])
    root.unmount()
    document.body.removeChild(el)
  })
})
