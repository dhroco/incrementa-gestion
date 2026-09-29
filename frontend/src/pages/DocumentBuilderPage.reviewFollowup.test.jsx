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
import { postDocumentBuilderGenerate, postDocumentBuilderReview } from '../api/documentBuilderApi'
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
      items: [{ kind: 'standard', id: 't1', name: 'STD A' }]
    }
  })),
  postDocumentBuilderGenerate: vi.fn(),
  postDocumentBuilderReview: vi.fn(),
  downloadDocumentBuilderPdf: vi.fn(async () => new Blob([]))
}))

vi.mock('./usePlatformAdminCompanyScope', () => ({
  usePlatformAdminCompanyScope: () => ({ companyId: 'co1', blocked: false, message: null })
}))

const DYNAMIC_FIELD = {
  key: 'servicios_entregables',
  label: 'Entregables (cláusula 2.3)',
  type: 'dynamic_text',
  instruccion: 'Escribe los entregables.',
  ejemplos: ['cinco (5) reels en TikTok'],
  contexto: 'Los Servicios comprenden ⟨…⟩.'
}

const OBSERVATION = {
  dynamicTextId: 'servicios_entregables',
  clause: '2.3',
  problem: 'Falta la cifra.',
  suggestion: 'cinco (5) reels en TikTok'
}

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

function buttonByText(el, text) {
  return [...el.querySelectorAll('button')].find((button) => button.textContent === text)
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

function setControlValue(control, value) {
  const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value').set
  setter.call(control, value)
  control.dispatchEvent(new Event('input', { bubbles: true }))
  control.dispatchEvent(new Event('change', { bubbles: true }))
}

async function renderAtMissingFields() {
  postDocumentBuilderGenerate.mockImplementation(async (body) => {
    if (body?.dryRun) {
      return {
        ok: false,
        status: 422,
        code: 'MISSING_PLACEHOLDERS',
        message: 'Faltan variables requeridas en la plantilla.',
        missingFields: [DYNAMIC_FIELD]
      }
    }
    return { ok: true, data: { documents: [{ id: 'd1', file_name: 'a.pdf' }] } }
  })
  ability.update([
    { action: 'use', subject: 'DocumentBuilder' },
    { action: 'read', subject: 'Supplier' }
  ])
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => {
    flushSync(() => {
      root.render(
        <Provider store={makeStore()}>
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
  await flush()
  await act(async () => {
    el.querySelector('input[type="radio"][name="supplier"]').click()
  })
  await flush()
  await act(async () => {
    el.querySelector('input[type="radio"][name="tpl"]').click()
  })
  await flush()
  return {
    el,
    cleanup() {
      act(() => {
        root.unmount()
      })
      el.remove()
    }
  }
}

describe('DocumentBuilderPage review follow-up', () => {
  it('Replacing a duplicate resends the motivo', async () => {
    postDocumentBuilderReview.mockResolvedValue({
      ok: true,
      data: { reviewId: 'rev-dup', verdict: 'observaciones', observations: [OBSERVATION] }
    })
    const { el, cleanup } = await renderAtMissingFields()
    postDocumentBuilderGenerate.mockImplementation(async (body) => {
      if (body?.dryRun) {
        return {
          ok: false,
          status: 422,
          code: 'MISSING_PLACEHOLDERS',
          missingFields: [DYNAMIC_FIELD]
        }
      }
      if (!body.overwrite) {
        return {
          ok: false,
          status: 409,
          code: 'DUPLICATE_DRAFT',
          existing: { file_name: 'anterior.pdf', created_at: '2026-03-01T00:00:00.000Z', status: 'draft' }
        }
      }
      return { ok: true, data: { documents: [{ id: 'd1', file_name: 'a.pdf' }] } }
    })
    await act(async () => {
      setControlValue(el.querySelector('textarea'), 'cinco reels')
    })
    await act(async () => {
      buttonByText(el, 'Revisar redacción').click()
    })
    await flush()
    await act(async () => {
      buttonByText(el, 'Generar igual').click()
    })
    const motivo = el.querySelector('textarea[aria-label="Motivo para generar igual"]')
    await act(async () => {
      setControlValue(motivo, 'acepto el texto')
    })
    await act(async () => {
      buttonByText(el, 'Generar igual').click()
    })
    await flush()
    const replace = buttonByText(document.body, 'Reemplazar')
    expect(replace).toBeTruthy()
    await act(async () => {
      replace.click()
    })
    await flush()
    const persisted = postDocumentBuilderGenerate.mock.calls.map((call) => call[0]).filter((body) => !body.dryRun)
    expect(persisted.at(-1).overwrite).toBe(true)
    expect(persisted.at(-1).reviewId).toBe('rev-dup')
    expect(persisted.at(-1).generarIgual).toEqual({ motivo: 'acepto el texto' })
    cleanup()
  })

  it('A field edit discards an in-flight review', async () => {
    let resolveReview
    postDocumentBuilderReview.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReview = resolve
        })
    )
    const { el, cleanup } = await renderAtMissingFields()
    const field = el.querySelector('textarea')
    await act(async () => {
      setControlValue(field, 'cinco reels')
    })
    await act(async () => {
      buttonByText(el, 'Revisar redacción').click()
    })
    await flush()
    expect(buttonByText(el, 'Revisando…').disabled).toBe(true)
    await act(async () => {
      setControlValue(field, 'cinco reels editados')
    })
    await act(async () => {
      resolveReview({
        ok: true,
        data: { reviewId: 'rev-stale', verdict: 'ok', observations: [] }
      })
    })
    await flush()
    expect(el.textContent).not.toContain('Sin observaciones')
    expect(buttonByText(el, 'Generar PDF y guardar').disabled).toBe(true)
    cleanup()
  })
})
