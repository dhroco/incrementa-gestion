import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { selectEnrichedCompany, selectEnrichedProfile } from '../store/authSlice'
import { selectSelectedCompanyId } from '../store/sessionCompanySlice'

/**
 * @returns {{ companyId: string | null, blocked: boolean, message: string | null }}
 */
export function useEmployeeCompanyScope() {
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)

  return useMemo(() => {
    if (profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR') {
      const id = enrichedCompany?.id ?? null
      if (!id) return { companyId: null, blocked: true, message: 'No se pudo determinar la empresa.' }
      return { companyId: id, blocked: false, message: null }
    }
    if (profile?.code === 'CONTADOR') {
      if (!selectedCompanyId) {
        return {
          companyId: null,
          blocked: true,
          message: 'Seleccione una empresa en la barra superior para gestionar trabajadores.'
        }
      }
      return { companyId: selectedCompanyId, blocked: false, message: null }
    }
    return { companyId: null, blocked: true, message: 'No tiene acceso a la gestión de trabajadores.' }
  }, [profile?.code, enrichedCompany?.id, selectedCompanyId])
}
