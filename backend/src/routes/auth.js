import { Router } from 'express'
import { z } from 'zod'
import { supabaseAuthClient } from '../lib/supabase.js'
import { authRequired } from '../middleware/auth.js'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })

  const { email, password } = parsed.data
  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({ email, password })
  if (error || !data?.session) {
    return res.status(401).json({ error: 'invalid_credentials', message: error?.message || 'Login failed' })
  }

  return res.json({ session: data.session, user: data.user })
})

authRouter.post('/logout', authRequired, async (req, res) => {
  await supabaseAuthClient.auth.signOut({ scope: 'local' })
  res.json({ ok: true })
})

authRouter.get('/me', authRequired, async (req, res) => {
  res.json({ user: req.auth.user, profile: req.auth.profile })
})
