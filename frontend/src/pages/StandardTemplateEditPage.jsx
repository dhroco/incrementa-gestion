import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import { StandardTemplateEditor } from '../components/StandardTemplateEditor'
import { selectSession } from '../store/authSlice'

export function StandardTemplateEditPage() {
  const { id } = useParams()
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null

  return <StandardTemplateEditor accessToken={accessToken} mode="edit" templateId={id} />
}
