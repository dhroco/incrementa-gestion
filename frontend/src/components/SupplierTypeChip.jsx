import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'

/**
 * @param {{ supplierType: 'empresa' | 'persona_natural' | string | null | undefined }} props
 */
export function SupplierTypeChip({ supplierType }) {
  const isEmpresa = supplierType === 'empresa'
  const label = isEmpresa ? 'Empresa' : 'Persona'
  const ariaLabel = isEmpresa ? 'Empresa' : 'Persona Natural'
  const Icon = isEmpresa ? BusinessOutlinedIcon : PersonOutlineOutlinedIcon

  return (
    <span className="supplier-type-chip" aria-label={ariaLabel} title={ariaLabel}>
      <Icon className="supplier-type-chip__icon" sx={{ fontSize: 14 }} aria-hidden />
      <span className="supplier-type-chip__label">{label}</span>
    </span>
  )
}
