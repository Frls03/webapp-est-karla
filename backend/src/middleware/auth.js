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
    const { data: adminProfile, error: adminProfileError } = await supabaseAdminClient
      .from('admin_profiles')
      .select('user_id, role, is_active, display_name, area, seller_name')
      .eq('user_id', user.id)
      .maybeSingle()
    if (adminProfileError) throw adminProfileError

    if (adminProfile?.is_active && adminProfile?.role === 'master') {
      req.auth = { user, profile: adminProfile, accessToken: token }
      next()
      return
    }

    const { data: advisorProfile, error: advisorProfileError } = await supabaseAdminClient
      .from('profiles')
      .select('id, full_name, role, is_active, area, seller_name')
      .eq('id', user.id)
      .maybeSingle()
    if (advisorProfileError) throw advisorProfileError
    if (!advisorProfile || !advisorProfile.is_active) {
      return res.status(403).json({ error: 'inactive_or_missing_profile' })
    }

    const normalizedAdvisor = {
      user_id: advisorProfile.id,
      display_name: advisorProfile.full_name,
      role: advisorProfile.role === 'master' ? 'master' : 'advisor',
      is_active: advisorProfile.is_active,
      area: advisorProfile.area,
      seller_name: advisorProfile.seller_name,
    }

    req.auth = { user, profile: normalizedAdvisor, accessToken: token }
    next()
  } catch (err) {
    next(err)
  }
}
