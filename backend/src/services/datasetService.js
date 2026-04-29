import { readWithFailover, writePrimaryThenBackup } from '../lib/db.js'

const DEFAULT_KEY = 'global'

export async function getDatasetSnapshot() {
  const { rows, source } = await readWithFailover(
    `select dataset_json, updated_at from public.app_datasets where dataset_key = $1 limit 1`,
    [DEFAULT_KEY],
  )
  if (!rows.length) {
    return { source, dataset: null, updatedAt: null }
  }
  return { source, dataset: rows[0].dataset_json, updatedAt: rows[0].updated_at }
}

export async function saveDatasetSnapshot(datasetJson, userId) {
  const q = `
    insert into public.app_datasets(dataset_key, dataset_json, updated_by)
    values ($1, $2::jsonb, $3)
    on conflict (dataset_key)
    do update set dataset_json = excluded.dataset_json, updated_by = excluded.updated_by, updated_at = now()
  `
  const result = await writePrimaryThenBackup(q, [DEFAULT_KEY, JSON.stringify(datasetJson), userId])
  return result
}
