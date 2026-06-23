import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { PageShell } from '../components/PageShell'
import { SupplierTypeChip } from '../components/SupplierTypeChip'
import { AutocompleteInput } from '../components/AutocompleteInput'
import { fetchClientsList } from '../api/clientsApi'
import { fetchSuppliersList } from '../api/suppliersApi'
import { fetchStandardTemplatesList } from '../api/standardTemplatesApi'
import { fetchContractPdfBlob, fetchContracts } from '../api/contractsApi'
import { AbilityContext } from '../lib/ability'
import '../styles/shared-form.css'

const PAGE_SIZE = 18

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function formatRedSocial(row) {
  const network = row.proveedor_red_social
  const account = row.proveedor_cuenta_social
  if (network && account) return `${network} — ${account}`
  if (network) return network
  if (account) return account
  return '—'
}

function contractStatusLabel(row) {
  return row.source === 'signed' || row.status === 'signed' ? 'Firmado' : 'En proceso'
}

function contractStatusClass(row) {
  return row.source === 'signed' || row.status === 'signed'
    ? 'contracts-status-badge contracts-status-badge--signed'
    : 'contracts-status-badge contracts-status-badge--draft'
}

export function ContractsListPage() {
  const ability = useAbility(AbilityContext)
  const canRead = ability.can('read', 'Contract')

  const [supplierId, setSupplierId] = useState(null)
  const [supplierLabel, setSupplierLabel] = useState('')
  const [redSocialSearch, setRedSocialSearch] = useState('')
  const [debouncedRedSocialSearch, setDebouncedRedSocialSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const [clients, setClients] = useState([])
  const [templates, setTemplates] = useState([])
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadingPdfKey, setLoadingPdfKey] = useState(null)
  const [pdfErrors, setPdfErrors] = useState(() => ({}))

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedRedSocialSearch(redSocialSearch), 300)
    return () => window.clearTimeout(timer)
  }, [redSocialSearch])

  useEffect(() => {
    let active = true
    async function loadOptions() {
      if (!canRead) {
        setClients([])
        setTemplates([])
        return
      }
      const [clientsRes, templatesRes] = await Promise.all([
        fetchClientsList({}),
        fetchStandardTemplatesList({})
      ])
      if (!active) return
      setClients(Array.isArray(clientsRes.data?.items) ? clientsRes.data.items : [])
      setTemplates(Array.isArray(templatesRes.data?.items) ? templatesRes.data.items : [])
    }
    void loadOptions()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadContracts() {
      if (!canRead) {
        setLoading(false)
        setItems([])
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchContracts({
        page,
        filters: {
          supplierId: supplierId || undefined,
          clientId: clientId || undefined,
          templateId: templateId || undefined,
          redSocialSearch: debouncedRedSocialSearch,
          status
        }
      })
      if (!active) return
      setLoading(false)
      if (!res.ok) {
        setError(res.message ?? 'No se pudo cargar el listado de contratos.')
        setItems([])
        setPagination({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 })
        return
      }
      setItems(Array.isArray(res.data?.items) ? res.data.items : [])
      setPagination(res.data?.pagination ?? { page, pageSize: PAGE_SIZE, total: 0, totalPages: 0 })
    }
    void loadContracts()
    return () => {
      active = false
    }
  }, [
    canRead,
    page,
    supplierId,
    debouncedRedSocialSearch,
    clientId,
    templateId,
    status
  ])

  const resetPage = useCallback(() => setPage(1), [])

  const openPdf = useCallback(
    async (row) => {
      if (!row?.id) return
      const key = `${row.source}:${row.id}`
      setLoadingPdfKey(key)
      setPdfErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      try {
        const blob = await fetchContractPdfBlob({
          id: row.id,
          source: row.source
        })
        openPdfBlob(blob)
      } catch (err) {
        setPdfErrors((prev) => ({
          ...prev,
          [key]: err instanceof Error ? err.message : 'No se pudo abrir el contrato.'
        }))
      } finally {
        setLoadingPdfKey(null)
      }
    },
    []
  )

  const breadcrumb = useMemo(() => (canRead ? [{ label: 'Consulta contratos' }] : null), [canRead])

  if (!canRead) {
    return (
      <PageShell className="clause-universal-list-page" breadcrumb={breadcrumb} hideHeader>
        <div className="clause-list-card">
          <div className="clause-error">No tiene permiso para consultar contratos.</div>
        </div>
      </PageShell>
    )
  }

  const { total = 0, totalPages = 0 } = pagination
  const currentPage = pagination.page ?? page

  return (
    <PageShell className="clause-universal-list-page" breadcrumb={breadcrumb} hideHeader>
      <div className="clause-list-card">
        <div className="contracts-filters-bar">
          <label className="contracts-filter-field">
            <span className="contracts-filter-label">Proveedor</span>
            <AutocompleteInput
              value={supplierId}
              displayValue={supplierLabel}
              placeholder="Buscar proveedor…"
              className="clause-input"
              fetchOptions={async (search) => {
                const res = await fetchSuppliersList({ search })
                const items = res.data?.items ?? []
                return items.map((s) => ({
                  id: s.id,
                  label: s.razon_social || s.full_name || s.id
                }))
              }}
              onSelect={(opt) => {
                setSupplierId(opt?.id ?? null)
                setSupplierLabel(opt?.label ?? '')
                resetPage()
              }}
            />
          </label>
          <label className="contracts-filter-field">
            <span className="contracts-filter-label">Cliente</span>
            <select
              className="clause-input"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value)
                resetPage()
              }}
            >
              <option value="">Todos los clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="contracts-filter-field">
            <span className="contracts-filter-label">Plantilla</span>
            <select
              className="clause-input"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value)
                resetPage()
              }}
            >
              <option value="">Todas las plantillas</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="contracts-filter-field">
            <span className="contracts-filter-label">Red social</span>
            <input
              type="text"
              className="clause-input"
              placeholder="Buscar red social…"
              value={redSocialSearch}
              onChange={(e) => {
                setRedSocialSearch(e.target.value)
                resetPage()
              }}
            />
          </label>
          <label className="contracts-filter-field">
            <span className="contracts-filter-label">Estado</span>
            <select
              className="clause-input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                resetPage()
              }}
            >
              <option value="all">Todos</option>
              <option value="draft">En proceso de firma</option>
              <option value="signed">Firmados</option>
            </select>
          </label>
        </div>

        {error ? <div className="clause-error">{error}</div> : null}

        {loading ? (
          <div className="clause-list-loading">Cargando…</div>
        ) : (
          <>
            <div className="clause-list-table-wrap">
              <table className="clause-list-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Cliente</th>
                    <th>Plantilla</th>
                    <th>Red social</th>
                    <th>Fecha contrato</th>
                    <th>Mes ejecución</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th className="clause-list-col-actions">Ver PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="clause-list-empty">
                        No hay contratos que coincidan con los filtros.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => {
                      const pdfKey = `${row.source}:${row.id}`
                      const busy = loadingPdfKey === pdfKey
                      return (
                        <tr key={pdfKey}>
                          <td>
                            <span className="contracts-supplier-cell">
                              <span>{row.supplier_name || '—'}</span>
                              {row.supplier_type ? (
                                <SupplierTypeChip supplierType={row.supplier_type} />
                              ) : null}
                            </span>
                          </td>
                          <td>{row.client_name || '—'}</td>
                          <td>{row.template_name || '—'}</td>
                          <td>{formatRedSocial(row)}</td>
                          <td>{row.fecha_contrato || '—'}</td>
                          <td>{row.mes_ejecucion || '—'}</td>
                          <td>{row.precio_numero || '—'}</td>
                          <td>
                            <span className={contractStatusClass(row)}>{contractStatusLabel(row)}</span>
                          </td>
                          <td className="clause-list-col-actions">
                            <button
                              type="button"
                              className="contracts-pdf-icon-btn"
                              title="Ver PDF"
                              aria-label="Ver PDF"
                              disabled={busy}
                              onClick={() => void openPdf(row)}
                            >
                              <DescriptionOutlinedIcon fontSize="small" />
                            </button>
                            {pdfErrors[pdfKey] ? (
                              <div className="clause-error">{pdfErrors[pdfKey]}</div>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="contracts-pagination">
              <span className="contracts-pagination-summary">
                {total} contrato{total === 1 ? '' : 's'} encontrado{total === 1 ? '' : 's'}
              </span>
              <span className="contracts-pagination-controls">
                <button
                  type="button"
                  className="btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  « Anterior
                </button>
                <span className="contracts-pagination-page">
                  Página {currentPage} de {totalPages || 1}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={totalPages === 0 || currentPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente »
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
