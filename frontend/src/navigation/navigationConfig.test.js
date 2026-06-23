import { describe, expect, it } from 'vitest'
import {
  PROFILE_CODES,
  getAllowedPathsForProfile,
  getDefaultPrivatePathForProfile,
  getModuleTitleForPath,
  getNavForProfile
} from './__testonly__/navigationConfig'

describe('getNavForProfile', () => {
  it('includes Administración group for ADMINISTRADOR_PLATAFORMA', () => {
    const adminNav = getNavForProfile(PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)
    expect(adminNav.some((n) => n.type === 'group' && n.id === 'administracion')).toBe(true)
  })

  it('returns dashboard and contratos links', () => {
    const nav = getNavForProfile(PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)
    const paths = nav.flatMap((n) =>
      n.type === 'link' ? [n.path] : n.children.map((c) => c.path)
    )
    expect(paths).toContain('/app/dashboard')
    expect(paths).toContain('/app/contratos')
  })
})

describe('getDefaultPrivatePathForProfile', () => {
  it('returns dashboard as first item for admin', () => {
    expect(getDefaultPrivatePathForProfile(PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)).toBe(
      '/app/dashboard'
    )
  })
})

describe('getAllowedPathsForProfile', () => {
  it('includes usuarios and reportes for ADMINISTRADOR_PLATAFORMA', () => {
    const allowed = getAllowedPathsForProfile(PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)
    expect(allowed.has('/app/usuarios')).toBe(true)
    expect(allowed.has('/app/reportes')).toBe(true)
    expect(allowed.has('/app/mi-perfil')).toBe(true)
  })
})

describe('getModuleTitleForPath', () => {
  it('resolves title for allowed path and profile', () => {
    expect(
      getModuleTitleForPath('/app/contratos', PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)
    ).toBe('Contratos')
  })

  it('resolves cross-cutting route', () => {
    expect(
      getModuleTitleForPath('/app/mi-perfil', PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)
    ).toBe('Mi perfil')
  })
})
