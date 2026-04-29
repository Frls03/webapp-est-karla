import { Router } from 'express'
import { z } from 'zod'
import { getDatasetSnapshot, saveDatasetSnapshot } from '../services/datasetService.js'

export const datasetRouter = Router()

const payloadSchema = z.object({
  dataset: z.any(),
})

datasetRouter.get('/', async (req, res, next) => {
  try {
    const snapshot = await getDatasetSnapshot()
    res.json(snapshot)
  } catch (err) {
    next(err)
  }
})

datasetRouter.put('/', async (req, res, next) => {
  try {
    const profile = req.auth.profile
    const parsed = payloadSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })

    const { dataset } = parsed.data

    if (profile.role !== 'master') {
      // Advisors can update dataset too, but this is still enforced by UI constraints.
      // If needed we can add deep server-side field-level permission checks later.
    }

    const write = await saveDatasetSnapshot(dataset, req.auth.user.id)
    res.json({ ok: true, write })
  } catch (err) {
    next(err)
  }
})

