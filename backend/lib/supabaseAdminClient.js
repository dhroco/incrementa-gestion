const { createClient } = require('@supabase/supabase-js')
const config = require('../config')

let singleton = null

/**
 * Cliente Supabase con service role (solo operaciones administrativas en servidor).
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
function getSupabaseAdminClient() {
  const url = config.SUPABASE_URL
  const key = config.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!singleton) {
    singleton = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  }
  return singleton
}

function resetSupabaseAdminClientForTests() {
  singleton = null
}

module.exports = { getSupabaseAdminClient, resetSupabaseAdminClientForTests }
