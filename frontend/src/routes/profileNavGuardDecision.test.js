import { describe, expect, it } from 'vitest'
import { decidePrivateNavigation } from './profileNavGuardDecision'

describe('decidePrivateNavigation', () => {
  const routes = [
    { code: 'NAV_DASHBOARD', routePath: '/app/dashboard', showInMainMenu: true, sortOrder: 100 },
    { code: 'NAV_CONTRATOS', routePath: '/app/contratos', showInMainMenu: true, sortOrder: 200 },
    { code: 'NAV_USUARIOS', routePath: '/app/usuarios', showInMainMenu: true, sortOrder: 300 }
  ]

  it('allows when enrichment is not succeeded', () => {
    expect(
      decidePrivateNavigation({ pathname: '/app/contratos', enrichmentStatus: 'loading', routes }).type
    ).toBe('allow')
  })

  it('redirects /app to default allowed path', () => {
    expect(decidePrivateNavigation({ pathname: '/app', enrichmentStatus: 'succeeded', routes })).toEqual({
      type: 'redirect',
      to: '/app/dashboard'
    })
  })

  it('redirects to access denied when allowed set is empty but routes exist (invalid routePath data)', () => {
    const bad = [{ code: 'X', routePath: null, sortOrder: 1 }]
    expect(decidePrivateNavigation({ pathname: '/app/dashboard', enrichmentStatus: 'succeeded', routes: bad })).toEqual({
      type: 'redirect',
      to: '/app/acceso-denegado'
    })
  })

  it('redirects /app to acceso denegado when no valid default path exists', () => {
    const bad = [{ code: 'X', routePath: null, sortOrder: 1 }]
    expect(decidePrivateNavigation({ pathname: '/app', enrichmentStatus: 'succeeded', routes: bad })).toEqual({
      type: 'redirect',
      to: '/app/acceso-denegado'
    })
  })

  it('redirects to access denied when path is not allowed', () => {
    expect(decidePrivateNavigation({ pathname: '/app/proveedores', enrichmentStatus: 'succeeded', routes })).toEqual({
      type: 'redirect',
      to: '/app/acceso-denegado'
    })
  })

  it('allows when path is included in allowed routes', () => {
    const allowedRoutes = routes
    expect(decidePrivateNavigation({ pathname: '/app/usuarios', enrichmentStatus: 'succeeded', routes: allowedRoutes })).toEqual({
      type: 'allow'
    })
  })

  it('allows nested paths when parent routePath is granted (prefix match)', () => {
    const clauseRoutes = [
      { code: 'NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES', routePath: '/app/gestion-contratos/clausulas-universales', sortOrder: 1 }
    ]
    expect(
      decidePrivateNavigation({
        pathname: '/app/gestion-contratos/clausulas-universales/abc-uuid/edit',
        enrichmentStatus: 'succeeded',
        routes: clauseRoutes
      })
    ).toEqual({ type: 'allow' })
  })

  it('allows access denied route', () => {
    expect(
      decidePrivateNavigation({ pathname: '/app/acceso-denegado', enrichmentStatus: 'succeeded', routes })
    ).toEqual({ type: 'allow' })
  })
})

