import { Router } from 'express'
import { z } from 'zod'
import { supabaseAdminClient } from '../lib/supabase.js'

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

function throwIfError(error) {
  if (error) throw error
}

function mapProgramHistoryEntry(row) {
  return {
    id: row.id,
    action: row.action || 'UPDATED',
    by: row.changed_by || 'system',
    at: row.changed_at,
    before: row.before_data || null,
    after: row.after_data || null,
  }
}

async function logProgramChange({ rowId, action, changedBy, beforeData = null, afterData = null }) {
  const { error } = await supabaseAdminClient.from('change_log').insert({
    table_name: 'executive_programs',
    row_id: rowId,
    action,
    changed_by: changedBy || null,
    before_data: beforeData,
    after_data: afterData,
  })
  throwIfError(error)
}

function isMaster(profile) {
  return profile?.role === 'master'
}

function assertAdvisorArea(profile, area) {
  if (isMaster(profile)) return
  if (!profile?.area || profile.area !== area) {
    const err = new Error('forbidden_area')
    err.statusCode = 403
    throw err
  }
}

function assertAdvisorSeller(profile, seller) {
  if (isMaster(profile)) return
  if (!profile?.seller_name || seller !== profile.seller_name) {
    const err = new Error('forbidden_seller')
    err.statusCode = 403
    throw err
  }
}

function monthNum(monthText) {
  const key = String(monthText || '').toLowerCase()
  return MONTH_TO_NUM[key] || 1
}

function buildBusinessMutation(area, criterion, record, userId) {
  const month = monthNum(record.month)
  const year = Number(record.year || new Date().getFullYear())
  const seller = record.seller || ''

  const base = { month, year, seller_name: seller, created_by: userId, updated_by: userId }

  const map = {
    'superior:leads': { table: 'superior_leads', row: { ...base, nombre: record.nombre || '', carrera: record.carrera || '', estado: record.estado || '', venta_q: Number(record.ventaQ || 0) } },
    'superior:alianzas': { table: 'superior_alianzas', row: { ...base, empresa: record.empresa || '', estatus: record.estatus || '', fecha_escritorio: record.fechaEscritorio || null } },
    'superior:contactabilidad': { table: 'superior_contactabilidad', row: { ...base, contactados: Number(record.contactados || 0) } },
    'superior:resumen': {
      table: 'superior_resumen',
      row: {
        ...base,
        propuestas: Number(record.propuestas || 0),
        alianzas_trabajadas: Number(record.alianzasTrabajadas || 0),
        citas: Number(record.citas || 0),
        contactabilidad: Number(record.contactabilidad || 0),
        venta_q: Number(record.venta || 0),
      },
    },
    'superior:metas': {
      table: 'superior_metas_programa',
      row: {
        ...base,
        bado: Number(record.bado || 0),
        bmi: Number(record.bmi || 0),
        bas: Number(record.bas || 0),
        mlt: Number(record.mlt || 0),
        mgp: Number(record.mgp || 0),
        mia: Number(record.mia || 0),
        mba: Number(record.mba || 0),
        total: Number(record.total || 0),
        is_cumplimiento: false,
      },
      upsert: true,
      onConflict: 'year,month,seller_name,is_cumplimiento',
    },
    'superior:cumplimiento': {
      table: 'superior_metas_programa',
      row: {
        ...base,
        bado: Number(record.bado || 0),
        bmi: Number(record.bmi || 0),
        bas: Number(record.bas || 0),
        mlt: Number(record.mlt || 0),
        mgp: Number(record.mgp || 0),
        mia: Number(record.mia || 0),
        mba: Number(record.mba || 0),
        total: Number(record.total || 0),
        is_cumplimiento: true,
      },
      upsert: true,
      onConflict: 'year,month,seller_name,is_cumplimiento',
    },
    'ejecutivo:leads': {
      table: 'ejecutivo_leads',
      row: {
        id: record.id,
        ...base,
        empresa: record.empresa || '',
        cliente: record.cliente || '',
        telefono: record.telefono || '',
        correo: record.correo || '',
        program_id: record.programId || null,
        program_name: record.programName || '',
        estatus: record.estatus || '',
        cotizacion_q: Number(record.cotizacionQ || 0),
        venta_q: Number(record.ventaQ || 0),
      },
    },
    'ejecutivo:llamadas': { table: 'ejecutivo_llamadas', row: { ...base, total_llamadas: Number(record.totalLlamadas || 0) } },
    'ejecutivo:datosActualizados': { table: 'ejecutivo_datos_actualizados', row: { ...base, empresa: record.empresa || '', nombre: record.nombre || '', cargo: record.cargo || '', telefono: record.telefono || '', correo: record.correo || '' } },
    'ejecutivo:clientesNuevos': { table: 'ejecutivo_clientes_nuevos', row: { ...base, empresa: record.empresa || '', nombre: record.nombre || '', cargo: record.cargo || '', telefono: record.telefono || '', correo: record.correo || '' } },
    'ejecutivo:facturacion': { table: 'ejecutivo_facturacion', row: { ...base, fecha: record.fecha || null, empresa: record.empresa || '', tipo_curso: record.tipoCurso || '', nombre_curso: record.nombreCurso || '', importe: Number(record.importe || 0) } },
    'incompany:propuestas': { table: 'incompany_propuestas', row: { ...base, fecha: record.fecha || null, empresa: record.empresa || '', tipologia_curso: record.tipologiaCurso || '', nombre_curso: record.nombreCurso || '', inversion: Number(record.inversion || 0), estatus: record.estatus || '', total_final_q: Number(record.totalFinalQ || 0) } },
    'incompany:citas': { table: 'incompany_citas', row: { ...base, fecha: record.fecha || null, empresa: record.empresa || '', contacto: record.contacto || '', motivo: record.motivo || '' } },
    'incompany:facturacion': { table: 'incompany_facturacion', row: { ...base, fecha: record.fecha || null, empresa: record.empresa || '', tipo_curso: record.tipoCurso || '', nombre_curso: record.nombreCurso || '', importe: Number(record.importe || 0) } },
  }

  return map[`${area}:${criterion}`] || null
}

