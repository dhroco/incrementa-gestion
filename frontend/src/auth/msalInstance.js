import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from '../config/msalConfig'

export const msalInstance = new PublicClientApplication(msalConfig)
