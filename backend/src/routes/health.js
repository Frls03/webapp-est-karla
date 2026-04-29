import { Router } from 'express'

export const healthRouter = Router()

function extractProjectRef(urlValue) {
  const value = String(urlValue || '')
  const match = value.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i)
  return match ? match[1] : null
}

healthRouter.get('/', async (req, res) => {
  const debug = String(req.query.debug || '') === '1'
  const payload = { ok: true, service: 'crm-api', ts: new Date().toISOString() }
  if (debug) {
    payload.env = process.env.VERCEL_ENV || 'local'
    payload.supabaseUrlRef = extractProjectRef(process.env.SUPABASE_URL)
    payload.viteSupabaseUrlRef = extractProjectRef(process.env.VITE_SUPABASE_URL)
    payload.hasAnon = Boolean(process.env.SUPABASE_ANON_KEY)
    payload.hasViteAnon = Boolean(process.env.VITE_SUPABASE_ANON_KEY)
    payload.hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  }
  res.json(payload)
})
