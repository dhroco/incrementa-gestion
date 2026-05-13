import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShellLayout } from '../layout/AppShellLayout'
import { ShellProvider } from '../layout/ShellProvider'
import { DashboardPage } from '../pages/DashboardPage'
import { ContratosPage } from '../pages/ContratosPage'
import { AccessDeniedPage } from '../pages/AccessDeniedPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { LoginPage } from '../pages/LoginPage'
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage'
import { NoProfilePage } from '../pages/NoProfilePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import ClauseEditorTest from '../pages/ClauseEditorTest'
import { ClauseUniversalCreatePage } from '../pages/ClauseUniversalCreatePage'
import { ClauseUniversalListPage } from '../pages/ClauseUniversalListPage'
import { ClauseUniversalViewPage } from '../pages/ClauseUniversalViewPage'
import { ClauseCompanyListPage } from '../pages/ClauseCompanyListPage'
import { ClauseCompanyCreatePage } from '../pages/ClauseCompanyCreatePage'
import { ClauseCompanyViewPage } from '../pages/ClauseCompanyViewPage'
import { ClauseEditPage } from '../pages/ClauseEditPage'
import { CompaniesCreateForm, CompaniesCreatePage } from '../pages/CompaniesCreatePage'
import { CompaniesEditForm, CompaniesEditPage } from '../pages/CompaniesEditPage'
import { CompanyBranchWorkPage } from '../pages/CompanyBranchWorkPage'
import { CompaniesListPage } from '../pages/CompaniesListPage'
import { CompaniesViewPage } from '../pages/CompaniesViewPage'
import { AccountantsListPage } from '../pages/AccountantsListPage'
import { AccountantCreatePage } from '../pages/AccountantCreatePage'
import { AccountantEditPage } from '../pages/AccountantEditPage'
import { AccountantInactivePage } from '../pages/AccountantInactivePage'
import { PlatformUsersListPage } from '../pages/PlatformUsersListPage'
import { PlatformUserCreatePage } from '../pages/PlatformUserCreatePage'
import { PlatformUserEditPage } from '../pages/PlatformUserEditPage'
import { PlatformUserViewPage } from '../pages/PlatformUserViewPage'
import { CompanyInternalUsersListPage } from '../pages/CompanyInternalUsersListPage'
import { EmployeesListPage } from '../pages/EmployeesListPage'
import { EmployeeViewPage } from '../pages/EmployeeViewPage'
import { EmployeeCreatePage, EmployeeEditPage } from '../pages/EmployeeUpsertPage'
import { CompanyInternalUserViewPage } from '../pages/CompanyInternalUserViewPage'
import { CompanyInternalUserCreatePage } from '../pages/CompanyInternalUserCreatePage'
import { CompanyInternalUserEditPage } from '../pages/CompanyInternalUserEditPage'
import { AccountantViewPage } from '../pages/AccountantViewPage'
import { StandardTemplatesListPage } from '../pages/StandardTemplatesListPage'
import { StandardTemplateCreatePage } from '../pages/StandardTemplateCreatePage'
import { StandardTemplateEditPage } from '../pages/StandardTemplateEditPage'
import { StandardTemplateViewPage } from '../pages/StandardTemplateViewPage'
import { CompanyTemplatesListPage } from '../pages/CompanyTemplatesListPage'
import { CompanyTemplateCreatePage } from '../pages/CompanyTemplateCreatePage'
import { CompanyTemplateEditPage } from '../pages/CompanyTemplateEditPage'
import { CompanyTemplateViewPage } from '../pages/CompanyTemplateViewPage'
import { DocumentBuilderPage } from '../pages/DocumentBuilderPage'
import { DocumentBuilderPreviewPage } from '../pages/DocumentBuilderPreviewPage'
import { MandatoryPasswordChangePage } from '../pages/MandatoryPasswordChangePage'
import {
  buildPrivateModuleRouteDefinitions,
  getDefaultPrivateRelativePathFromRoutes
} from '../navigation/authorizationSelectors'
import { TRABAJADORES_MUTATE_GRANT_CODES } from '../navigation/trabajadoresAuth'
import { selectEnrichedNavigation } from '../store/authSlice'
import { GuestOnlyRoute } from './GuestOnlyRoute'
import { PrivateAppGate } from './PrivateAppGate'
import { ProfileNavGuard } from './ProfileNavGuard'
import { RequireAuth } from './RequireAuth'
import { RequireNavigationGrant } from './RequireNavigationGrant'

