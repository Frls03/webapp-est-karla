import express from 'express'
import cors from 'cors'
import { authRequired } from './middleware/auth.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { dataRouter } from './routes/data.js'

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '3mb' }))

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/data', authRequired, dataRouter)

// Compatibility for serverless mounts where `/api` may already be consumed by the platform router.
app.use('/health', healthRouter)
app.use('/auth', authRouter)
app.use('/data', authRequired, dataRouter)

app.use((err, req, res, next) => {
  console.error(err)
  const status = Number(err?.statusCode || err?.status || 500)
  const error = status >= 500 ? 'internal_error' : err?.message || 'request_error'
  const message = err?.message || 'Unexpected error'
  res.status(status).json({ error, message })
})

export default app
