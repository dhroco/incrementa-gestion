import { useSelector } from 'react-redux'
import { StandardTemplateEditor } from '../components/StandardTemplateEditor'
import { selectSession } from '../store/authSlice'

export function StandardTemplateCreatePage() {
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null

  return <StandardTemplateEditor accessToken={accessToken} mode="create" />
}
