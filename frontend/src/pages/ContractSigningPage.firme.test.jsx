/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { ContractSigningPage } from './ContractSigningPage'
import { ShellProvider } from '../layout/ShellProvider'
import { authReducer } from '../store/authSlice'
import { AbilityContext, ability } from '../lib/ability'
import {
  fetchInSignature,
  fetchPendingSignature,
  refreshSignature,
  resendSignatureLink,
  sendToFirme,
  signContract
} from '../api/contractSigningApi'

vi.mock('../api/contractSigningApi', () => ({
  fetchPendingSignature: vi.fn(),
  fetchInSignature: vi.fn(),
  signContract: vi.fn(),
  sendToFirme: vi.fn(),
  refreshSignature: vi.fn(),
  resendSignatureLink: vi.fn(),
  fetchDraftPdfBlob: vi.fn()
}))

const suggestion = {
  first_names: 'Ana',
  last_name: 'Pérez',
  maternal_last_name: 'Soto',
  document_number: '12.345.678-5',
  email: 'ana@ejemplo.cl'
}

function pendingRow(overrides) {
  return {
    id: 'draft-1',
    supplier_name: 'Ana Pérez',
    supplier_type: 'persona_natural',
    client_name: 'Marca',
    company_short_name: 'INC',
    company_name: 'Incrementa SpA',
    company_email: 'empresa@incrementa.cl',
    template_name: 'Contrato influencer',
    fecha_contrato: '2026-10-01',
    created_at: '2026-10-01T15:00:00.000Z',
    signing_mode: 'internal',
    signee_suggestion: suggestion,
    ...overrides
  }
}

function attemptRow(overrides) {
  return {
    id: 'draft-x',
    supplier_name: 'Proveedor',
    signee_first_name: 'Ana',
    signee_last_name: 'Pérez',
    signee_maternal_last_name: 'Soto',
    signee_rut: '12.345.678-5',
    signee_email: 'ana@ejemplo.cl',
    status: 'pending_signature',
    approved_at: '2026-10-02T15:00:00.000Z',
    last_error_message: null,
    rejection_reason: null,
    ...overrides
  }
}

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

async function renderPage() {
  ability.update([{ action: 'sign', subject: 'Contract' }])
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => {
    flushSync(() => {
      root.render(
        <Provider store={makeStore()}>
          <AbilityContext.Provider value={ability}>
            <MemoryRouter initialEntries={['/app/gestion-contratos/firma-documento']}>
              <ShellProvider>
                <ContractSigningPage />
              </ShellProvider>
            </MemoryRouter>
          </AbilityContext.Provider>
        </Provider>
      )
    })
  })
  await act(async () => {
    for (let i = 0; i < 20 && el.textContent.includes('Cargando'); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  })
  return {
    el,
    unmount() {
      root.unmount()
      el.remove()
      ability.update([])
    }
  }
}

function buttonByText(root, text) {
  return [...root.querySelectorAll('button')].find((button) => button.textContent.trim() === text)
}

function rowBySupplier(root, name) {
  return [...root.querySelectorAll('tbody tr')].find((row) => row.textContent.includes(name))
}

function rowButtonTexts(root, name) {
  const row = rowBySupplier(root, name)
  return [...row.querySelectorAll('button')].map((button) => button.textContent.trim())
}