function buildBusinessUpdate(area, criterion, record, userId) {
  if (area === 'ejecutivo' && criterion === 'leads' && record?.id) {
    return {
      table: 'ejecutivo_leads',
      id: record.id,
      fullRow: {
        id: record.id,
        month: monthNum(record.month),
        year: Number(record.year || new Date().getFullYear()),
        seller_name: record.seller || '',
        empresa: record.empresa || '',
        cliente: record.cliente || '',
        telefono: record.telefono || '',
        correo: record.correo || '',
        program_id: record.programId || null,
        program_name: record.programName || '',
        estatus: record.estatus || '',
        cotizacion_q: Number(record.cotizacionQ || 0),
        venta_q: Number(record.ventaQ || 0),
        updated_by: userId,
      },
      row: {
        empresa: record.empresa || '',
        cliente: record.cliente || '',
        telefono: record.telefono || '',
        correo: record.correo || '',
        program_id: record.programId || null,
        program_name: record.programName || '',
        estatus: record.estatus || '',
        cotizacion_q: Number(record.cotizacionQ || 0),
        venta_q: Number(record.ventaQ || 0),
        updated_by: userId,
      },
    }
  }
  return null
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
    enero: 0, febrero: 0, marzo: 0, abril: 0, mayo: 0, junio: 0,
    julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0,
  }
  const goals = {
    superior: { bySeller: {} },
    ejecutivo: { bySeller: {}, salesMonthlyBySeller: {} },
    incompany: { citasMonthly: 0, salesAnnualBySeller: {}, salesMonthlyBySeller: {} },
  }

  for (const seller of sellersByArea.superior || []) goals.superior.bySeller[seller] = { ventasMonthly: 0, contactabilidadMonthly: 0, alianzasMonthly: 0, citasMonthly: 0 }
  for (const seller of sellersByArea.ejecutivo || []) {
    goals.ejecutivo.bySeller[seller] = { llamadasMonthly: 0, datosActualizadosMonthly: 0, clientesNuevosMonthly: 0 }
    goals.ejecutivo.salesMonthlyBySeller[seller] = { ...monthlyZeros }
  }
  for (const seller of sellersByArea.incompany || []) {
    goals.incompany.salesAnnualBySeller[seller] = 0
    goals.incompany.salesMonthlyBySeller[seller] = { ...monthlyZeros }
  }

  const numToMonth = Object.entries(MONTH_TO_NUM).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {})
  for (const row of goalRows) {
    const area = row.area
    const seller = row.seller_name
    const criterion = row.criterion
    const value = Number(row.value || 0)
    const monthName = row.month ? numToMonth[row.month] : null

    if (area === 'superior' && seller && goals.superior.bySeller[seller] && criterion in goals.superior.bySeller[seller]) goals.superior.bySeller[seller][criterion] = value
    if (area === 'ejecutivo' && seller && goals.ejecutivo.bySeller[seller] && criterion in goals.ejecutivo.bySeller[seller]) goals.ejecutivo.bySeller[seller][criterion] = value
    if (area === 'ejecutivo' && criterion === 'salesMonthly' && seller && monthName && goals.ejecutivo.salesMonthlyBySeller[seller]) goals.ejecutivo.salesMonthlyBySeller[seller][monthName] = value
    if (area === 'incompany' && criterion === 'citasMonthly') goals.incompany.citasMonthly = value
    if (area === 'incompany' && criterion === 'salesAnnual' && seller && seller in goals.incompany.salesAnnualBySeller) goals.incompany.salesAnnualBySeller[seller] = value
    if (area === 'incompany' && criterion === 'salesMonthly' && seller && monthName && goals.incompany.salesMonthlyBySeller[seller]) goals.incompany.salesMonthlyBySeller[seller][monthName] = value
  }
  return goals
}

