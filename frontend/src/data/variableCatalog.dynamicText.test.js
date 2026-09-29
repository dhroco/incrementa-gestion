import { describe, expect, it } from 'vitest'
import { VARIABLE_GROUPS } from './variableCatalog'

const contrato = VARIABLE_GROUPS.contrato.variables

describe('contrato dynamic text variables', () => {
  it('Entregables listed under contrato', () => {
    const variable = contrato.find((item) => item.id === 'servicios_entregables')
    expect(variable).toMatchObject({
      id: 'servicios_entregables',
      label: 'Entregables (cláusula 2.3)',
      type: 'dynamic_text',
      description:
        'Escribe qué publicará el influencer: cantidad en palabras y en cifra, formato y red social de cada entregable.'
    })
  })

  it('Cuentas de publicación listed under contrato', () => {
    const variable = contrato.find((item) => item.id === 'cuentas_publicacion')
    expect(variable).toMatchObject({
      id: 'cuentas_publicacion',
      label: 'Cuentas de publicación (cláusula 2.5)',
      type: 'dynamic_text',
      description: 'Escribe la cuenta del influencer en cada red social nombrada en los entregables.'
    })
  })

  it('Existing contrato variables stay untyped', () => {
    const variable = contrato.find((item) => item.id === 'fecha_contrato')
    expect(variable).toBeTruthy()
    expect(variable.label).toBe('Fecha del contrato')
    expect(variable.type).toBeUndefined()
  })
})
