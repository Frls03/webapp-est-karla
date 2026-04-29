import { Router } from 'express'
import { z } from 'zod'
import { readWithFailover, writePrimaryThenBackup } from '../lib/db.js'

export const dataRouter = Router()

const saveSchema = z.object({
  area: z.enum(['superior', 'ejecutivo', 'incompany']),
  criterion: z.string().min(1),
  record: z.record(z.string(), z.any()),
})

const updateSchema = z.object({
  area: z.enum(['superior', 'ejecutivo', 'incompany']),
  criterion: z.string().min(1),
  record: z.record(z.string(), z.any()),
})

const programSchema = z.object({
  name: z.string().min(1),
  cycle: z.enum([
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
    'anual',
  ]),
  goalQ: z.number().min(0),
})

const goalSchema = z.object({
  area: z.enum(['superior', 'ejecutivo', 'incompany']),
  criterion: z.string().min(1),
  seller: z.string().nullable().optional(),
  month: z.number().int().min(1).max(12).nullable().optional(),
  value: z.number(),
  periodType: z.enum(['mensual', 'bimestral', 'trimestral', 'semestral', 'anual']).optional(),
  year: z.number().int().optional(),
})

const MONTH_TO_NUM = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

function monthNum(monthText) {
  const key = String(monthText || '').toLowerCase()
  return MONTH_TO_NUM[key] || 1
}

