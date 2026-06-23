import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { PageShell } from '../components/PageShell'
import { PlatformAdminCompanySelect } from '../components/PlatformAdminCompanySelect'
import { usePlatformAdminCompaniesLoader } from './usePlatformAdminCompaniesLoader'
import { usePlatformAdminCompanyScope } from './usePlatformAdminCompanyScope'
import { fetchStandardTemplateById } from '../api/standardTemplatesApi'
import RichTextEditor from '../components/RichTextEditor'
import { materializeTemplateDocClient } from '../utils/materializeTemplateDocClient'
import './DocumentBuilderPreviewPage.css'

const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

function normalizeContentJson(raw) {
  if (raw == null) return EMPTY_DOC
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.type === 'doc') return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.type === 'doc') return parsed
      // Some historical rows can be double-stringified: "\"{...}\""
      if (typeof parsed === 'string') {
        const parsed2 = JSON.parse(parsed)
        if (parsed2 && typeof parsed2 === 'object' && !Array.isArray(parsed2) && parsed2.type === 'doc') return parsed2
      }
    } catch {
      /* ignore */
    }
  }
  return EMPTY_DOC
}

export function DocumentBuilderPreviewPage() {
  const templateSelected = useSelector((s) => s.documentBuilder.templateSelected)
  const companyLoader = usePlatformAdminCompaniesLoader()
  const { companyId, blocked, needsCompanySelection, message: scopeMessage } =
    usePlatformAdminCompanyScope()

  const breadcrumb = useMemo(
    () => [
      { label: 'Constructor de documento', to: '/app/gestion-contratos/constructor-documento' },
      { label: 'Ver preview' },
    ],
    []
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [title, setTitle] = useState('Ver preview')
  const [doc, setDoc] = useState(EMPTY_DOC)

  useEffect(() => {
    let active = true
    async function run() {
      setError(null)
      setDoc(EMPTY_DOC)
      setTitle('Ver preview')
      if (blocked) {
        setError(scopeMessage ?? 'Sin empresa en contexto.')
        return
      }
      if (!templateSelected?.id || !templateSelected?.kind) {
        setError('Debe seleccionar una plantilla para ver el preview.')
        return
      }

      setLoading(true)
      const id = String(templateSelected.id)
      const res = await fetchStandardTemplateById(id, {})

      if (!active) return

      if (!res?.ok) {
        setLoading(false)
        setError(res?.message ?? 'No se pudo cargar la plantilla.')
        return
      }

      const entity = res.data?.template ?? res.data
      const name = typeof entity?.name === 'string' && entity.name.trim() ? entity.name.trim() : 'Plantilla'
      setTitle(name)

      const raw = normalizeContentJson(entity?.content_json)
      try {
        const merged = await materializeTemplateDocClient(raw)
        if (!active) return
        setDoc(merged && typeof merged === 'object' ? merged : raw)
      } catch (e) {
        if (!active) return
        setDoc(raw)
        setError('No se pudo construir el preview del documento.')
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [])

  const companyToolbar =
    companyLoader.isPlatformAdmin && needsCompanySelection ? (
      <PlatformAdminCompanySelect loading={companyLoader.loading} error={companyLoader.error} />
    ) : null

  return (
    <PageShell
      title="Ver preview"
      breadcrumb={breadcrumb}
      className="document-builder-preview-page"
      hideHeader
      localToolbar={companyToolbar}
    >
      {error ? <div className="clause-error document-builder-preview-banner">{error}</div> : null}

      <div className="document-builder-preview-workarea" aria-label="Área de preview">
        {loading ? (
          <div className="document-builder-preview-overlay" role="status" aria-live="polite" aria-label="Cargando">
            <div className="db-dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
        <RichTextEditor readOnly variant="document" content={doc ?? EMPTY_DOC} documentTitle={title} />
      </div>
    </PageShell>
  )
}

