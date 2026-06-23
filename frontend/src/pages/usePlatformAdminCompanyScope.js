import { useSelector } from 'react-redux'
import { selectEnrichedProfile } from '../store/authSlice'
import { selectSelectedCompanyId } from '../store/sessionCompanySlice'

/**
 * Ámbito de empresa para módulos que requieren companyId (constructor de documento, etc.).
 * El administrador de plataforma debe tener una empresa seleccionada en el contexto de sesión.
 */
export function usePlatformAdminCompanyScope() {
  const profile = useSelector(selectEnrichedProfile)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)

  if (profile?.code !== 'ADMINISTRADOR_PLATAFORMA') {
    return {
      companyId: null,
      blocked: true,
      needsCompanySelection: false,
      message: 'No tiene permisos para este módulo.'
    }
  }

  if (!selectedCompanyId) {
    return {
      companyId: null,
      blocked: true,
      needsCompanySelection: true,
      message: 'Seleccione una empresa para continuar.'
    }
  }

  return {
    companyId: selectedCompanyId,
    blocked: false,
    needsCompanySelection: false,
    message: null
  }
}
