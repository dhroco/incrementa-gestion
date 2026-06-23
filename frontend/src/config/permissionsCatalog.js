export const SUBJECTS = [
  { id: 'Company', label: 'Empresas' },
  { id: 'PlatformUser', label: 'Usuarios' },
  { id: 'Supplier', label: 'Proveedores' },
  { id: 'Client', label: 'Clientes' },
  { id: 'Template', label: 'Plantillas' },
  { id: 'DocumentBuilder', label: 'Constructor de documento' },
  { id: 'Dashboard', label: 'Dashboard' },
  { id: 'RolePermission', label: 'Roles y permisos' },
  { id: 'Contract', label: 'Consulta de contratos' }
]

export const ACTIONS_BY_SUBJECT = {
  Company: ['read', 'create', 'update'],
  PlatformUser: ['read', 'create', 'update'],
  Supplier: ['read', 'create', 'update'],
  Client: ['read', 'create', 'update'],
  Template: ['read', 'create', 'update'],
  DocumentBuilder: ['use'],
  Dashboard: ['read'],
  RolePermission: ['read', 'create', 'update'],
  Contract: ['read', 'sign']
}

export const ACTION_LABELS = {
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  use: 'Usar',
  sign: 'Firmar'
}

export const ALL_ACTIONS = ['read', 'create', 'update', 'use', 'sign']

function buildPermissionMatrixRows() {
  const rows = []
  for (const subject of SUBJECTS) {
    const actions = ACTIONS_BY_SUBJECT[subject.id]
    if (!Array.isArray(actions) || actions.length === 0) continue

    if (subject.id === 'Contract') {
      if (actions.includes('read')) {
        rows.push({
          subject: 'Contract',
          rowKey: 'Contract:consulta',
          label: 'Consulta de contratos',
          actions: ['read']
        })
      }
      if (actions.includes('sign')) {
        rows.push({
          subject: 'Contract',
          rowKey: 'Contract:firma',
          label: 'Firma de documento',
          actions: ['sign']
        })
      }
      continue
    }

    rows.push({
      subject: subject.id,
      rowKey: subject.id,
      label: subject.label,
      actions
    })
  }
  return rows
}

export const PERMISSION_MATRIX_ROWS = buildPermissionMatrixRows()

export function hasFullAccess(permissions) {
  if (!Array.isArray(permissions)) return false
  return permissions.some((p) => p?.action === 'manage' && p?.subject === 'all')
}
