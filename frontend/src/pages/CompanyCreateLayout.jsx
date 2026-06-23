import { useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
/**
 * Estado del formulario de creación de empresa compartido con rutas hijas.
 */
export function CompanyCreateLayout() {

  const [businessName, setBusinessName] = useState('')
  const [shortName, setShortName] = useState('')
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

  const listPath = '/app/admin-global/empresas'

  const outletContext = useMemo(
    () => ({
      variant: 'create',
      listPath,
      businessName,
      setBusinessName,
      shortName,
      setShortName,
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
      setRutLegal2
    }),
    [
      listPath,
      businessName,
      shortName,
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
      rutLegal2
    ]
  )

  return <Outlet context={outletContext} />
}
