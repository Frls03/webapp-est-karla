import 'dotenv/config'
import app from './app.js'

const PORT = Number(process.env.API_PORT || 4000)
const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
