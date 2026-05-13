import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { emptyBranchRow, mapApiBranchToRow } from '../components/CompanyFormSections'
import { updateCompany } from '../api/companiesApi'
import { userMessageFromCompanySaveFailure } from '../utils/companyApiErrors'
import {
  buildCompanyMutationPayload,
  isValidEmailField,
  validateHeadquartersForCompanySubmit,
  validateSignificantBranchesForSubmit
} from '../utils/companyFormPayload'
import './ClauseForm.css'

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * Pantalla de trabajo para agregar o editar una sucursal.
 * - **Nueva empresa** (`variant === 'create'`): **Guardar** solo actualiza sucursales en memoria del layout;
 *   la persistencia en BD ocurre al **Guardar** el formulario crear empresa (`createCompany`).
 * - **Editar empresa** (`variant === 'edit'`): **Guardar** persiste de inmediato vía `updateCompany`;
 *   **Eliminar sucursal** pide confirmación y, si confirma, persiste el borrado de inmediato con el mismo contrato API.
 *
 * @param {{ mode: 'new' | 'edit' }} props
 */
export function CompanyBranchWorkPage({ mode }) {
  const { branchKey } = useParams()
  const navigate = useNavigate()
  const ctx = useOutletContext()
  const isNew = mode === 'new'

  const {
    listPath,
    parentEditPath,
    branches,
    setBranches,
    variant,
    businessName = '',
    rut = '',
    businessActivity = '',
    address = '',
    commune = '',
    city = '',
    region = '',
    email = '',
    phone = '',
    nameLegal1 = '',
    rutLegal1 = '',
    nameLegal2 = '',
    rutLegal2 = '',
    companyId = null,
    accessToken = null,
    allowedToEdit = true
  } = ctx

  const [draft, setDraft] = useState(() => emptyBranchRow())
  const [localError, setLocalError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- reset local draft when route or source rows change */
  useEffect(() => {
    if (isNew) {
      setDraft(emptyBranchRow())
      return
    }
    const row = branches.find((b) => b.key === branchKey)
    if (row) {
      setDraft({ ...row, key: row.key })
    } else {
      setDraft(emptyBranchRow())
    }
  }, [isNew, branchKey, branches])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (isNew || !branchKey) return
    if (!branches.some((b) => b.key === branchKey)) {
      navigate(parentEditPath, { replace: true })
    }
  }, [isNew, branchKey, branches, navigate, parentEditPath])

  const branchLabelForConfirm = useMemo(() => {
    const name = String(draft.name || '').trim()
    return name || 'esta sucursal'
  }, [draft.name])

  const isEditCompanyFlow = variant === 'edit' && companyId && accessToken

  const persistBranchesOnServer = useCallback(
    async (nextBranches) => {
      const branchVal = validateSignificantBranchesForSubmit(nextBranches)
      if (!branchVal.ok) return branchVal
      const hq = validateHeadquartersForCompanySubmit({
        businessName,
        rut,
        email,
        rutLegal1,
        rutLegal2
      })
      if (!hq.ok) return hq
      const res = await updateCompany(
        companyId,
        buildCompanyMutationPayload({
          businessName,
          rut,
          businessActivity,
          address,
          commune,
          city,
          region,
          email,
          phone,
          nameLegal1,
          rutLegal1,
          nameLegal2,
          rutLegal2,
          significantBranches: branchVal.significant
        }),
        { accessToken }
      )
      if (!res.ok) return { ok: false, message: userMessageFromCompanySaveFailure(res) }
      const data = res.data
      if (data && Array.isArray(data.branches)) {
        setBranches(data.branches.map(mapApiBranchToRow))
      }
      return { ok: true }
    },
    [
      accessToken,
      address,
      businessActivity,
      businessName,
      city,
      commune,
      companyId,
      email,
      nameLegal1,
      nameLegal2,
      phone,
      region,
      rut,
      rutLegal1,
      rutLegal2,
      setBranches
    ]
  )

  const save = useCallback(async () => {
    if (!String(draft.name || '').trim()) {
      setLocalError('El nombre de la sucursal es obligatorio.')
      return
    }
    if (String(draft.email || '').trim() && !isValidEmailField(draft.email)) {
      setLocalError('El correo no tiene un formato válido.')
      return
    }
    setLocalError(null)
    const row = { ...draft, key: draft.key || newKey() }
    const nextBranches = isNew ? [...branches, row] : branches.map((r) => (r.key === branchKey ? { ...row, key: r.key } : r))

    if (isEditCompanyFlow) {
      if (!allowedToEdit) {
        setLocalError('No tiene permiso para editar esta empresa.')
        return
      }
      setSaving(true)
      const out = await persistBranchesOnServer(nextBranches)
      setSaving(false)
      if (!out.ok) {
        setLocalError(out.message || 'No se pudo guardar.')
        return
      }
      navigate(parentEditPath)
      return
    }

    if (isNew) {
      setBranches((prev) => [...prev, row])
    } else {
      setBranches((prev) => prev.map((r) => (r.key === branchKey ? { ...row, key: r.key } : r)))
    }
    navigate(parentEditPath)
  }, [
    allowedToEdit,
    branchKey,
    branches,
    draft,
    isEditCompanyFlow,
    isNew,
    navigate,
    parentEditPath,
    persistBranchesOnServer,
    setBranches
  ])

  const requestDelete = useCallback(() => {
    setConfirmDeleteOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (isEditCompanyFlow && allowedToEdit) {
      setSaving(true)
      setLocalError(null)
      const nextBranches = branches.filter((r) => r.key !== branchKey)
      const out = await persistBranchesOnServer(nextBranches)
      setSaving(false)
      setConfirmDeleteOpen(false)
      if (!out.ok) {
        setLocalError(out.message || 'No se pudo eliminar.')
        return
      }
      navigate(parentEditPath)
      return
    }
    setBranches((prev) => prev.filter((r) => r.key !== branchKey))
    setConfirmDeleteOpen(false)
    navigate(parentEditPath)
  }, [allowedToEdit, branchKey, branches, isEditCompanyFlow, navigate, parentEditPath, persistBranchesOnServer, setBranches])

  const breadcrumb = useMemo(() => {
    if (variant === 'create') {
      return [
        { label: 'Empresas', to: listPath },
        { label: 'Nueva empresa', to: parentEditPath },
        { label: isNew ? 'Agregar Sucursal' : 'Editar Sucursal' }
      ]
    }
    return [
      { label: 'Empresas', to: listPath },
      { label: 'Editar', to: parentEditPath },
      { label: isNew ? 'Agregar Sucursal' : 'Editar Sucursal' }
    ]
  }, [variant, listPath, parentEditPath, isNew])

  const subActions = useMemo(
    () => (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!isNew ? (
          <button
            type="button"
            className="clause-button clause-button--secondary"
            onClick={requestDelete}
            disabled={saving || (isEditCompanyFlow && !allowedToEdit)}
          >
            Eliminar sucursal
          </button>
        ) : null}
        <button
          type="button"
          className="clause-button"
          onClick={() => {
            void save()
          }}
          disabled={saving || (isEditCompanyFlow && !allowedToEdit)}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    ),
    [allowedToEdit, isEditCompanyFlow, isNew, requestDelete, save, saving]
  )

  return (
    <PageShell breadcrumb={breadcrumb} actions={subActions} hideHeader>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Eliminar sucursal"
        message={`¿Confirma que desea eliminar la sucursal «${branchLabelForConfirm}»? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        destructive
        onConfirm={() => {
          void handleConfirmDelete()
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
      <div className="ph-card clause-card">
        <div className="clause-form">
          {localError ? <div className="clause-error">{localError}</div> : null}
          {variant === 'create' ? (
            <div style={{ fontSize: '12px', color: '#000', opacity: 0.85, marginBottom: '10px' }}>
              Las sucursales se registran en el sistema al guardar la empresa desde el formulario «Nueva empresa».
            </div>
          ) : null}
          <div className="company-branch-work-empresa-context">
            <div className="clause-form-row clause-form-row--two-col">
              <div className="clause-form-col">
                <div className="clause-label">Razón Social</div>
                <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={businessName ?? ''} />
              </div>
              <div className="clause-form-col">
                <div className="clause-label">RUT</div>
                <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={rut ?? ''} />
              </div>
            </div>
          </div>
          <div className="clause-form-row">
            <div className="clause-label">Nombre sucursal</div>
            <input className="clause-input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="clause-form-row">
            <div className="clause-label">Dirección</div>
            <input className="clause-input" value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
          </div>
          <div className="clause-form-row clause-form-row--three-equal">
            <div className="clause-form-col">
              <div className="clause-label">Comuna</div>
              <input className="clause-input" value={draft.commune} onChange={(e) => setDraft((d) => ({ ...d, commune: e.target.value }))} />
            </div>
            <div className="clause-form-col">
              <div className="clause-label">Ciudad</div>
              <input className="clause-input" value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
            </div>
            <div className="clause-form-col">
              <div className="clause-label">Región</div>
              <input className="clause-input" value={draft.region} onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))} />
            </div>
          </div>
          <div className="clause-form-row clause-form-row--two-equal">
            <div className="clause-form-col">
              <div className="clause-label">Correo</div>
              <input className="clause-input" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
            </div>
            <div className="clause-form-col">
              <div className="clause-label">Teléfono</div>
              <input className="clause-input" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
