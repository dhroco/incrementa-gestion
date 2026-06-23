const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? 'dc734f4a-5f25-4e88-b728-aab4715f2122'
const authority =
  import.meta.env.VITE_AZURE_AUTHORITY ??
  'https://login.microsoftonline.com/60322b4a-13bf-4f19-89ae-efe4a54ffed6'

export const API_SCOPE =
  import.meta.env.VITE_AZURE_API_SCOPE ?? `api://${clientId}/access_as_user`

const redirectOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:5173'

export const msalConfig = {
  auth: {
    clientId,
    authority,
    redirectUri: redirectOrigin,
    postLogoutRedirectUri: redirectOrigin
  },
  cache: {
    cacheLocation: 'localStorage'
  }
}
