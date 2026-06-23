import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { PermissionMatrix } from '../components/PermissionMatrix'
import {
  deleteRole,
  fetchRoleById,
  saveRolePermissions,
  updateRoleLabel
} from '../api/rolesApi'
import { hasFullAccess } from '../config/permissionsCatalog'
import { ROLES_LIST_PATH } from '../navigation/rolesPaths'
import { AbilityContext } from '../lib/ability'
import '../styles/shared-form.css'

export function RoleDetailPage({ mode = 'view' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const ability = useAbility(AbilityContext)

  const canUpdate = ability.can('update', 'RolePermission')
  const isViewMode = mode === 'view'
  const isEditMode = mode === 'edit'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [draftLabel, setDraftLabel] = useState('')
  const [draftPermissions, setDraftPermissions] = useState([])
  const [savingLabel, setSavingLabel] = useState(false)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [labelError, setLabelError] = useState(null)
  const [permissionsError, setPermissionsError] = useState(null)

  const loadRole = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetchRoleById(id, {})
    setLoading(false)
    if (!res.ok) {
      setError(res.message ?? 'No se pudo cargar el rol.')
      setRole(null)
      setPermissions([])
      return
    }
    const nextRole = res.data?.role ?? null
    const nextPermissions = Array.isArray(res.data?.permissions) ? res.data.permissions : []
    setRole(nextRole)
    setPermissions(nextPermissions)
    setDraftLabel(nextRole?.label ?? '')
    setDraftPermissions(
      nextPermissions.map(({ action, subject }) => ({ action, subject }))
    )
  }, [])

  useEffect(() => {
    loadRole()
  }, [loadRole])

  const fullAccess = useMemo(() => hasFullAccess(permissions), [permissions])

  const breadcrumb = useMemo(
    () => [
      { label: 'Roles y permisos', to: ROLES_LIST_PATH },
      ...(isViewMode ? [{ label: 'Ver' }] : [{ label: role?.label ?? 'Rol' }])
    ],
    [isViewMode, role?.label]
  )

  async function onSaveLabel() {
    if (!isEditMode || !canUpdate || !id || !draftLabel.trim()) return
    setSavingLabel(true)
    setLabelError(null)
    const res = await updateRoleLabel(id, { label: draftLabel.trim() }, {})
    setSavingLabel(false)
    if (!res.ok) {
      setLabelError(res.message ?? 'No se pudo guardar el nombre.')
      return
    }
    await loadRole()
  }

  async function onSavePermissions() {
    if (!isEditMode || !canUpdate || !id || fullAccess) return
    setSavingPermissions(true)
    setPermissionsError(null)
    const res = await saveRolePermissions(id, draftPermissions, {})
    setSavingPermissions(false)
    if (!res.ok) {
      setPermissionsError(res.message ?? 'No se pudieron guardar los permisos.')
      return
    }
    await loadRole()
  }

  async function onDeleteRole() {
    if (!isEditMode || !canUpdate || !id || !role || (role.usersCount ?? 0) > 0) return
    if (!window.confirm('¿Eliminar este rol? Esta acción no se puede deshacer.')) return
    setDeleting(true)
    setError(null)
    const res = await deleteRole(id, {})
    setDeleting(false)
    if (!res.ok) {
      setError(res.message ?? 'No se pudo eliminar el rol.')
      return
    }
    navigate(ROLES_LIST_PATH)
  }

  const headerActions = useMemo(() => {
    if (isViewMode && role && canUpdate) {
      return (
        <button type="button" className="btn" onClick={() => navigate('edit')}>
          Editar
        </button>
      )
    }
    if (isEditMode && canUpdate && role && (role.usersCount ?? 0) === 0) {
      return (
        <button type="button" className="btn" onClick={onDeleteRole} disabled={deleting}>
          {deleting ? 'Eliminando…' : 'Eliminar rol'}
        </button>
      )
    }
    return null
  }, [canUpdate, deleting, isEditMode, isViewMode, navigate, onDeleteRole, role])

  if (loading) {
    return (
      <PageShell breadcrumb={breadcrumb} hideHeader>
        <div className="clause-list-loading">Cargando…</div>
      </PageShell>
    )
  }

  if (error && !role) {
    return (
      <PageShell breadcrumb={breadcrumb} hideHeader>
        <div className="clause-error">{error}</div>
      </PageShell>
    )
  }

  return (
    <PageShell breadcrumb={breadcrumb} actions={headerActions} hideHeader>
      {error ? <div className="clause-error">{error}</div> : null}

      <div className="ph-card clause-card" style={{ marginBottom: '10px' }}>
        <div className="ph-title" style={{ marginBottom: '12px' }}>
          Datos del rol
        </div>
        <div className="clause-form">
          {labelError ? <div className="clause-error">{labelError}</div> : null}
          <div className="clause-form-row clause-form-row--two-equal">
            <div className="clause-form-col">
              {isViewMode ? (
                <>
                  <div className="clause-label">Nombre del rol</div>
                  <input
                    className="clause-input clause-input--readonly"
                    readOnly
                    tabIndex={-1}
                    value={draftLabel}
                  />
                </>
              ) : (
                <label className="clause-field">
                  <span>Nombre del rol</span>
                  <input
                    className="clause-input"
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="clause-form-col">
              {isViewMode ? (
                <>
                  <div className="clause-label">Código</div>
                  <input
                    className="clause-input clause-input--readonly"
                    readOnly
                    tabIndex={-1}
                    value={role?.code ?? ''}
                  />
                </>
              ) : (
                <label className="clause-field">
                  <span>Código</span>
                  <input className="clause-input" value={role?.code ?? ''} readOnly />
                </label>
              )}
            </div>
          </div>
          {isEditMode && canUpdate ? (
            <button type="button" className="btn" onClick={onSaveLabel} disabled={savingLabel || !draftLabel.trim()}>
              {savingLabel ? 'Guardando…' : 'Guardar nombre'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="ph-card clause-card">
        <div className="ph-title" style={{ marginBottom: '12px' }}>
          Permisos
        </div>
        {permissionsError ? <div className="clause-error">{permissionsError}</div> : null}
        {fullAccess ? (
          <p style={{ margin: 0, color: '#1a1a1a' }}>
            Acceso total — este rol tiene control completo sobre el sistema
          </p>
        ) : (
          <>
            <PermissionMatrix
              permissions={draftPermissions}
              onChange={setDraftPermissions}
              readOnly={isViewMode}
            />
            {isEditMode && canUpdate ? (
              <div style={{ marginTop: '12px' }}>
                <button type="button" className="btn" onClick={onSavePermissions} disabled={savingPermissions}>
                  {savingPermissions ? 'Guardando…' : 'Guardar permisos'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PageShell>
  )
}
