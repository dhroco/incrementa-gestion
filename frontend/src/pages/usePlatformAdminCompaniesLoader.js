import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useIsAuthenticated } from '@azure/msal-react'
import { fetchCompaniesList } from '../api/companiesApi'
import { selectEnrichedProfile, selectUser } from '../store/authSlice'
import {
  hydrateAccountantCompanyContext,
  selectAssignedCompanies
} from '../store/sessionCompanySlice'

const PLATFORM_ADMIN_CODE = 'ADMINISTRADOR_PLATAFORMA'

export function mapCompaniesFromApi(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter((x) => x && typeof x.id === 'string')
    .map((x) => ({
      id: x.id,
      business_name:
        typeof x.business_name === 'string' || x.business_name === null ? x.business_name : null
    }))
}

/**
 * Carga empresas accesibles al administrador de plataforma y las deja en sessionCompany
 * (lista + selección inicial desde localStorage o primera empresa).
 */
export function usePlatformAdminCompaniesLoader() {
  const dispatch = useDispatch()
  const profile = useSelector(selectEnrichedProfile)
  const user = useSelector(selectUser)
  const assignedCompanies = useSelector(selectAssignedCompanies)
  const isAuthenticated = useIsAuthenticated()
  const userId = user?.id ?? null
  const isPlatformAdmin = profile?.code === PLATFORM_ADMIN_CODE

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isPlatformAdmin || !isAuthenticated || !userId) {
      return undefined
    }

    let active = true
    async function run() {
      setLoading(true)
      setError(null)
      const res = await fetchCompaniesList()
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el listado de empresas.')
        return
      }
      dispatch(
        hydrateAccountantCompanyContext({
          userId,
          assignedCompanies: mapCompaniesFromApi(res.data?.items)
        })
      )
    }
    run()
    return () => {
      active = false
    }
  }, [isPlatformAdmin, isAuthenticated, userId, dispatch])

  return {
    isPlatformAdmin,
    assignedCompanies,
    loading: isPlatformAdmin ? loading : false,
    error: isPlatformAdmin ? error : null
  }
}