function AppShellWithProvider() {
  return (
    <ShellProvider>
      <AppShellLayout />
    </ShellProvider>
  )
}

export function AppRouter() {
  const navigation = useSelector(selectEnrichedNavigation)
  const { defaultRelativePath, moduleRouteDefs } = useMemo(() => {
    const routes = navigation?.routes
    const exclude = new Set([
      'dashboard',
      'contratos',
      'acceso-denegado',
      'admin-global/empresas',
      'admin-global/contadores',
      'admin-global/usuarios-plataforma',
      'admin-global/usuarios-internos-empresa',
      'admin-global/usuarios-internos-empresa/nuevo',
      'gestion-contratos/clausulas-universales',
      'gestion-contratos/clausulas-por-empresa',
      'gestion-contratos/contratos-por-empresa',
      'gestion-contratos/templates-estandar',
      'gestion-contratos/templates-por-empresa',
      'gestion-contratos/constructor-documento',
      'trabajadores'
    ])
    return {
      defaultRelativePath: getDefaultPrivateRelativePathFromRoutes(routes) ?? 'acceso-denegado',
      moduleRouteDefs: buildPrivateModuleRouteDefinitions(routes, { excludeRelativePaths: exclude })
    }
  }, [navigation])

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          <GuestOnlyRoute>
            <LoginPage />
          </GuestOnlyRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/sin-perfil" element={<NoProfilePage />} />
        <Route element={<PrivateAppGate />}>
          <Route path="/app/cuenta-inactiva" element={<AccountantInactivePage />} />
          <Route path="/app/cambiar-clave" element={<MandatoryPasswordChangePage />} />
          <Route path="/app" element={<AppShellWithProvider />}>
            <Route element={<ProfileNavGuard />}>
              <Route index element={<Navigate to={defaultRelativePath} replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="contratos" element={<ContratosPage />} />
              <Route
                path="gestion-contratos/contratos-por-empresa"
                element={
                  <ContratosPage
                    title="Contratos por empresa"
                    subtitle="Bandeja de contratos por empresa. Próximamente podrá crear y gestionar contratos."
                  />
                }
              />
              <Route path="clause-editor-test" element={<ClauseEditorTest />} />
              {/* Menu routes (from DB navigation seeds) */}
              <Route
                path="admin-global/empresas/nueva"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_CREATE">
                    <CompaniesCreatePage />
                  </RequireNavigationGrant>
                }
              >
                <Route index element={<CompaniesCreateForm />} />
                <Route path="sucursales/nueva" element={<CompanyBranchWorkPage mode="new" />} />
                <Route path="sucursales/:branchKey" element={<CompanyBranchWorkPage mode="edit" />} />
              </Route>
              <Route path="admin-global/empresas/:id/edit" element={<CompaniesEditPage />}>
                <Route index element={<CompaniesEditForm />} />
                <Route path="sucursales/nueva" element={<CompanyBranchWorkPage mode="new" />} />
                <Route path="sucursales/:branchKey" element={<CompanyBranchWorkPage mode="edit" />} />
              </Route>
              <Route path="admin-global/empresas/:id" element={<CompaniesViewPage />} />
              <Route path="admin-global/empresas" element={<CompaniesListPage />} />
              <Route path="admin-global/contadores/nuevo" element={<AccountantCreatePage />} />
              <Route path="admin-global/contadores/:id/edit" element={<AccountantEditPage />} />
              <Route
                path="admin-global/contadores/:id"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ">
                    <AccountantViewPage />
                  </RequireNavigationGrant>
                }
              />
              <Route path="admin-global/contadores" element={<AccountantsListPage />} />
              <Route path="admin-global/usuarios-plataforma/nuevo" element={<PlatformUserCreatePage />} />
              <Route path="admin-global/usuarios-plataforma/:id/edit" element={<PlatformUserEditPage />} />
              <Route
                path="admin-global/usuarios-plataforma/:id"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_READ">
                    <PlatformUserViewPage />
                  </RequireNavigationGrant>
                }
              />
              <Route path="admin-global/usuarios-plataforma" element={<PlatformUsersListPage />} />
              <Route
                path="admin-global/usuarios-internos-empresa/nuevo"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE">
                    <CompanyInternalUserCreatePage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="admin-global/usuarios-internos-empresa/:id/edit"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT">
                    <CompanyInternalUserEditPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="admin-global/usuarios-internos-empresa/:id"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ">
                    <CompanyInternalUserViewPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="admin-global/usuarios-internos-empresa"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ">
                    <CompanyInternalUsersListPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="trabajadores/nuevo"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE">
                    <EmployeeCreatePage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="trabajadores/:id/edit"
                element={
                  <RequireNavigationGrant anyOfCodes={TRABAJADORES_MUTATE_GRANT_CODES}>
                    <EmployeeEditPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="trabajadores/:id"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_TRABAJADORES_TRABAJADORES_READ">
                    <EmployeeViewPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="trabajadores"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_TRABAJADORES_TRABAJADORES_READ">
                    <EmployeesListPage />
                  </RequireNavigationGrant>
                }
              />
              <Route path="gestion-contratos/clausulas-universales/nueva" element={<ClauseUniversalCreatePage />} />
              <Route
                path="gestion-contratos/clausulas-universales/:id/edit"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT">
                    <ClauseEditPage />
                  </RequireNavigationGrant>
                }
              />
              <Route path="gestion-contratos/clausulas-universales/:id" element={<ClauseUniversalViewPage />} />
              <Route path="gestion-contratos/clausulas-universales" element={<ClauseUniversalListPage />} />
              <Route path="gestion-contratos/clausulas-por-empresa" element={<ClauseCompanyListPage />} />
              <Route path="gestion-contratos/clausulas-por-empresa/nueva" element={<ClauseCompanyCreatePage />} />
              <Route
                path="gestion-contratos/clausulas-por-empresa/:id/edit"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_EDIT">
                    <ClauseEditPage />
                  </RequireNavigationGrant>
                }
              />
              <Route path="gestion-contratos/clausulas-por-empresa/:id" element={<ClauseCompanyViewPage />} />
              <Route
                path="gestion-contratos/templates-estandar/nueva"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE">
                    <StandardTemplateCreatePage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/templates-estandar/:id/edit"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_EDIT">
                    <StandardTemplateEditPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/templates-estandar/:id"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ">
                    <StandardTemplateViewPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/templates-estandar"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ">
                    <StandardTemplatesListPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/templates-por-empresa/nueva"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_CREATE">
                    <CompanyTemplateCreatePage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/templates-por-empresa/:id/edit"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_EDIT">
                    <CompanyTemplateEditPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/templates-por-empresa/:id"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ">
                    <CompanyTemplateViewPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/templates-por-empresa"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ">
                    <CompanyTemplatesListPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/constructor-documento"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO">
                    <DocumentBuilderPage />
                  </RequireNavigationGrant>
                }
              />
              <Route
                path="gestion-contratos/constructor-documento/preview"
                element={
                  <RequireNavigationGrant navigationCode="NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO">
                    <DocumentBuilderPreviewPage />
                  </RequireNavigationGrant>
                }
              />
              {moduleRouteDefs.map((d) => (
                <Route
                  key={d.absolutePath}
                  path={d.relativePath}
                  element={<ModulePlaceholderPage title={d.title} />}
                />
              ))}
              <Route path="acceso-denegado" element={<AccessDeniedPage />} />
              <Route path="*" element={<NotFoundPage mode="private" />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage mode="public" />} />
    </Routes>
  )
}
