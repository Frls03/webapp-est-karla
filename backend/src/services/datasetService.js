import { supabaseAdminClient } from '../lib/supabase.js'

const DEFAULT_KEY = 'global'

export async function getDatasetSnapshot() {
  const { data, error } = await supabaseAdminClient
    .from('app_datasets')
    .select('dataset_json, updated_at')
    .eq('dataset_key', DEFAULT_KEY)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    return { source: 'supabase', dataset: null, updatedAt: null }
  }
  return { source: 'supabase', dataset: data.dataset_json, updatedAt: data.updated_at }
}

export async function saveDatasetSnapshot(datasetJson, userId) {
  const { error } = await supabaseAdminClient
    .from('app_datasets')
    .upsert(
      {
        dataset_key: DEFAULT_KEY,
        dataset_json: datasetJson,
        updated_by: userId,
      },
      { onConflict: 'dataset_key' },
    )
  if (error) throw error
  return { source: 'supabase_only' }
}
