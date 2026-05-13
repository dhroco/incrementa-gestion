import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
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

export function CompanyTemplateEditPage() {
  const { id } = useParams()
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null
  const companyId = useCompanyTemplateAnchorId()
  const key = useMemo(() => `ct-edit-${id}-${companyId || 'none'}`, [id, companyId])

  return (
    <StandardTemplateEditor
      key={key}
      accessToken={accessToken}
      mode="edit"
      templateId={id}
      scope="company"
      companyId={companyId}
    />
  )
}
