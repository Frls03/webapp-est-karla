import { supabaseAuthClient, supabaseAdminClient } from '../lib/supabase.js'

function parseBearer(req) {
  const auth = req.headers.authorization || ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  return auth.slice(7).trim()
}

export async function authRequired(req, res, next) {
  try {
    const token = parseBearer(req)
    if (!token) return res.status(401).json({ error: 'missing_token' })

    const { data, error } = await supabaseAuthClient.auth.getUser(token)
    if (error || !data?.user) return res.status(401).json({ error: 'invalid_token' })

    const user = data.user
    const { data: profile, error: profileError } = await supabaseAdminClient
      .from('admin_profiles')
      .select('user_id, role, is_active, display_name, area, seller_name')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile || !profile.is_active) {
      return res.status(403).json({ error: 'inactive_or_missing_profile' })
    }

    req.auth = { user, profile, accessToken: token }
    next()
  } catch (err) {
    next(err)
  }
}