function buildBusinessInsert(area, criterion, record, userId) {
  const month = monthNum(record.month)
  const year = Number(record.year || new Date().getFullYear())
  const seller = record.seller || ''

  const map = {
    'superior:leads': {
      q: `insert into public.superior_leads(month, year, seller_name, nombre, carrera, estado, venta_q, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      p: [month, year, seller, record.nombre || '', record.carrera || '', record.estado || '', Number(record.ventaQ || 0), userId, userId],
    },
    'superior:alianzas': {
      q: `insert into public.superior_alianzas(month, year, seller_name, empresa, estatus, fecha_escritorio, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      p: [month, year, seller, record.empresa || '', record.estatus || '', record.fechaEscritorio || null, userId, userId],
    },
    'superior:contactabilidad': {
      q: `insert into public.superior_contactabilidad(month, year, seller_name, contactados, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6)`,
      p: [month, year, seller, Number(record.contactados || 0), userId, userId],
    },
    'superior:resumen': {
      q: `insert into public.superior_resumen(month, year, seller_name, propuestas, alianzas_trabajadas, citas, contactabilidad, venta_q, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      p: [
        month,
        year,
        seller,
        Number(record.propuestas || 0),
        Number(record.alianzasTrabajadas || 0),
        Number(record.citas || 0),
        Number(record.contactabilidad || 0),
        Number(record.venta || 0),
        userId,
        userId,
      ],
    },
    'superior:metas': {
      q: `insert into public.superior_metas_programa(month, year, seller_name, bado, bmi, bas, mlt, mgp, mia, mba, total, is_cumplimiento, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12,$13)
          on conflict (year, month, seller_name, is_cumplimiento) do update
          set bado=excluded.bado,bmi=excluded.bmi,bas=excluded.bas,mlt=excluded.mlt,mgp=excluded.mgp,mia=excluded.mia,mba=excluded.mba,total=excluded.total,updated_by=excluded.updated_by`,
      p: [month, year, seller, Number(record.bado || 0), Number(record.bmi || 0), Number(record.bas || 0), Number(record.mlt || 0), Number(record.mgp || 0), Number(record.mia || 0), Number(record.mba || 0), Number(record.total || 0), userId, userId],
    },
    'superior:cumplimiento': {
      q: `insert into public.superior_metas_programa(month, year, seller_name, bado, bmi, bas, mlt, mgp, mia, mba, total, is_cumplimiento, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13)
          on conflict (year, month, seller_name, is_cumplimiento) do update
          set bado=excluded.bado,bmi=excluded.bmi,bas=excluded.bas,mlt=excluded.mlt,mgp=excluded.mgp,mia=excluded.mia,mba=excluded.mba,total=excluded.total,updated_by=excluded.updated_by`,
      p: [month, year, seller, Number(record.bado || 0), Number(record.bmi || 0), Number(record.bas || 0), Number(record.mlt || 0), Number(record.mgp || 0), Number(record.mia || 0), Number(record.mba || 0), Number(record.total || 0), userId, userId],
    },
    'ejecutivo:leads': {
      q: `insert into public.ejecutivo_leads(month, year, seller_name, empresa, cliente, program_id, program_name, estatus, venta_q, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      p: [month, year, seller, record.empresa || '', record.cliente || '', record.programId || null, record.programName || '', record.estatus || '', Number(record.ventaQ || 0), userId, userId],
    },
    'ejecutivo:llamadas': {
      q: `insert into public.ejecutivo_llamadas(month, year, seller_name, total_llamadas, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6)`,
      p: [month, year, seller, Number(record.totalLlamadas || 0), userId, userId],
    },
    'ejecutivo:datosActualizados': {
      q: `insert into public.ejecutivo_datos_actualizados(month, year, seller_name, empresa, nombre, cargo, telefono, correo, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      p: [month, year, seller, record.empresa || '', record.nombre || '', record.cargo || '', record.telefono || '', record.correo || '', userId, userId],
    },
    'ejecutivo:clientesNuevos': {
      q: `insert into public.ejecutivo_clientes_nuevos(month, year, seller_name, empresa, nombre, cargo, telefono, correo, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      p: [month, year, seller, record.empresa || '', record.nombre || '', record.cargo || '', record.telefono || '', record.correo || '', userId, userId],
    },
    'ejecutivo:facturacion': {
      q: `insert into public.ejecutivo_facturacion(month, year, seller_name, fecha, empresa, tipo_curso, nombre_curso, importe, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      p: [month, year, seller, record.fecha || null, record.empresa || '', record.tipoCurso || '', record.nombreCurso || '', Number(record.importe || 0), userId, userId],
    },
    'incompany:propuestas': {
      q: `insert into public.incompany_propuestas(month, year, seller_name, fecha, empresa, tipologia_curso, nombre_curso, inversion, estatus, total_final_q, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      p: [month, year, seller, record.fecha || null, record.empresa || '', record.tipologiaCurso || '', record.nombreCurso || '', Number(record.inversion || 0), record.estatus || '', Number(record.totalFinalQ || 0), userId, userId],
    },
    'incompany:citas': {
      q: `insert into public.incompany_citas(month, year, seller_name, fecha, empresa, contacto, motivo, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      p: [month, year, seller, record.fecha || null, record.empresa || '', record.contacto || '', record.motivo || '', userId, userId],
    },
    'incompany:facturacion': {
      q: `insert into public.incompany_facturacion(month, year, seller_name, fecha, empresa, tipo_curso, nombre_curso, importe, created_by, updated_by)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      p: [month, year, seller, record.fecha || null, record.empresa || '', record.tipoCurso || '', record.nombreCurso || '', Number(record.importe || 0), userId, userId],
    },
  }

  return map[`${area}:${criterion}`] || null
}

function emptySnapshot() {
  return {
    superior: { leads: [], alianzas: [], contactabilidad: [], cumplimiento: [], metas: [], resumen: [] },
    ejecutivo: { leads: [], llamadas: [], datosActualizados: [], clientesNuevos: [], facturacion: [], programCatalog: [] },
    incompany: { propuestas: [], citas: [], facturacion: [] },
  }
}

function buildGoalsSnapshot(goalRows, sellersByArea) {
  const monthlyZeros = {
    enero: 0,
    febrero: 0,
    marzo: 0,
    abril: 0,
    mayo: 0,
    junio: 0,
    julio: 0,
    agosto: 0,
    septiembre: 0,
    octubre: 0,
    noviembre: 0,
    diciembre: 0,
  }
  const goals = {
    superior: { bySeller: {} },
    ejecutivo: { bySeller: {}, salesMonthlyBySeller: {} },
    incompany: { citasMonthly: 0, salesAnnualBySeller: {}, salesMonthlyBySeller: {} },
  }

  for (const seller of sellersByArea.superior || []) {
    goals.superior.bySeller[seller] = { ventasMonthly: 0, contactabilidadMonthly: 0, alianzasMonthly: 0, citasMonthly: 0 }
  }
  for (const seller of sellersByArea.ejecutivo || []) {
    goals.ejecutivo.bySeller[seller] = { llamadasMonthly: 0, datosActualizadosMonthly: 0, clientesNuevosMonthly: 0 }
    goals.ejecutivo.salesMonthlyBySeller[seller] = { ...monthlyZeros }
  }
  for (const seller of sellersByArea.incompany || []) {
    goals.incompany.salesAnnualBySeller[seller] = 0
    goals.incompany.salesMonthlyBySeller[seller] = { ...monthlyZeros }
  }

  const numToMonth = Object.entries(MONTH_TO_NUM).reduce((acc, [k, v]) => {
    acc[v] = k
    return acc
  }, {})

  for (const row of goalRows) {
    const area = row.area
    const seller = row.seller_name
    const criterion = row.criterion
    const value = Number(row.value || 0)
    const monthName = row.month ? numToMonth[row.month] : null

    if (area === 'superior' && seller && goals.superior.bySeller[seller] && criterion in goals.superior.bySeller[seller]) {
      goals.superior.bySeller[seller][criterion] = value
    }
    if (area === 'ejecutivo' && seller && goals.ejecutivo.bySeller[seller] && criterion in goals.ejecutivo.bySeller[seller]) {
      goals.ejecutivo.bySeller[seller][criterion] = value
    }
    if (area === 'ejecutivo' && criterion === 'salesMonthly' && seller && monthName && goals.ejecutivo.salesMonthlyBySeller[seller]) {
      goals.ejecutivo.salesMonthlyBySeller[seller][monthName] = value
    }
    if (area === 'incompany' && criterion === 'citasMonthly') {
      goals.incompany.citasMonthly = value
    }
    if (area === 'incompany' && criterion === 'salesAnnual' && seller && seller in goals.incompany.salesAnnualBySeller) {
      goals.incompany.salesAnnualBySeller[seller] = value
    }
    if (area === 'incompany' && criterion === 'salesMonthly' && seller && monthName && goals.incompany.salesMonthlyBySeller[seller]) {
      goals.incompany.salesMonthlyBySeller[seller][monthName] = value
    }
  }
  return goals
}

dataRouter.get('/bootstrap', async (req, res, next) => {
  try {
    const sellersResult = await readWithFailover(
      `select area, name from public.sellers where is_active = true order by area, name`,
      [],
    )
    const recordsResult = await readWithFailover(
      `select id, area, criterion, payload, created_at, updated_at from public.app_records order by created_at asc`,
      [],
    )
    const programsResult = await readWithFailover(
      `select id, name, cycle, goal_q from public.executive_programs where is_active = true order by created_at asc`,
      [],
    )
    const goalsResult = await readWithFailover(
      `select area, seller_name, criterion, month, value from public.area_goals`,
      [],
    )

    const sellersByArea = { superior: [], ejecutivo: [], incompany: [] }
    for (const row of sellersResult.rows) {
      if (sellersByArea[row.area]) sellersByArea[row.area].push(row.name)
    }

    const snapshot = emptySnapshot()
    snapshot.ejecutivo.programCatalog = programsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      cycle: row.cycle,
      goalQ: Number(row.goal_q || 0),
    }))
    for (const row of recordsResult.rows) {
      if (!snapshot[row.area] || !Array.isArray(snapshot[row.area][row.criterion])) continue
      snapshot[row.area][row.criterion].push({
        id: row.id,
        ...(row.payload || {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    }

    snapshot.goals = buildGoalsSnapshot(goalsResult.rows, sellersByArea)
    res.json({ sellersByArea, dataset: snapshot })
  } catch (err) {
    next(err)
  }
})

dataRouter.post('/record', async (req, res, next) => {
  try {
    const parsed = saveSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const { area, criterion, record } = parsed.data
    const businessInsert = buildBusinessInsert(area, criterion, record, req.auth.user.id)
    if (businessInsert) {
      await writePrimaryThenBackup(businessInsert.q, businessInsert.p)
    }
    const payload = { ...record }
    delete payload.id
    const q = `
      insert into public.app_records(area, criterion, payload, created_by)
      values ($1, $2, $3::jsonb, $4)
      returning id, created_at, updated_at
    `
    const r = await writePrimaryThenBackup(q, [area, criterion, JSON.stringify(payload), req.auth.user.id])
    res.json({ ok: true, write: r })
  } catch (err) {
    next(err)
  }
})

dataRouter.patch('/record/:id', async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const { id } = req.params
    const { area, criterion, record } = parsed.data
    const payload = { ...record }
    delete payload.id

    await writePrimaryThenBackup(
      `update public.app_records
       set payload = $2::jsonb, updated_at = now()
       where id = $1 and area = $3 and criterion = $4`,
      [id, JSON.stringify(payload), area, criterion],
    )

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

dataRouter.delete('/record/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await writePrimaryThenBackup(`delete from public.app_records where id = $1`, [id])
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

dataRouter.post('/program', async (req, res, next) => {
  try {
    const parsed = programSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const { name, cycle, goalQ } = parsed.data
    const q = `
      insert into public.executive_programs(name, cycle, goal_q, is_active)
      values ($1, $2, $3, true)
      returning id, name, cycle, goal_q
    `
    const result = await readWithFailover(q, [name, cycle, Number(goalQ || 0)])
    const row = result.rows?.[0]
    res.json({
      ok: true,
      program: row
        ? { id: row.id, name: row.name, cycle: row.cycle, goalQ: Number(row.goal_q || 0) }
        : null,
    })
  } catch (err) {
    next(err)
  }
})

dataRouter.patch('/program/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const parsed = programSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const { name, cycle, goalQ } = parsed.data
    await writePrimaryThenBackup(
      `update public.executive_programs
       set name = $2, cycle = $3, goal_q = $4, updated_at = now()
       where id = $1`,
      [id, name, cycle, Number(goalQ || 0)],
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

dataRouter.delete('/program/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await writePrimaryThenBackup(
      `update public.executive_programs set is_active = false, updated_at = now() where id = $1`,
      [id],
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

dataRouter.post('/goal', async (req, res, next) => {
  try {
    const parsed = goalSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const { area, criterion, seller = null, month = null, value, periodType = 'mensual', year } = parsed.data
    const vYear = Number(year || new Date().getFullYear())

    await writePrimaryThenBackup(
      `delete from public.area_goals
       where area = $1
         and criterion = $2
         and coalesce(seller_name, '') = coalesce($3, '')
         and coalesce(month, 0) = coalesce($4, 0)
         and year = $5`,
      [area, criterion, seller, month, vYear],
    )

    await writePrimaryThenBackup(
      `insert into public.area_goals(area, seller_name, criterion, month, year, value, period_type, created_by, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [area, seller, criterion, month, vYear, Number(value || 0), periodType, req.auth.user.id],
    )

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
