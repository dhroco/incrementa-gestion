import { createClient } from '@supabase/supabase-js'
import config from '../../config.js'

/** Valores sustituibles solo para construir el cliente; deben reemplazarse en config.js para un proyecto real. */
const PLACEHOLDER_SUPABASE_URL = 'https://invalid.localhost'
const PLACEHOLDER_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIn0.placeholder'

function warnIfSupabaseConfigMissing() {
  if (!config.DEBUG) return
  const url = typeof config.supabaseUrl === 'string' ? config.supabaseUrl.trim() : ''
  const key = typeof config.supabaseAnonKey === 'string' ? config.supabaseAnonKey.trim() : ''
  if (!url || !key) {
    console.error(
      '[GFA] Configuración Supabase incompleta: defina `supabaseUrl` y `supabaseAnonKey` en frontend/config.js para el ambiente actual (ENVIRONMENT=%s).',
      config.ENVIRONMENT
    )
  }
}

warnIfSupabaseConfigMissing()

const resolvedUrl = (typeof config.supabaseUrl === 'string' && config.supabaseUrl.trim()) || PLACEHOLDER_SUPABASE_URL
const resolvedKey =
  (typeof config.supabaseAnonKey === 'string' && config.supabaseAnonKey.trim()) || PLACEHOLDER_SUPABASE_ANON_KEY

export const supabase = createClient(resolvedUrl, resolvedKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
