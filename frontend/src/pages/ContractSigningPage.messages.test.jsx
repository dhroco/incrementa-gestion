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

const FIRMADO = 'Contrato firmado.'
const EN_PROCESO = 'Contrato en proceso de firma.'

// Con timers simulados no se pueden usar los helpers que esperan un setTimeout real.
async function clickWithFakeTimers(root, text) {
  const button = buttonByText(root, text)
  expect(button).toBeTruthy()
  await act(async () => {
    button.click()
    await vi.advanceTimersByTimeAsync(0)
  })
}

function modalConfirmButton(root) {
  const buttons = [...root.querySelectorAll('.gc-modal__footer button')]
  return buttons[buttons.length - 1]
}

async function openInternalModal(response, pendingMeta) {
  fetchPendingSignature.mockResolvedValue({
    ok: true,
    data: { items: [pendingRow({ signing_mode: 'internal' })] },
    ...(pendingMeta ? { meta: pendingMeta } : {})
  })
  signContract.mockResolvedValue(response)
  const view = await renderPage()
  await clickButton(view.el, 'Firmar')
  return view
}

describe('ContractSigningPage mensajes de firma', () => {
  beforeEach(() => {
    vi.useRealTimers()
    fetchPendingSignature.mockReset()
    fetchInSignature.mockReset()
    signContract.mockReset()
    sendToFirme.mockReset()
    refreshSignature.mockReset()
    resendSignatureLink.mockReset()
    fetchPendingSignature.mockResolvedValue({ ok: true, data: { items: [] } })
    fetchInSignature.mockResolvedValue({ ok: true, data: { items: [] }, meta: {} })
  })

  it('aprobar y enviar a Firme dice «en proceso de firma» y nunca «Contrato firmado.»', async () => {
    fetchPendingSignature.mockResolvedValue({
      ok: true,
      data: { items: [pendingRow({ id: 'draft-firme', signing_mode: 'firme', supplier_name: 'Bea Soto' })] }
    })
    sendToFirme.mockResolvedValue({ ok: true, data: { status: 'pending_signature' } })
    const view = await renderPage()
    await clickButton(view.el, 'Firmar')
    await checkAuthorization(view.el)
    await clickButton(view.el, 'Aprobar y enviar a firma')
    expect(view.el.textContent).toContain(EN_PROCESO)
    expect(view.el.textContent).not.toContain(FIRMADO)
    expect(view.el.textContent).not.toContain('Email enviado')
    view.unmount()
  })

  it('camino interno con emailSent true: «en proceso de firma» y «Email enviado a {correo}»', async () => {
    const view = await openInternalModal({
      ok: true,
      data: { documentId: 'doc-1', companyEmail: 'empresa@incrementa.cl', emailSent: true }
    })
    await checkAuthorization(view.el)
    await clickButton(view.el, 'Firmar y enviar email')
    expect(view.el.textContent).toContain(`${EN_PROCESO} Email enviado a empresa@incrementa.cl.`)
    expect(view.el.textContent).not.toContain(FIRMADO)
    view.unmount()
  })

  it('camino interno con emailSent false o ausente: sin «Email enviado» y sin «Contrato firmado.»', async () => {
    for (const data of [
      { documentId: 'doc-1', companyEmail: 'empresa@incrementa.cl', emailSent: false },
      { documentId: 'doc-1', companyEmail: 'empresa@incrementa.cl' }
    ]) {
      const view = await openInternalModal({ ok: true, data })
      await checkAuthorization(view.el)
      await clickButton(view.el, 'Firmar y enviar email')
      expect(view.el.textContent).toContain(EN_PROCESO)
      expect(view.el.textContent).not.toContain('Email enviado')
      expect(view.el.textContent).not.toContain(FIRMADO)
      view.unmount()
    }
  })

  it('«Contrato firmado.» aparece cuando «Actualizar estado» devuelve un intento signed, y el contrato sale de la tabla', async () => {
    fetchInSignature.mockResolvedValue({
      ok: true,
      data: { items: [attemptRow({ id: 'p1', supplier_name: 'Pendiente', status: 'pending_signature' })] },
      meta: { credits: 40 }
    })
    refreshSignature.mockResolvedValue({ ok: true, data: { status: 'signed' } })
    const view = await renderPage()
    await clickButton(view.el, 'En firma')
    expect(view.el.textContent).not.toContain(FIRMADO)
    await act(async () => {
      rowBySupplier(view.el, 'Pendiente').querySelector('button').click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(view.el.textContent).toContain(FIRMADO)
    expect(rowBySupplier(view.el, 'Pendiente')).toBeUndefined()
    view.unmount()
  })

  it('«Contrato firmado.» también aparece si la carga de «En firma» trae un intento que pasó a signed', async () => {
    fetchInSignature.mockResolvedValue({
      ok: true,
      data: {
        items: [
          attemptRow({ id: 'p1', supplier_name: 'Ya firmado', status: 'signed' }),
          attemptRow({ id: 'p2', supplier_name: 'Sigue pendiente', status: 'pending_signature' })
        ]
      },
      meta: { credits: 40 }
    })
    const view = await renderPage()
    await clickButton(view.el, 'En firma')
    expect(view.el.textContent).toContain(FIRMADO)
    expect(rowBySupplier(view.el, 'Ya firmado')).toBeUndefined()
    expect(rowBySupplier(view.el, 'Sigue pendiente')).toBeTruthy()
    view.unmount()
  })

  it('sin intentos firmados, la carga de «En firma» no dice «Contrato firmado.»', async () => {
    fetchInSignature.mockResolvedValue({
      ok: true,
      data: { items: [attemptRow({ id: 'p1', supplier_name: 'Pendiente', status: 'pending_signature' })] },
      meta: { credits: 40 }
    })
    const view = await renderPage()
    await clickButton(view.el, 'En firma')
    expect(view.el.textContent).not.toContain(FIRMADO)
    view.unmount()
  })

  it('modal con email_enabled true: nota con el correo y botón «Firmar y enviar email»', async () => {
    const view = await openInternalModal({ ok: true, data: {} }, { email_enabled: true })
    expect(view.el.textContent).toContain('y se enviará al correo')
    expect(view.el.textContent).toContain('empresa@incrementa.cl')
    expect(modalConfirmButton(view.el).textContent.trim()).toBe('Firmar y enviar email')
    view.unmount()
  })

  it('modal con meta ausente se trata como email_enabled true', async () => {
    const view = await openInternalModal({ ok: true, data: {} })
    expect(view.el.textContent).toContain('y se enviará al correo')
    expect(modalConfirmButton(view.el).textContent.trim()).toBe('Firmar y enviar email')
    view.unmount()
  })

  it('modal con email_enabled false: sin hablar de correo y botón «Firmar» / «Firmando…»', async () => {
    let finish
    signContract.mockReset()
    fetchPendingSignature.mockResolvedValue({
      ok: true,
      data: { items: [pendingRow({ signing_mode: 'internal' })] },
      meta: { email_enabled: false }
    })
    signContract.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const view = await renderPage()
    await clickButton(view.el, 'Firmar')
    const note = view.el.querySelector('.contract-sign-confirm-note').textContent
    expect(note).toBe('Al confirmar, usted firma este documento en representación de Incrementa SpA.')
    expect(view.el.textContent).not.toContain('se enviará al correo')
    expect(view.el.textContent).not.toContain('Firmar y enviar email')
    expect(modalConfirmButton(view.el).textContent.trim()).toBe('Firmar')

    await checkAuthorization(view.el)
    await act(async () => {
      modalConfirmButton(view.el).click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(modalConfirmButton(view.el).textContent.trim()).toBe('Firmando…')
    await act(async () => {
      finish({ ok: true, data: { documentId: 'doc-1', companyEmail: 'empresa@incrementa.cl', emailSent: false } })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(view.el.textContent).toContain(EN_PROCESO)
    expect(view.el.textContent).not.toContain('Email enviado')
    view.unmount()
  })

  it('el mensaje desaparece a los 8 segundos', async () => {
    const view = await openInternalModal({
      ok: true,
      data: { documentId: 'doc-1', companyEmail: 'empresa@incrementa.cl', emailSent: true }
    })
    await checkAuthorization(view.el)
    vi.useFakeTimers()
    try {
      await clickWithFakeTimers(view.el, 'Firmar y enviar email')
      expect(view.el.textContent).toContain(EN_PROCESO)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(7900)
      })
      expect(view.el.textContent).toContain(EN_PROCESO)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200)
      })
      expect(view.el.textContent).not.toContain(EN_PROCESO)
    } finally {
      vi.useRealTimers()
    }
    view.unmount()
  })

  it('en ninguna parte de la pantalla aparece «Contrato firmado» sin que Firme haya completado la firma', async () => {
    const view = await openInternalModal({ ok: true, data: { documentId: 'doc-1', emailSent: true } })
    expect(view.el.textContent).not.toContain('Contrato firmado')
    await checkAuthorization(view.el)
    expect(view.el.textContent).not.toContain('Contrato firmado')
    view.unmount()
  })
})
