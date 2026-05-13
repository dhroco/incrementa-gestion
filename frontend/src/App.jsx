import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { AuthInitializer } from './auth/AuthInitializer'
import { AppRouter } from './routes/AppRouter'
import { store } from './store/store'

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AuthInitializer />
        <AppRouter />
      </BrowserRouter>
    </Provider>
  )
}
