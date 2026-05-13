import { useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectSession } from '../store/authSlice'

/**
 * Estado del formulario de creación de empresa compartido con rutas hijas (sucursal).
 */
export function CompanyCreateLayout() {
  const session = useSelector(selectSession)
  const accessToken = session?.access_token ?? null

  const [businessName, setBusinessName] = useState('')
  const [rut, setRut] = useState('')
  const [businessActivity, setBusinessActivity] = useState('')
  const [address, setAddress] = useState('')
  const [commune, setCommune] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [nameLegal1, setNameLegal1] = useState('')
  const [rutLegal1, setRutLegal1] = useState('')
  const [nameLegal2, setNameLegal2] = useState('')
  const [rutLegal2, setRutLegal2] = useState('')
  const [branches, setBranches] = useState([])

  const listPath = '/app/admin-global/empresas'
  const parentEditPath = '/app/admin-global/empresas/nueva'

  const outletContext = useMemo(
    () => ({
      variant: 'create',
      listPath,
      parentEditPath,
      accessToken,
      businessName,
      setBusinessName,
      rut,
      setRut,
      businessActivity,
      setBusinessActivity,
      address,
      setAddress,
      commune,
      setCommune,
      city,
      setCity,
      region,
      setRegion,
      email,
      setEmail,
      phone,
      setPhone,
      nameLegal1,
      setNameLegal1,
      rutLegal1,
      setRutLegal1,
      nameLegal2,
      setNameLegal2,
      rutLegal2,
      setRutLegal2,
      branches,
      setBranches
    }),
    [
      listPath,
      parentEditPath,
      accessToken,
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
      branches
    ]
  )

  return <Outlet context={outletContext} />
}
