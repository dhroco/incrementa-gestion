import { Route, Routes, Navigate } from 'react-router-dom'
import { AppShellLayout } from '../layout/AppShellLayout'
import { ShellProvider } from '../layout/ShellProvider'
import { DashboardPage } from '../pages/DashboardPage'
import { AccessDeniedPage } from '../pages/AccessDeniedPage'
import { LoginPage } from '../pages/LoginPage'
import { NoProfilePage } from '../pages/NoProfilePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { CompaniesCreateForm, CompaniesCreatePage } from '../pages/CompaniesCreatePage'
import { CompaniesEditForm, CompaniesEditPage } from '../pages/CompaniesEditPage'
import { CompaniesListPage } from '../pages/CompaniesListPage'
import { CompaniesViewPage } from '../pages/CompaniesViewPage'
import { PlatformUsersListPage } from '../pages/PlatformUsersListPage'
import { PlatformUserCreatePage } from '../pages/PlatformUserCreatePage'
import { PlatformUserEditPage } from '../pages/PlatformUserEditPage'
import { PlatformUserViewPage } from '../pages/PlatformUserViewPage'
import { RolesListPage } from '../pages/RolesListPage'
import { RoleCreatePage } from '../pages/RoleCreatePage'
import { RoleDetailPage } from '../pages/RoleDetailPage'
import { SupplierListPage } from '../pages/SupplierListPage'
import { SupplierViewPage } from '../pages/SupplierViewPage'
import { SupplierCreatePage, SupplierEditPage } from '../pages/SupplierUpsertPage'
import { ClientListPage } from '../pages/ClientListPage'
import { ClientViewPage } from '../pages/ClientViewPage'
import { ClientCreatePage, ClientEditPage } from '../pages/ClientUpsertPage'
import { StandardTemplatesListPage } from '../pages/StandardTemplatesListPage'
import { StandardTemplateCreatePage } from '../pages/StandardTemplateCreatePage'
import { StandardTemplateEditPage } from '../pages/StandardTemplateEditPage'
import { StandardTemplateViewPage } from '../pages/StandardTemplateViewPage'
import { DocumentBuilderPage } from '../pages/DocumentBuilderPage'
import { DocumentBuilderPreviewPage } from '../pages/DocumentBuilderPreviewPage'
import { ContractsListPage } from '../pages/ContractsListPage'
import { ContractSigningPage } from '../pages/ContractSigningPage'
import { MyProfilePage } from '../pages/MyProfilePage'
import { DEFAULT_PRIVATE_PATH } from '../navigation/menuConfig'
import { GuestOnlyRoute } from './GuestOnlyRoute'
import { PrivateAppGate } from './PrivateAppGate'
import { ProfileNavGuard } from './ProfileNavGuard'
import { RequireAuth } from './RequireAuth'
import { RequireCan, RequireCanAny } from './RequireCan'

function AppShellWithProvider() {
  return (
    <ShellProvider>
      <AppShellLayout />
    </ShellProvider>
  )
}