dataRouter.get('/bootstrap', async (req, res, next) => {
  try {
    const profile = req.auth.profile
    const advisorMode = !isMaster(profile)

    let sellersQuery = supabaseAdminClient.from('sellers').select('area, name').eq('is_active', true).order('area').order('name')
    let recordsQuery = supabaseAdminClient.from('app_records').select('id, area, criterion, payload, created_at, updated_at').order('created_at', { ascending: true })
    let goalsQuery = supabaseAdminClient.from('area_goals').select('area, seller_name, criterion, month, value')

    if (advisorMode) {
      sellersQuery = sellersQuery.eq('area', profile.area).eq('name', profile.seller_name)
      recordsQuery = recordsQuery.eq('area', profile.area)
      goalsQuery = goalsQuery.eq('area', profile.area).or(`seller_name.eq.${profile.seller_name},seller_name.is.null`)
    }

    const [sellersR, recordsR, programsR, goalsR] = await Promise.all([
      sellersQuery,
      recordsQuery,
      supabaseAdminClient.from('executive_programs').select('id, name, cycle, goal_q').eq('is_active', true).order('created_at', { ascending: true }),
      goalsQuery,
    ])
    throwIfError(sellersR.error); throwIfError(recordsR.error); throwIfError(programsR.error); throwIfError(goalsR.error)

    const sellersByArea = { superior: [], ejecutivo: [], incompany: [] }
    for (const row of sellersR.data || []) if (sellersByArea[row.area]) sellersByArea[row.area].push(row.name)

    const snapshot = emptySnapshot()
    const programRows = programsR.data || []
    const programIds = programRows.map((row) => row.id)
    let programHistoryById = new Map()
    if (programIds.length > 0) {
      const { data: historyRows, error: historyError } = await supabaseAdminClient
        .from('change_log')
        .select('id, row_id, action, changed_by, changed_at, before_data, after_data')
        .eq('table_name', 'executive_programs')
        .in('row_id', programIds)
        .order('changed_at', { ascending: true })
      throwIfError(historyError)
      for (const row of historyRows || []) {
        const current = programHistoryById.get(row.row_id) || []
        current.push(mapProgramHistoryEntry(row))
        programHistoryById.set(row.row_id, current)
      }
    }
    snapshot.ejecutivo.programCatalog = programRows.map((row) => ({
      id: row.id,
      name: row.name,
      cycle: row.cycle,
      goalQ: Number(row.goal_q || 0),
      changeHistory: programHistoryById.get(row.id) || [],
    }))
    for (const row of recordsR.data || []) {
      if (advisorMode && row?.payload?.seller !== profile.seller_name) continue
      if (!snapshot[row.area] || !Array.isArray(snapshot[row.area][row.criterion])) continue
      snapshot[row.area][row.criterion].push({ id: row.id, ...(row.payload || {}), createdAt: row.created_at, updatedAt: row.updated_at })
    }
    snapshot.goals = buildGoalsSnapshot(goalsR.data || [], sellersByArea)
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
    assertAdvisorArea(req.auth.profile, area)
    assertAdvisorSeller(req.auth.profile, record.seller)

    const businessMutation = buildBusinessMutation(area, criterion, record, req.auth.user.id)
    if (businessMutation) {
      const builder = supabaseAdminClient.from(businessMutation.table)
      const response = businessMutation.upsert
        ? await builder.upsert(businessMutation.row, { onConflict: businessMutation.onConflict })
        : await builder.insert(businessMutation.row)
      throwIfError(response.error)
    }

    const payload = { ...record }
    delete payload.id
    const { error } = await supabaseAdminClient.from('app_records').insert({
      area,
      criterion,
      payload,
      created_by: req.auth.user.id,
    })
    throwIfError(error)
    res.json({ ok: true, write: { source: 'supabase_only' } })
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
    assertAdvisorArea(req.auth.profile, area)
    assertAdvisorSeller(req.auth.profile, record.seller)
    const payload = { ...record }
    delete payload.id

    const businessUpdate = buildBusinessUpdate(area, criterion, record, req.auth.user.id)
    if (businessUpdate) {
      const { data: updatedBusiness, error: businessError } = await supabaseAdminClient
        .from(businessUpdate.table)
        .update(businessUpdate.row)
        .eq('id', businessUpdate.id)
        .select('id')
      throwIfError(businessError)
      if (!updatedBusiness || updatedBusiness.length === 0) {
        const { error: insertBusinessError } = await supabaseAdminClient
          .from(businessUpdate.table)
          .insert(businessUpdate.fullRow)
        throwIfError(insertBusinessError)
      }
    }

    const { error } = await supabaseAdminClient
      .from('app_records')
      .update({ payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('area', area)
      .eq('criterion', criterion)
    throwIfError(error)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

dataRouter.delete('/record/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isMaster(req.auth.profile)) return res.status(403).json({ error: 'forbidden' })
    const { error } = await supabaseAdminClient.from('app_records').delete().eq('id', id)
    throwIfError(error)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

dataRouter.post('/program', async (req, res, next) => {
  try {
    if (!isMaster(req.auth.profile)) return res.status(403).json({ error: 'forbidden' })
    const parsed = programSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const { name, cycle, goalQ } = parsed.data
    const { data, error } = await supabaseAdminClient
      .from('executive_programs')
      .insert({ name, cycle, goal_q: Number(goalQ || 0), is_active: true })
      .select('id, name, cycle, goal_q')
      .single()
    throwIfError(error)
    if (data) {
      await logProgramChange({
        rowId: data.id,
        action: 'CREATED',
        changedBy: req.auth.user.id,
        afterData: { id: data.id, name: data.name, cycle: data.cycle, goalQ: Number(data.goal_q || 0) },
      })
    }
    res.json({ ok: true, program: data ? { id: data.id, name: data.name, cycle: data.cycle, goalQ: Number(data.goal_q || 0), changeHistory: [] } : null })
  } catch (err) {
    next(err)
  }
})

dataRouter.patch('/program/:id', async (req, res, next) => {
  try {
    if (!isMaster(req.auth.profile)) return res.status(403).json({ error: 'forbidden' })
    const { id } = req.params
    const parsed = programSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const { name, cycle, goalQ } = parsed.data
    const { data: currentProgram, error: currentProgramError } = await supabaseAdminClient
      .from('executive_programs')
      .select('id, name, cycle, goal_q')
      .eq('id', id)
      .maybeSingle()
    throwIfError(currentProgramError)
    if (!currentProgram) return res.status(404).json({ error: 'program_not_found' })
    const { error } = await supabaseAdminClient
      .from('executive_programs')
      .update({ name, cycle, goal_q: Number(goalQ || 0), updated_at: new Date().toISOString() })
      .eq('id', id)
    throwIfError(error)
    await logProgramChange({
      rowId: id,
      action: 'UPDATED',
      changedBy: req.auth.user.id,
      beforeData: { id: currentProgram.id, name: currentProgram.name, cycle: currentProgram.cycle, goalQ: Number(currentProgram.goal_q || 0) },
      afterData: { id, name, cycle, goalQ: Number(goalQ || 0) },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

dataRouter.delete('/program/:id', async (req, res, next) => {
  try {
    if (!isMaster(req.auth.profile)) return res.status(403).json({ error: 'forbidden' })
    const { id } = req.params
    const { data: currentProgram, error: currentProgramError } = await supabaseAdminClient
      .from('executive_programs')
      .select('id, name, cycle, goal_q, is_active')
      .eq('id', id)
      .maybeSingle()
    throwIfError(currentProgramError)
    if (!currentProgram) return res.status(404).json({ error: 'program_not_found' })
    const { error } = await supabaseAdminClient
      .from('executive_programs')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    throwIfError(error)
    await logProgramChange({
      rowId: id,
      action: 'DEACTIVATED',
      changedBy: req.auth.user.id,
      beforeData: {
        id: currentProgram.id,
        name: currentProgram.name,
        cycle: currentProgram.cycle,
        goalQ: Number(currentProgram.goal_q || 0),
        isActive: Boolean(currentProgram.is_active),
      },
      afterData: {
        id: currentProgram.id,
        name: currentProgram.name,
        cycle: currentProgram.cycle,
        goalQ: Number(currentProgram.goal_q || 0),
        isActive: false,
      },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

dataRouter.post('/goal', async (req, res, next) => {
  try {
    if (!isMaster(req.auth.profile)) return res.status(403).json({ error: 'forbidden' })
    const parsed = goalSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' })
    const { area, criterion, seller = null, month = null, value, periodType = 'mensual', year } = parsed.data
    const vYear = Number(year || new Date().getFullYear())

    let deleteQuery = supabaseAdminClient
      .from('area_goals')
      .delete()
      .eq('area', area)
      .eq('criterion', criterion)
      .eq('year', vYear)

    deleteQuery = seller === null ? deleteQuery.is('seller_name', null) : deleteQuery.eq('seller_name', seller)
    deleteQuery = month === null ? deleteQuery.is('month', null) : deleteQuery.eq('month', month)

    const { error: deleteError } = await deleteQuery
    throwIfError(deleteError)

    const { error: insertError } = await supabaseAdminClient.from('area_goals').insert({
      area,
      seller_name: seller,
      criterion,
      month,
      year: vYear,
      value: Number(value || 0),
      period_type: periodType,
      created_by: req.auth.user.id,
      updated_by: req.auth.user.id,
    })
    throwIfError(insertError)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
