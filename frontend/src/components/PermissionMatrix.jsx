import { useCallback, useMemo } from 'react'
import { PERMISSION_MATRIX_ROWS, ACTIONS_BY_SUBJECT, ACTION_LABELS, ALL_ACTIONS } from '../config/permissionsCatalog'
function permissionKey(subject, action) {
  return `${subject}:${action}`
}

function permissionsToSet(permissions) {
  const set = new Set()
  if (!Array.isArray(permissions)) return set
  for (const p of permissions) {
    if (p?.subject && p?.action) set.add(permissionKey(p.subject, p.action))
  }
  return set
}

function setToPermissions(activeSet) {
  const result = []
  for (const key of activeSet) {
    const [subject, action] = key.split(':')
    if (subject && action) result.push({ subject, action })
  }
  return result.sort((a, b) => {
    const subjectCmp = a.subject.localeCompare(b.subject)
    if (subjectCmp !== 0) return subjectCmp
    return a.action.localeCompare(b.action)
  })
}

export function PermissionMatrix({ permissions = [], onChange, readOnly = false }) {
  const activeSet = useMemo(() => permissionsToSet(permissions), [permissions])

  const toggle = useCallback(
    (subject, action, checked) => {
      if (readOnly || typeof onChange !== 'function') return
      const next = new Set(activeSet)
      const key = permissionKey(subject, action)
      if (checked) {
        next.add(key)
        // create y update requieren read — activarlo automáticamente
        if (action === 'create' || action === 'update') {
          next.add(permissionKey(subject, 'read'))
        }
      } else {
        next.delete(key)
        // al desactivar read, quitar también create y update
        if (action === 'read') {
          next.delete(permissionKey(subject, 'create'))
          next.delete(permissionKey(subject, 'update'))
        }
      }
      onChange(setToPermissions(next))
    },
    [activeSet, onChange, readOnly]
  )

  return (
    <div className="clause-list-table-wrap">
      <table className="clause-list-table">
        <thead>
          <tr>
            <th>Módulo</th>
            {ALL_ACTIONS.map((action) => (
              <th key={action}>{ACTION_LABELS[action] ?? action}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MATRIX_ROWS.map((row) => (
            <tr key={row.rowKey}>
              <td>{row.label}</td>
              {ALL_ACTIONS.map((action) => {
                const allowed = ACTIONS_BY_SUBJECT[row.subject]
                const rowAllowsAction = Array.isArray(row.actions) && row.actions.includes(action)
                if (!Array.isArray(allowed) || !allowed.includes(action) || !rowAllowsAction) {
                  return (
                    <td key={action} style={{ textAlign: 'center', color: '#5a6370' }}>
                      —
                    </td>
                  )
                }
                const checked = activeSet.has(permissionKey(row.subject, action))
                const readLockedByDependents =
                  action === 'read' &&
                  (activeSet.has(permissionKey(row.subject, 'create')) ||
                    activeSet.has(permissionKey(row.subject, 'update')))
                return (
                  <td key={action} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={readOnly || readLockedByDependents}
                      title={readLockedByDependents ? 'Requerido por Crear o Editar' : undefined}
                      onChange={(e) => toggle(row.subject, action, e.target.checked)}
                      aria-label={`${row.label} — ${ACTION_LABELS[action] ?? action}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