export function AppRouter() {
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
      <Route element={<RequireAuth />}>
        <Route path="/sin-perfil" element={<NoProfilePage />} />
        <Route element={<PrivateAppGate />}>
          <Route path="/app" element={<AppShellWithProvider />}>
            <Route element={<ProfileNavGuard />}>
              <Route index element={<Navigate to={DEFAULT_PRIVATE_PATH.replace('/app/', '')} replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="mi-perfil" element={<MyProfilePage />} />
              <Route
                path="admin-global/empresas/nueva"
                element={
                  <RequireCan I="create" a="Company">
                    <CompaniesCreatePage />
                  </RequireCan>
                }
              >
                <Route index element={<CompaniesCreateForm />} />
              </Route>
              <Route
                path="admin-global/empresas/:id/edit"
                element={
                  <RequireCan I="update" a="Company">
                    <CompaniesEditPage />
                  </RequireCan>
                }
              >
                <Route index element={<CompaniesEditForm />} />
              </Route>
              <Route
                path="admin-global/empresas/:id"
                element={
                  <RequireCan I="read" a="Company">
                    <CompaniesViewPage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/empresas"
                element={
                  <RequireCan I="read" a="Company">
                    <CompaniesListPage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/usuarios-plataforma/nuevo"
                element={
                  <RequireCan I="create" a="PlatformUser">
                    <PlatformUserCreatePage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/usuarios-plataforma/:id/edit"
                element={
                  <RequireCan I="update" a="PlatformUser">
                    <PlatformUserEditPage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/usuarios-plataforma/:id"
                element={
                  <RequireCan I="read" a="PlatformUser">
                    <PlatformUserViewPage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/usuarios-plataforma"
                element={
                  <RequireCan I="read" a="PlatformUser">
                    <PlatformUsersListPage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/roles-permisos/nuevo"
                element={
                  <RequireCan I="create" a="RolePermission">
                    <RoleCreatePage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/roles-permisos/:id/edit"
                element={
                  <RequireCan I="update" a="RolePermission">
                    <RoleDetailPage mode="edit" />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/roles-permisos/:id"
                element={
                  <RequireCan I="read" a="RolePermission">
                    <RoleDetailPage mode="view" />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/roles-permisos"
                element={
                  <RequireCan I="read" a="RolePermission">
                    <RolesListPage />
                  </RequireCan>
                }
              />
              <Route
                path="proveedores/nuevo"
                element={
                  <RequireCan I="create" a="Supplier">
                    <SupplierCreatePage />
                  </RequireCan>
                }
              />
              <Route
                path="proveedores/:id/edit"
                element={
                  <RequireCanAny actions={['update', 'create']} a="Supplier">
                    <SupplierEditPage />
                  </RequireCanAny>
                }
              />
              <Route
                path="proveedores/:id"
                element={
                  <RequireCan I="read" a="Supplier">
                    <SupplierViewPage />
                  </RequireCan>
                }
              />
              <Route
                path="proveedores"
                element={
                  <RequireCan I="read" a="Supplier">
                    <SupplierListPage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/clientes/nuevo"
                element={
                  <RequireCan I="create" a="Client">
                    <ClientCreatePage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/clientes/:id/edit"
                element={
                  <RequireCan I="update" a="Client">
                    <ClientEditPage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/clientes/:id"
                element={
                  <RequireCan I="read" a="Client">
                    <ClientViewPage />
                  </RequireCan>
                }
              />
              <Route
                path="admin-global/clientes"
                element={
                  <RequireCan I="read" a="Client">
                    <ClientListPage />
                  </RequireCan>
                }
              />
              <Route
                path="gestion-contratos/templates-estandar/nueva"
                element={
                  <RequireCan I="create" a="Template">
                    <StandardTemplateCreatePage />
                  </RequireCan>
                }
              />
              <Route
                path="gestion-contratos/templates-estandar/:id/edit"
                element={
                  <RequireCan I="update" a="Template">
                    <StandardTemplateEditPage />
                  </RequireCan>
                }
              />
              <Route
                path="gestion-contratos/templates-estandar/:id"
                element={
                  <RequireCan I="read" a="Template">
                    <StandardTemplateViewPage />
                  </RequireCan>
                }
              />
              <Route
                path="gestion-contratos/templates-estandar"
                element={
                  <RequireCan I="read" a="Template">
                    <StandardTemplatesListPage />
                  </RequireCan>
                }
              />
              <Route
                path="gestion-contratos/constructor-documento"
                element={
                  <RequireCan I="use" a="DocumentBuilder">
                    <DocumentBuilderPage />
                  </RequireCan>
                }
              />
              <Route
                path="gestion-contratos/constructor-documento/preview"
                element={
                  <RequireCan I="use" a="DocumentBuilder">
                    <DocumentBuilderPreviewPage />
                  </RequireCan>
                }
              />
              <Route
                path="gestion-contratos/consulta-contratos"
                element={
                  <RequireCan I="read" a="Contract">
                    <ContractsListPage />
                  </RequireCan>
                }
              />
              <Route
                path="gestion-contratos/firma-documento"
                element={
                  <RequireCan I="sign" a="Contract">
                    <ContractSigningPage />
                  </RequireCan>
                }
              />
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
