import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  console.warn('Missing Supabase URL/Anon key')
}

export const supabaseAuthClient = createClient(supabaseUrl || '', supabaseAnon || '', {
  auth: { persistSession: false, autoRefreshToken: false },
})