async function clickButton(root, text) {
  const button = buttonByText(root, text)
  expect(button).toBeTruthy()
  await act(async () => {
    button.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return button
}

async function checkAuthorization(root) {
  const box = root.querySelector('input[type="checkbox"]')
  expect(box).toBeTruthy()
  await act(async () => {
    box.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('ContractSigningPage Firme', () => {
  beforeEach(() => {
    fetchPendingSignature.mockReset()
    fetchInSignature.mockReset()
    signContract.mockReset()
    sendToFirme.mockReset()
    refreshSignature.mockReset()
    resendSignatureLink.mockReset()
    fetchPendingSignature.mockResolvedValue({ ok: true, data: { items: [] } })
    fetchInSignature.mockResolvedValue({ ok: true, data: { items: [] }, meta: {} })
  })

  it('keeps the internal sign button disabled until the checkbox is checked', async () => {
    fetchPendingSignature.mockResolvedValue({
      ok: true,
      data: { items: [pendingRow({ signing_mode: 'internal' })] }
    })
    signContract.mockResolvedValue({
      ok: true,
      data: { documentId: 'doc-1', companyEmail: 'empresa@incrementa.cl' }
    })
    const view = await renderPage()

    await clickButton(view.el, 'Firmar')
    const signButton = buttonByText(view.el, 'Firmar y enviar email')
    expect(signButton.disabled).toBe(true)

    await checkAuthorization(view.el)
    expect(buttonByText(view.el, 'Firmar y enviar email').disabled).toBe(false)
    await clickButton(view.el, 'Firmar y enviar email')

    expect(signContract).toHaveBeenCalledWith('draft-1', {})
    expect(view.el.textContent).toContain('Contrato firmado. Email enviado a empresa@incrementa.cl')
    expect(view.el.textContent).toContain('No hay contratos pendientes de firma.')
    expect(rowBySupplier(view.el, 'Ana Pérez')).toBeUndefined()
    view.unmount()
  })

  it('sends a Firme contract only after the checkbox and shows the in-process message', async () => {
    fetchPendingSignature.mockResolvedValue({
      ok: true,
      data: { items: [pendingRow({ id: 'draft-firme', signing_mode: 'firme', supplier_name: 'Bea Soto' })] }
    })
    sendToFirme.mockResolvedValue({ ok: true, data: { status: 'pending_signature' } })
    const view = await renderPage()

    await clickButton(view.el, 'Firmar')
    const approve = buttonByText(view.el, 'Aprobar y enviar a firma')
    expect(approve.disabled).toBe(true)
    expect(view.el.textContent).toContain('Al confirmar, usted aprueba este contrato en representación de')
    expect(view.el.textContent).toContain('Incrementa SpA')
    expect(view.el.querySelector('input[type="checkbox"] + span').textContent).toBe(
      'He revisado el contrato y autorizo su envío a firma'
    )

    await checkAuthorization(view.el)
    expect(buttonByText(view.el, 'Aprobar y enviar a firma').disabled).toBe(false)
    await clickButton(view.el, 'Aprobar y enviar a firma')

    expect(sendToFirme).toHaveBeenCalledWith(
      'draft-firme',
      {
        firstName: 'Ana',
        lastName: 'Pérez',
        maternalLastName: 'Soto',
        documentNumber: '12.345.678-5',
        email: 'ana@ejemplo.cl'
      },
      {}
    )
    expect(view.el.textContent).toContain('Contrato en proceso de firma.')
    expect(view.el.textContent).not.toContain('Contrato firmado.')
    expect(rowBySupplier(view.el, 'Bea Soto')).toBeUndefined()
    view.unmount()
  })

  it('keeps a Firme error inside the modal and the row on the list', async () => {
    fetchPendingSignature.mockResolvedValue({
      ok: true,
      data: { items: [pendingRow({ id: 'draft-err', signing_mode: 'firme', supplier_name: 'Cora Díaz' })] }
    })
    sendToFirme.mockResolvedValue({ ok: false, message: 'Firme no aceptó el RUT del firmante.' })
    const view = await renderPage()

    await clickButton(view.el, 'Firmar')
    await checkAuthorization(view.el)
    await clickButton(view.el, 'Aprobar y enviar a firma')

    expect(view.el.querySelector('[role="dialog"]').textContent).toContain('Firme no aceptó el RUT del firmante.')
    expect(rowBySupplier(view.el, 'Cora Díaz')).toBeTruthy()
    view.unmount()
  })

  it('disables signing when production is blocked and still offers the PDF', async () => {
    fetchPendingSignature.mockResolvedValue({
      ok: true,
      data: { items: [pendingRow({ signing_mode: 'blocked', supplier_name: 'Dina Ruiz' })] }
    })
    const view = await renderPage()
    const row = rowBySupplier(view.el, 'Dina Ruiz')
    const blocked = [...row.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Firma deshabilitada: Firme aún no está configurado en producción.')
    )
    const pdf = [...row.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Ver PDF')
    expect(blocked.disabled).toBe(true)
    expect(pdf.disabled).toBe(false)
    view.unmount()
  })

  it('limits resend actions to the spec matrix and refreshes through the backend', async () => {
    const items = [
      attemptRow({ id: 'p1', supplier_name: 'Pendiente', status: 'pending_signature' }),
      attemptRow({ id: 'e1', supplier_name: 'Vencido', status: 'expired' }),
      attemptRow({
        id: 'r1',
        supplier_name: 'Rechazado',
        status: 'rejected',
        rejection_reason: 'No acepto el monto',
        signee_first_name: 'Luz',
        signee_email: 'luz@ejemplo.cl'
      }),
      attemptRow({ id: 'c1', supplier_name: 'Cancelado', status: 'cancelled' }),
      attemptRow({
        id: 'f1',
        supplier_name: 'Fallido',
        status: 'send_failed',
        last_error_message: 'Sin créditos de firma.'
      }),
      attemptRow({ id: 'h1', supplier_name: 'Huella', status: 'hash_mismatch' }),
      attemptRow({ id: 's1', supplier_name: 'Enviando', status: 'sending' })
    ]
    fetchInSignature.mockResolvedValue({
      ok: true,
      data: { items },
      meta: { credits: 10 }
    })
    refreshSignature.mockResolvedValue({ ok: true, data: { status: 'pending_signature' } })
    resendSignatureLink.mockResolvedValue({ ok: true, data: { status: 'pending_signature' } })
    const view = await renderPage()
    await clickButton(view.el, 'En firma')

    expect(view.el.textContent).toContain('Créditos de firma disponibles: 10')
    expect(view.el.textContent).toContain('Saldo bajo de créditos de firma.')
    expect(rowButtonTexts(view.el, 'Pendiente')).toEqual(['Actualizar estado', 'Reenviar enlace', 'Ver PDF'])
    expect(rowButtonTexts(view.el, 'Vencido')).toEqual(['Actualizar estado', 'Renovar enlace', 'Ver PDF'])
    expect(rowButtonTexts(view.el, 'Rechazado')).toEqual(['Actualizar estado', 'Reenviar a firma', 'Ver PDF'])
    expect(rowButtonTexts(view.el, 'Cancelado')).toEqual(['Actualizar estado', 'Reenviar a firma', 'Ver PDF'])
    expect(rowButtonTexts(view.el, 'Fallido')).toEqual(['Actualizar estado', 'Reenviar a firma', 'Ver PDF'])
    expect(rowButtonTexts(view.el, 'Huella')).toEqual(['Actualizar estado', 'Ver PDF'])
    expect(rowButtonTexts(view.el, 'Enviando')).toEqual(['Ver PDF'])
    expect(rowBySupplier(view.el, 'Rechazado').textContent).toContain('No acepto el monto')
    expect(rowBySupplier(view.el, 'Fallido').textContent).toContain('Sin créditos de firma.')
    expect(rowBySupplier(view.el, 'Pendiente').textContent).toContain('En proceso de firma')
    expect(rowBySupplier(view.el, 'Huella').textContent).toContain('Requiere revisión')

    const pendingRowEl = rowBySupplier(view.el, 'Pendiente')
    await act(async () => {
      pendingRowEl.querySelector('button').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(refreshSignature).toHaveBeenCalledWith('p1', {})
    expect(view.el.textContent).not.toContain('Contrato firmado.')

    const expiredRow = rowBySupplier(view.el, 'Vencido')
    const renew = [...expiredRow.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Renovar enlace')
    await act(async () => {
      renew.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(resendSignatureLink).toHaveBeenCalledWith('e1', {})

    const rejectedRow = rowBySupplier(view.el, 'Rechazado')
    const resend = [...rejectedRow.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Reenviar a firma')
    await act(async () => {
      resend.click()
    })
    expect(view.el.textContent).toContain('Esto usará 1 crédito nuevo de firma.')
    const names = [...view.el.querySelectorAll('label.clause-field input')].map((input) => input.value)
    expect(names).toContain('Luz')
    expect(names).toContain('luz@ejemplo.cl')
    view.unmount()
  })

  it('shows Contrato firmado only when refresh reaches signed', async () => {
    fetchInSignature.mockResolvedValue({
      ok: true,
      data: { items: [attemptRow({ id: 'p9', supplier_name: 'Lista', status: 'pending_signature' })] },
      meta: { credits: 11 }
    })
    refreshSignature.mockResolvedValue({ ok: true, data: { status: 'signed' } })
    const view = await renderPage()
    await clickButton(view.el, 'En firma')
    expect(view.el.textContent).toContain('Créditos de firma disponibles: 11')
    expect(view.el.textContent).not.toContain('Saldo bajo de créditos de firma.')

    const row = rowBySupplier(view.el, 'Lista')
    await act(async () => {
      row.querySelector('button').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(refreshSignature).toHaveBeenCalledWith('p9', {})
    expect(view.el.textContent).toContain('Contrato firmado.')
    expect(rowBySupplier(view.el, 'Lista')).toBeUndefined()
    view.unmount()
  })

  it('omits the credit line when the backend does not send a balance', async () => {
    fetchInSignature.mockResolvedValue({
      ok: true,
      data: { items: [] },
      meta: {}
    })
    const view = await renderPage()
    await clickButton(view.el, 'En firma')
    expect(view.el.textContent).not.toContain('Créditos de firma disponibles')
    expect(view.el.textContent).toContain('No hay contratos en proceso de firma.')
    view.unmount()
  })
})
