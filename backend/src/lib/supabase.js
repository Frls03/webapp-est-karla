import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnon) {
  console.warn('Missing Supabase URL/Anon key')
}
if (!supabaseUrl || !supabaseServiceRole) {
  console.warn('Missing Supabase URL/Service Role key')
}

export const supabaseAuthClient = createClient(supabaseUrl || '', supabaseAnon || '', {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const supabaseAdminClient = createClient(supabaseUrl || '', supabaseServiceRole || '', {
  auth: { persistSession: false, autoRefreshToken: false },
})
