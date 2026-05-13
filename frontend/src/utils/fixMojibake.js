export function fixSpanishMojibake(input) {
  if (typeof input !== 'string') return input
  // Fix common mojibake patterns seen in seeds/DB text.
  return input
    .replaceAll('Administraci?n', 'Administración')
    .replaceAll('Gesti?n', 'Gestión')
    .replaceAll('Cl?usulas', 'Cláusulas')
    .replaceAll('Configuraci?n', 'Configuración')
    .replaceAll('Par?metros', 'Parámetros')
    .replaceAll('Auditor?a', 'Auditoría')
    .replaceAll('Eliminaci?n', 'Eliminación')
    .replaceAll('Exportaci?n', 'Exportación')
    .replaceAll('Importaci?n', 'Importación')
    .replaceAll('Suscripci?n', 'Suscripción')
    .replaceAll('renovaci?n', 'renovación')
    .replaceAll('Facturaci?n', 'Facturación')
    .replaceAll('est?ndar', 'estándar')
    .replaceAll('men?', 'menú')
}

