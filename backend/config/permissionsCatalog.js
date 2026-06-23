const SUBJECTS = [
  { id: 'Company', label: 'Empresas' },
  { id: 'PlatformUser', label: 'Usuarios' },
  { id: 'Supplier', label: 'Proveedores' },
  { id: 'Client', label: 'Clientes' },
  { id: 'Template', label: 'Plantillas' },
  { id: 'DocumentBuilder', label: 'Constructor de documento' },
  { id: 'Contract', label: 'Consulta de contratos' },
  { id: 'Dashboard', label: 'Dashboard' },
  { id: 'RolePermission', label: 'Roles y permisos' }
]

const ACTIONS_BY_SUBJECT = {
  Company: ['read', 'create', 'update'],
  PlatformUser: ['read', 'create', 'update'],
  Supplier: ['read', 'create', 'update'],
  Client: ['read', 'create', 'update'],
  Template: ['read', 'create', 'update'],
  DocumentBuilder: ['use'],
  Contract: ['read', 'sign'],
  Dashboard: ['read'],
  RolePermission: ['read', 'create', 'update']
}

const ACTION_LABELS = {
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  use: 'Usar',
  sign: 'Firmar'
}

function isValidPermissionPair({ action, subject }) {
  if (action === 'manage' && subject === 'all') return true
  const allowed = ACTIONS_BY_SUBJECT[subject]
  if (!Array.isArray(allowed)) return false
  return allowed.includes(action)
}

module.exports = {
  SUBJECTS,
  ACTIONS_BY_SUBJECT,
  ACTION_LABELS,
  isValidPermissionPair
}
