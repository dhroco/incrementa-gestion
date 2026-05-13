import { describe, expect, it } from 'vitest'
import {
  PROFILE_CODES,
  getAllowedPathsForProfile,
  getDefaultPrivatePathForProfile,
  getModuleTitleForPath,
  getNavForProfile
} from './__testonly__/navigationConfig'

describe('getNavForProfile', () => {
  it('includes Administración group only for ADMINISTRADOR_PLATAFORMA', () => {
    const adminNav = getNavForProfile(PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)
    expect(adminNav.some((n) => n.type === 'group' && n.id === 'administracion')).toBe(true)

    const empresaNav = getNavForProfile(PROFILE_CODES.USUARIO_EMPRESA_ADMINISTRADOR)
    expect(empresaNav.some((n) => n.type === 'group' && n.id === 'administracion')).toBe(false)
  })

  it('returns shared top links for both profiles', () => {
    for (const code of Object.values(PROFILE_CODES)) {
      const nav = getNavForProfile(code)
      const paths = nav.flatMap((n) =>
        n.type === 'link' ? [n.path] : n.children.map((c) => c.path)
      )
      expect(paths).toContain('/app/dashboard')
      expect(paths).toContain('/app/contratos')
    }
  })
})

describe('getDefaultPrivatePathForProfile', () => {
  it('returns dashboard as first item for both profiles', () => {
    expect(getDefaultPrivatePathForProfile(PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)).toBe(
      '/app/dashboard'
    )
    expect(getDefaultPrivatePathForProfile(PROFILE_CODES.USUARIO_EMPRESA_ADMINISTRADOR)).toBe(
      '/app/dashboard'
    )
  })
})

describe('getAllowedPathsForProfile', () => {
  it('excludes usuarios and reportes for USUARIO_EMPRESA_ADMINISTRADOR', () => {
    const allowed = getAllowedPathsForProfile(PROFILE_CODES.USUARIO_EMPRESA_ADMINISTRADOR)
    expect(allowed.has('/app/usuarios')).toBe(false)
    expect(allowed.has('/app/reportes')).toBe(false)
    expect(allowed.has('/app/mi-perfil')).toBe(true)
  })

  it('includes usuarios for ADMINISTRADOR_PLATAFORMA', () => {
    const allowed = getAllowedPathsForProfile(PROFILE_CODES.ADMINISTRADOR_PLATAFORMA)
    expect(allowed.has('/app/usuarios')).toBe(true)
  })
})

describe('getModuleTitleForPath', () => {
  it('resolves title for allowed path and profile', () => {
    expect(
      getModuleTitleForPath('/app/contratos', PROFILE_CODES.USUARIO_EMPRESA_ADMINISTRADOR)
    ).toBe('Contratos')
  })

  it('resolves cross-cutting route', () => {
    expect(
      getModuleTitleForPath('/app/mi-perfil', PROFILE_CODES.USUARIO_EMPRESA_ADMINISTRADOR)
    ).toBe('Mi perfil')
  })
})
