import { describe, expect, it } from 'vitest'
import { validateTemplateContentJsonClient } from './templateContentJson'

describe('validateTemplateContentJsonClient', () => {
  it('accepts a non-empty doc', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
    expect(validateTemplateContentJsonClient(doc)).toEqual({ ok: true })
  })

  it('rejects null content', () => {
    expect(validateTemplateContentJsonClient(null)).toEqual({
      ok: false,
      message: 'El contenido de la plantilla es obligatorio.',
    })
  })

  it('rejects empty content array', () => {
    expect(validateTemplateContentJsonClient({ type: 'doc', content: [] })).toEqual({
      ok: false,
      message: 'El contenido de la plantilla no puede estar vacío.',
    })
  })
})
