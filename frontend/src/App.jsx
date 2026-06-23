import { Provider } from 'react-redux'
import { MsalProvider } from '@azure/msal-react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthInitializer } from './auth/AuthInitializer'
import { msalInstance } from './auth/msalInstance'
import { AppRouter } from './routes/AppRouter'
import { store } from './store/store'
import { AbilityContext, ability } from './lib/ability'

function AppRoutes() {
  return (
    <AuthInitializer>
      <AppRouter />
    </AuthInitializer>
  )
}

const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }])

export default function App() {
  return (
    <Provider store={store}>
      <MsalProvider instance={msalInstance}>
        <AbilityContext.Provider value={ability}>
          <RouterProvider router={router} />
        </AbilityContext.Provider>
      </MsalProvider>
    </Provider>
  )
}
