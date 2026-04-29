import { Pool } from 'pg'

const supabaseDbUrl = process.env.SUPABASE_DB_URL
const neonDbUrl = process.env.NEON_DATABASE_URL

if (!supabaseDbUrl) console.warn('SUPABASE_DB_URL is missing')
if (neonDbUrl) console.info('NEON_DATABASE_URL configured')

export const supabasePool = new Pool({ connectionString: supabaseDbUrl, ssl: { rejectUnauthorized: false } })
export const neonPool = neonDbUrl
  ? new Pool({ connectionString: neonDbUrl, ssl: { rejectUnauthorized: false } })
  : null

export async function readWithFailover(queryText, params = []) {
  try {
    const result = await supabasePool.query(queryText, params)
    return { source: 'supabase', rows: result.rows }
  } catch (supErr) {
    if (!neonPool) throw supErr
    console.error('Supabase read failed, fallback Neon:', supErr.message)
    const result = await neonPool.query(queryText, params)
    return { source: 'neon', rows: result.rows }
  }
}

export async function writePrimaryThenBackup(queryText, params = []) {
  try {
    await supabasePool.query(queryText, params)
  } catch (supErr) {
    if (!neonPool) throw supErr
    console.error('Supabase write failed, writing Neon:', supErr.message)
    await neonPool.query(queryText, params)
    return { source: 'neon_fallback' }
  }

  if (!neonPool) return { source: 'supabase_only' }

  try {
    await neonPool.query(queryText, params)
    return { source: 'supabase_and_neon' }
  } catch (neonErr) {
    console.error('Neon replication failed:', neonErr.message)
    return { source: 'supabase_only' }
  }
}
