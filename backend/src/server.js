import 'dotenv/config'
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

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'internal_error', message: err?.message || 'Unexpected error' })
})

const PORT = Number(process.env.API_PORT || 4000)
const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
