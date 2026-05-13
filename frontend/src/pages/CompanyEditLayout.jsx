import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Outlet, useParams } from 'react-router-dom'
import { fetchAccountantsCatalog, fetchCompanyAccountants, fetchCompanyDetail } from '../api/companiesApi'
import { mapApiBranchToRow } from '../components/CompanyFormSections'
import { selectEnrichedCompany, selectEnrichedNavigation, selectEnrichedProfile, selectSession } from '../store/authSlice'
import { buildGrantedCodeSetFromSession } from '../navigation/authorizationSelectors'
import { formatRut } from '../utils/rut'

/**
 * Carga estado de edición de empresa y lo expone a rutas hijas (formulario principal, sucursal).
 */
export function CompanyEditLayout() {
  const { id } = useParams()
  const session = useSelector(selectSession)
  const navigation = useSelector(selectEnrichedNavigation)
  const profile = useSelector(selectEnrichedProfile)
  const enrichedCompany = useSelector(selectEnrichedCompany)
  const accessToken = session?.access_token ?? null

  const grantedCodes = useMemo(() => buildGrantedCodeSetFromSession(navigation), [navigation])
  const canAssign = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS')
  const canEditAsPlatform = grantedCodes.has('NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_EDIT')
  const canEditOwnCompany =
    profile?.code === 'USUARIO_EMPRESA_ADMINISTRADOR' && enrichedCompany?.id && id === enrichedCompany.id
  const allowedToEdit = canEditAsPlatform || canEditOwnCompany

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [entity, setEntity] = useState(null)

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

  const [accountantsCatalog, setAccountantsCatalog] = useState([])
  const [selectedAccountantIds, setSelectedAccountantIds] = useState([])

  useEffect(() => {
    let active = true
    async function run() {
      if (!id || !accessToken) return
      setLoading(true)
      setError(null)
      const res = await fetchCompanyDetail(id, { accessToken })
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
      const br = Array.isArray(e?.branches) ? e.branches.map(mapApiBranchToRow) : []
      setBranches(br)

      if (canAssign) {
        const [cat, assigned] = await Promise.all([
          fetchAccountantsCatalog({ accessToken }),
          fetchCompanyAccountants(id, { accessToken })
        ])
        if (active) {
          setAccountantsCatalog(Array.isArray(cat?.data?.items) ? cat.data.items : [])
          setSelectedAccountantIds(
            Array.isArray(assigned?.data?.items) ? assigned.data.items.map((x) => x.id).filter(Boolean) : []
          )
        }
      }
      if (active) setLoading(false)
    }
    run()
    return () => {
      active = false
    }
  }, [id, accessToken, canAssign])

  const listPath = '/app/admin-global/empresas'
  const parentEditPath = `/app/admin-global/empresas/${id}/edit`

  const outletContext = useMemo(
    () => ({
      variant: 'edit',
      companyId: id,
      listPath,
      parentEditPath,
      loading,
      error,
      entity,
      allowedToEdit,
      accessToken,
      canAssign,
      accountantsCatalog,
      selectedAccountantIds,
      setSelectedAccountantIds,
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
      id,
      listPath,
      parentEditPath,
      loading,
      error,
      entity,
      allowedToEdit,
      accessToken,
      canAssign,
      accountantsCatalog,
      selectedAccountantIds,
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
