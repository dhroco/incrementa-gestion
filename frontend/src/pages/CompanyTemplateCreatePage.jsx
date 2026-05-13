import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { StandardTemplateEditor } from '../components/StandardTemplateEditor'
import { selectEnrichedCompany, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { selectSelectedCompanyId } from '../store/sessionCompanySlice'

function useCompanyTemplateAnchorId() {
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const selectedCompanyId = useSelector(selectSelectedCompanyId)
  if (profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR') {
    return typeof enrichedCompany?.id === 'string' ? enrichedCompany.id : null
  }
  if (profile?.code === 'CONTADOR') {
    return typeof selectedCompanyId === 'string' && selectedCompanyId.trim() ? selectedCompanyId.trim() : null
  }
  return null
}

export function CompanyTemplateCreatePage() {
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null
  const companyId = useCompanyTemplateAnchorId()
  const key = useMemo(() => `ct-create-${companyId || 'none'}`, [companyId])

  return (
    <StandardTemplateEditor key={key} accessToken={accessToken} mode="create" scope="company" companyId={companyId} />
  )
}
