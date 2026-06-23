import { useEffect, useMemo, useState } from 'react'
import { useAbility } from '@casl/react'
import { useSelector } from 'react-redux'
import { Outlet, useParams } from 'react-router-dom'
import { fetchCompanyDetail } from '../api/companiesApi'
import { selectEnrichedCompany, selectEnrichedProfile } from '../store/authSlice'
import { AbilityContext } from '../lib/ability'
import { formatRut } from '../utils/rut'



/**

 * Carga estado de edición de empresa y lo expone a rutas hijas.

 */

export function CompanyEditLayout() {

  const { id } = useParams()
  const ability = useAbility(AbilityContext)
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)

  const allowedToEdit = ability.can('update', 'Company')



  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(null)

  const [entity, setEntity] = useState(null)



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



  useEffect(() => {

    let active = true

    async function run() {

      if (!id) return

      setLoading(true)

      setError(null)

      const res = await fetchCompanyDetail(id, {})

      if (!active) return

      if (!res.ok) {

        setLoading(false)

        setError(res.message)

        setEntity(null)

        return

      }

      const e = res.data

      setEntity(e)

      setBusinessName(e?.business_name ?? '')

      setShortName(e?.short_name ?? '')

      setRut(e?.rut_body ? formatRut(e.rut_body, e.rut_dv) : '')

      setBusinessActivity(e?.business_activity ?? '')

      setAddress(e?.address ?? '')

      setCommune(e?.commune ?? '')

      setCity(e?.city ?? '')

      setRegion(e?.region ?? '')

      setEmail(e?.email ?? '')

      setPhone(e?.phone ?? '')

      setNameLegal1(e?.name_legal_representative_1 ?? '')

      setRutLegal1(

        e?.rut_body_legal_representative_1 ? formatRut(e.rut_body_legal_representative_1, e.rut_dv_legal_representative_1) : ''

      )

      setNameLegal2(e?.name_legal_representative_2 ?? '')

      setRutLegal2(

        e?.rut_body_legal_representative_2 ? formatRut(e.rut_body_legal_representative_2, e.rut_dv_legal_representative_2) : ''

      )



      if (active) setLoading(false)

    }

    run()

    return () => {

      active = false

    }

  }, [id])



  const listPath = '/app/admin-global/empresas'



  const outletContext = useMemo(

    () => ({

      variant: 'edit',

      companyId: id,

      listPath,

      loading,

      error,

      entity,

      allowedToEdit,

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

      id,

      listPath,

      loading,

      error,

      entity,

      allowedToEdit,

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

