import { useParams } from 'react-router-dom'
import { StandardTemplateEditor } from '../components/StandardTemplateEditor'

export function StandardTemplateEditPage() {
  const { id } = useParams()

  return <StandardTemplateEditor mode="edit" templateId={id} />
}
