import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const AUTH_KEY = 'ventas_app_auth_v2'
function resolveApiBaseUrl(rawValue) {
  const input = String(rawValue || '').trim()
  if (!input) return ''
  if (input.startsWith('/')) return input.replace(/\/$/, '')
  if (/^https?:\/\//i.test(input)) return input.replace(/\/$/, '')
  return `https://${input}`.replace(/\/$/, '')
}

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
const MONTHS = [
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
]
const PERIOD_OPTIONS = [
  { value: 'mensual', label: 'Mensual', months: 1 },
  { value: 'bimestral', label: 'Bimestral', months: 2 },
  { value: 'trimestral', label: 'Trimestral', months: 3 },
  { value: 'semestral', label: 'Semestral', months: 6 },
  { value: 'anual', label: 'Anual', months: 12 },
]
const PERIOD_META_LABELS = {
  mensual: 'mensual',
  bimestral: 'bimestral',
  trimestral: 'trimestral',
  semestral: 'semestral',
  anual: 'anual',
}
const COLORS = ['#0b7d44', '#f4b400', '#1e88e5', '#ef6c00', '#5e35b1', '#00897b']
const CHART_COLORS = {
  primary: '#0b7d44',
  secondary: '#1e88e5',
  accent: '#f4b400',
  danger: '#d93025',
}

const AREA_CONFIG = {
  superior: {
    label: 'Educacion Superior',
    sellers: [],
    criteria: ['leads', 'alianzas', 'contactabilidad', 'cumplimiento', 'metas', 'resumen'],
  },
  ejecutivo: {
    label: 'Ejecutivo',
    sellers: [],
    criteria: ['leads', 'llamadas', 'datosActualizados', 'clientesNuevos', 'facturacion'],
  },
  incompany: {
    label: 'InCompany',
    sellers: [],
    criteria: ['propuestas', 'citas', 'facturacion'],
  },
}

function buildPerSellerGoals(defaults, sellers) {
  return sellers.reduce((acc, seller) => {
    acc[seller] = { ...defaults }
    return acc
  }, {})
}

const CRITERIA_LABELS = {
  leads: 'Leads',
  alianzas: 'Alianzas',
  contactabilidad: 'Contactabilidad',
  cumplimiento: 'Cumplimiento',
  metas: 'Metas mensuales',
  resumen: 'Resumen por criterio',
  llamadas: 'Llamadas',
  datosActualizados: 'Datos actualizados',
  clientesNuevos: 'Clientes nuevos',
  propuestas: 'Propuestas',
  citas: 'Citas',
  facturacion: 'Facturacion',
}


const EXEC_STATUS = [
  'No participara',
  'Presentacion',
  'Seguimiento con cita',
  'Seguimiento sin cita',
  'Venta',
]
const SUPERIOR_LEAD_STATUS = ['No participara', 'Presentacion', 'Seguimiento', 'Venta', 'Cancelada']
const SUPERIOR_ALIANZA_STATUS = ['Cita', 'En proceso', 'Renovada', 'Escritorio informativo']
const INC_PROPOSAL_STATUS = [
  'Solicitud de propuesta',
  'Envio de propuesta',
  'Negociacion',
  'Pre-cierre',
  'Cierre',
  'Declinado',
]
const INC_MOTIVOS = [
  'Presentacion de portafolio',
  'Presentacion de propuesta',
  'Alineacion de contenido',
  'Alineacion de ejecucion',
  'Seguimiento',
  'Apertura de curso',
  'Cierre de curso',
  'Strategic Lunch',
]
const PROGRAM_KEYS = ['bado', 'bmi', 'bas', 'mlt', 'mgp', 'mia', 'mba']

function sanitizeText(value, maxLength = 100) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength)
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const cleaned = String(value || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0)
}

function getPeriodMonths(referenceMonth, periodType) {
  const monthIndex = MONTHS.indexOf(referenceMonth)
  const periodSize = PERIOD_OPTIONS.find((item) => item.value === periodType)?.months || 1
  if (monthIndex < 0) {
    return []
  }
  const startIndex = Math.max(0, monthIndex - periodSize + 1)
  return MONTHS.slice(startIndex, monthIndex + 1)
}

function getPeriodMetaLabel(periodType) {
  return PERIOD_META_LABELS[periodType] || 'mensual'
}


function getRestrictedAdvisorCriteria(area) {
  if (area === 'ejecutivo') {
    return new Set(['llamadas', 'facturacion'])
  }
  if (area === 'incompany') {
    return new Set(['facturacion'])
  }
  return new Set()
}

function buildMonthlyGoalsFromAnnual(annualTarget, weights) {
  const totalWeight = weights.reduce((acc, value) => acc + value, 0)
  const goals = {}
  MONTHS.forEach((month, index) => {
    goals[month] = round2((annualTarget * weights[index]) / totalWeight)
  })
  return goals
}

function buildAnnualDemoData(includeDemo = false) {
  const programs = []

  const data = {
    superior: {
      leads: [],
      alianzas: [],
      contactabilidad: [],
      cumplimiento: [],
      metas: [],
      resumen: [],
    },
  ejecutivo: {
    programCatalog: programs,
    leads: [],
    llamadas: [],
    datosActualizados: [],
    clientesNuevos: [],
    facturacion: [],
  },
    incompany: {
      propuestas: [],
      citas: [],
      facturacion: [],
    },
    goals: {
      superior: {
        bySeller: buildPerSellerGoals(
          { ventasMonthly: 0, contactabilidadMonthly: 0, alianzasMonthly: 0, citasMonthly: 0 },
          AREA_CONFIG.superior.sellers,
        ),
      },
      ejecutivo: {
        bySeller: buildPerSellerGoals(
          { llamadasMonthly: 0, datosActualizadosMonthly: 0, clientesNuevosMonthly: 0 },
          AREA_CONFIG.ejecutivo.sellers,
        ),
        salesMonthlyBySeller: {},
      },
      incompany: {
        citasMonthly: 0,
        salesAnnualBySeller: {
          Miguel: 0,
          Carla: 0,
        },
        salesMonthlyBySeller: {},
      },
    },
  }

  const monthlyWeights = [0.07, 0.075, 0.085, 0.08, 0.07, 0.075, 0.09, 0.085, 0.08, 0.095, 0.095, 0.1]
  AREA_CONFIG.incompany.sellers.forEach((seller) => {
    const annual = data.goals.incompany.salesAnnualBySeller[seller] || 0
    data.goals.incompany.salesMonthlyBySeller[seller] = buildMonthlyGoalsFromAnnual(annual, monthlyWeights)
  })
  AREA_CONFIG.ejecutivo.sellers.forEach((seller) => {
    data.goals.ejecutivo.salesMonthlyBySeller[seller] = buildMonthlyGoalsFromAnnual(0, monthlyWeights)
  })
  if (!includeDemo) {
    return data
  }

  const monthFactor = [1.06, 0.98, 1.1, 0.9, 0.62, 0.88, 1.12, 0.96, 0.57, 0.86, 1.08, 1]
  const executiveSellerFactor = { Maria: 1.02, Jose: 0.34 }
  const poorPerformer = 'Jose'

  MONTHS.forEach((month, monthIdx) => {
    AREA_CONFIG.superior.sellers.forEach((seller, sellerIdx) => {
      const seed = (monthIdx + 1) * 17 + (sellerIdx + 1) * 9
      const factor = monthFactor[monthIdx] * (seller === 'Virginia' ? 0.92 : 1.06)
      data.superior.resumen.push({
        id: crypto.randomUUID(),
        month,
        seller,
        propuestas: Math.max(10, Math.round((28 + (seed % 16)) * factor)),
        alianzasTrabajadas: Math.max(2, Math.round((4 + (seed % 7)) * factor)),
        citas: Math.max(3, Math.round((7 + (seed % 6)) * factor)),
        contactabilidad: Math.max(80, Math.round((180 + (seed % 100)) * factor)),
        venta: round2((26000 + (seed % 12000)) * factor),
      })
      data.superior.contactabilidad.push({
        id: crypto.randomUUID(),
        month,
        seller,
        contactados: Math.max(80, Math.round((180 + (seed % 100)) * factor)),
      })
      data.superior.alianzas.push({
        id: crypto.randomUUID(),
        month,
        seller,
        empresa: ['Banrural', 'Cempro', 'Ficohsa', 'Totto'][seed % 4],
        estatus: ['cita', 'en proceso', 'renovada', 'escritorio informativo'][seed % 4],
        fechaEscritorio: `2026-${String(monthIdx + 1).padStart(2, '0')}-${String(10 + (seed % 18)).padStart(2, '0')}`,
      })
      data.superior.leads.push({
        id: crypto.randomUUID(),
        month,
        seller,
        nombre: ['Byron', 'Lucia', 'Genesis', 'Kevin'][seed % 4],
        carrera: ['BADO', 'BMI', 'MIA', 'MBA'][seed % 4],
        estado: ['Presentacion', 'Seguimiento', 'Venta', 'No participara'][seed % 4],
        ventaQ: seed % 4 === 2 ? round2((6500 + (seed % 3000)) * factor) : 0,
      })

      const metas = {
        bado: round2((24000 + (seed % 12000)) * 1.02),
        bmi: round2((22000 + (seed % 10000)) * 1.02),
        bas: round2((21000 + (seed % 9000)) * 1.02),
        mlt: round2((18000 + (seed % 10000)) * 1.02),
        mgp: round2((16000 + (seed % 8000)) * 1.02),
        mia: round2((20000 + (seed % 9000)) * 1.02),
        mba: round2((19000 + (seed % 9000)) * 1.02),
      }
      const metaTotal = PROGRAM_KEYS.reduce((acc, key) => acc + metas[key], 0)
      const cumplimientoRatio = Math.min(0.97, Math.max(0.55, 0.82 * factor))
      const cumplimiento = PROGRAM_KEYS.reduce((acc, key) => {
        acc[key] = round2(metas[key] * cumplimientoRatio)
        return acc
      }, {})
      const cumplimientoTotal = PROGRAM_KEYS.reduce((acc, key) => acc + cumplimiento[key], 0)

      data.superior.metas.push({
        id: crypto.randomUUID(),
        month,
        seller,
        ...metas,
        total: round2(metaTotal),
      })
      data.superior.cumplimiento.push({
        id: crypto.randomUUID(),
        month,
        seller,
        ...cumplimiento,
        total: round2(cumplimientoTotal),
      })
    })

    AREA_CONFIG.ejecutivo.sellers.forEach((seller, sellerIdx) => {
      const seed = (monthIdx + 1) * 19 + (sellerIdx + 1) * 7
      const factor = monthFactor[monthIdx] * (executiveSellerFactor[seller] || 1)
      const calls = Math.max(140, Math.round(1600 * factor + ((seed % 120) - 60)))
      data.ejecutivo.llamadas.push({
        id: crypto.randomUUID(),
        month,
        seller,
        totalLlamadas: calls,
      })

      const datosCount = Math.max(6, Math.round(160 * factor))
      const clientesCount = Math.max(4, Math.round(160 * factor * (seller === poorPerformer ? 0.55 : 0.84)))

      for (let i = 0; i < datosCount; i += 1) {
        data.ejecutivo.datosActualizados.push({
          id: crypto.randomUUID(),
          month,
          seller,
          empresa: ['Cempro', 'Telus', 'Avantel', 'Aquacorp'][(seed + i) % 4],
          nombre: ['Jose Rivera', 'Marta Linares', 'Ana Castillo', 'Luis Ramos'][(seed + i) % 4],
          cargo: ['Gerente', 'RRHH', 'Director', 'Coordinador'][(seed + i) % 4],
          telefono: `502-${String(51000000 + seed * 17 + i).slice(0, 8)}`,
          correo: `contacto${seed + i}@empresa.com`,
        })
      }

      for (let i = 0; i < clientesCount; i += 1) {
        data.ejecutivo.clientesNuevos.push({
          id: crypto.randomUUID(),
          month,
          seller,
          empresa: ['Ficohsa', 'Banrural', 'Unicomer', 'Emco'][(seed + i) % 4],
          nombre: ['Mario Mejia', 'Diana Gomez', 'Carlos Cruz', 'Evelyn Solis'][(seed + i) % 4],
          cargo: ['Gerente Comercial', 'Compras', 'Talento', 'Lider Proyecto'][(seed + i) % 4],
          telefono: `502-${String(52000000 + seed * 11 + i).slice(0, 8)}`,
          correo: `nuevo${seed + i}@cliente.com`,
        })
      }

      const leadCount = Math.max(5, Math.round(24 * factor))
      const poorStatusPool = ['No participara', 'Presentacion', 'Seguimiento sin cita', 'Seguimiento con cita', 'No participara']
      const normalStatusPool = ['Presentacion', 'Seguimiento con cita', 'Seguimiento sin cita', 'Venta', 'Venta']

      for (let i = 0; i < leadCount; i += 1) {
        const statusPool = seller === poorPerformer ? poorStatusPool : normalStatusPool
        const status = statusPool[(seed + i) % statusPool.length]
        const chosenProgram = programs[(seed + i) % programs.length]
        data.ejecutivo.leads.push({
          id: crypto.randomUUID(),
          month,
          seller,
          empresa: ['Totto', 'Banrural', 'Grupo TRT', 'Casa Medica'][(seed + i) % 4],
          cliente: ['Byron', 'Shirley', 'Kevin', 'Lucia'][(seed + i) % 4],
          programId: chosenProgram.id,
          programName: chosenProgram.name,
          estatus: status,
          ventaQ: status === 'Venta' ? round2((7000 + ((seed + i * 3) % 8000)) * factor) : 0,
        })
      }

      data.ejecutivo.facturacion.push({
        id: crypto.randomUUID(),
        month,
        seller,
        fecha: `2026-${String(monthIdx + 1).padStart(2, '0')}-${String(14 + (seed % 10)).padStart(2, '0')}`,
        empresa: ['Totto', 'Banrural', 'Grupo TRT', 'Casa Medica'][seed % 4],
        tipoCurso: ['Comercial', 'Liderazgo', 'Estrategia', 'Data'][seed % 4],
        nombreCurso: ['Diplomado Ventas B2B', 'MBA Ejecutivo', 'Liderazgo Gerencial', 'Analitica Comercial'][seed % 4],
        importe: round2((10500 + (seed % 9800)) * factor),
      })
    })

    AREA_CONFIG.incompany.sellers.forEach((seller, sellerIdx) => {
      const seed = (monthIdx + 1) * 23 + (sellerIdx + 1) * 11
      const factor = monthFactor[monthIdx] * (seller === 'Carla' ? 0.85 : 1.08)
      const propCount = Math.max(2, Math.round(4 * factor))
      for (let i = 0; i < propCount; i += 1) {
        const status = INC_PROPOSAL_STATUS[(seed + i) % INC_PROPOSAL_STATUS.length]
        const finalQ = status === 'Cierre' ? round2((24000 + ((seed + i) % 16000)) * factor) : 0
        data.incompany.propuestas.push({
          id: crypto.randomUUID(),
          month,
          seller,
          fecha: `2026-${String(monthIdx + 1).padStart(2, '0')}-${String(6 + i * 7).padStart(2, '0')}`,
          empresa: ['Telus', 'Bantrab', 'Unicomer', 'Bac'][(seed + i) % 4],
          tipologiaCurso: ['Tecnico', 'Liderazgo', 'Comercial', 'Data'][(seed + i) % 4],
          nombreCurso: ['Ventas consultivas', 'Liderazgo agile', 'Storytelling', 'Analitica aplicada'][(seed + i) % 4],
          inversion: round2((18000 + ((seed + i) % 15000)) * factor),
          estatus: status,
          totalFinalQ: finalQ,
        })
      }
      const citaCount = Math.max(1, Math.round(3 * factor))
      for (let i = 0; i < citaCount; i += 1) {
        data.incompany.citas.push({
          id: crypto.randomUUID(),
          month,
          seller,
          fecha: `2026-${String(monthIdx + 1).padStart(2, '0')}-${String(3 + i * 10).padStart(2, '0')}`,
          empresa: ['Telus', 'Bac', 'Tigo', 'Campero'][(seed + i) % 4],
          contacto: ['Mario Ruiz', 'Ana Pineda', 'Juan Leon', 'Paula Prado'][(seed + i) % 4],
          motivo: INC_MOTIVOS[(seed + i) % INC_MOTIVOS.length],
        })
      }
      data.incompany.facturacion.push({
        id: crypto.randomUUID(),
        month,
        seller,
        fecha: `2026-${String(monthIdx + 1).padStart(2, '0')}-${String(18 + (seed % 8)).padStart(2, '0')}`,
        empresa: ['Telus', 'Bantrab', 'Unicomer', 'Bac'][seed % 4],
        tipoCurso: ['Tecnico', 'Liderazgo', 'Comercial', 'Data'][seed % 4],
        nombreCurso: ['Ventas consultivas', 'Liderazgo agile', 'Storytelling', 'Analitica aplicada'][seed % 4],
        importe: round2((17000 + (seed % 14000)) * factor),
      })
    })
  })

  return data
}

const INITIAL_FORMS = {
  superior: {
    leads: { month: 'enero', seller: '', nombre: '', carrera: '', estado: SUPERIOR_LEAD_STATUS[0], ventaQ: '' },
    alianzas: { month: 'enero', seller: '', empresa: '', estatus: SUPERIOR_ALIANZA_STATUS[0], fechaEscritorio: '' },
    contactabilidad: { month: 'enero', seller: '', contactados: '' },
    metas: {
      month: 'enero',
      seller: '',
      bado: '',
      bmi: '',
      bas: '',
      mlt: '',
      mgp: '',
      mia: '',
      mba: '',
      total: '',
    },
    cumplimiento: {
      month: 'enero',
      seller: '',
      bado: '',
      bmi: '',
      bas: '',
      mlt: '',
      mgp: '',
      mia: '',
      mba: '',
      total: '',
    },
    resumen: {
      month: 'enero',
      seller: '',
      propuestas: '',
      alianzasTrabajadas: '',
      citas: '',
      contactabilidad: '',
      venta: '',
    },
  },
  ejecutivo: {
    leads: { month: 'enero', seller: '', empresa: '', cliente: '', programId: '', estatus: EXEC_STATUS[0], ventaQ: '' },
    llamadas: { month: 'enero', seller: '', totalLlamadas: '' },
    datosActualizados: { month: 'enero', seller: '', empresa: '', nombre: '', cargo: '', telefono: '', correo: '' },
    clientesNuevos: { month: 'enero', seller: '', empresa: '', nombre: '', cargo: '', telefono: '', correo: '' },
    facturacion: { month: 'enero', seller: '', fecha: '', empresa: '', tipoCurso: '', nombreCurso: '', importe: '' },
    programConfig: { name: '', cycle: 'anual', goalQ: '' },
  },
  incompany: {
    propuestas: {
      month: 'enero',
      seller: '',
      fecha: '',
      empresa: '',
      tipologiaCurso: '',
      nombreCurso: '',
      inversion: '',
      estatus: INC_PROPOSAL_STATUS[0],
      totalFinalQ: '',
    },
    citas: { month: 'enero', seller: '', fecha: '', empresa: '', contacto: '', motivo: INC_MOTIVOS[0] },
    facturacion: { month: 'enero', seller: '', fecha: '', empresa: '', tipoCurso: '', nombreCurso: '', importe: '' },
  },
}

function filterRecords(records, months, seller) {
  return records.filter((row) => {
    const monthMatch = months.includes(row.month)
    const sellerMatch = seller === 'todas' ? true : row.seller === seller
    return monthMatch && sellerMatch
  })
}

function statusFromSuperiorLead(estado) {
  const value = sanitizeText(estado, 80).toLowerCase()
  if (value.includes('cancel')) {
    return 'Canceladas'
  }
  if (value.includes('venta')) {
    return 'Cerradas'
  }
  return 'Abiertas'
}

function calculateComplianceScore({ propuestas, alianzas, citas, contactabilidad, venta, meta }) {
  const score =
    Math.min(propuestas / 40, 1) * 0.1 +
    Math.min(alianzas / 8, 1) * 0.1 +
    Math.min(citas / 10, 1) * 0.1 +
    Math.min(contactabilidad / 220, 1) * 0.1 +
    Math.min(meta > 0 ? venta / meta : 0, 1) * 0.6
  return score * 100
}

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`
  const finalPath =
    API_BASE_URL.endsWith('/api') && normalizedPath.startsWith('/api/')
      ? normalizedPath.slice(4)
      : normalizedPath
  const response = await fetch(`${API_BASE_URL}${finalPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`)
  }
  return data
}

function mergeWithDefaults(remoteDataset) {
  const defaults = buildAnnualDemoData()
  if (!remoteDataset || typeof remoteDataset !== 'object') return defaults
  return {
    ...defaults,
    ...remoteDataset,
    superior: { ...defaults.superior, ...remoteDataset.superior },
    ejecutivo: { ...defaults.ejecutivo, ...remoteDataset.ejecutivo },
    incompany: { ...defaults.incompany, ...remoteDataset.incompany },
    goals: {
      ...defaults.goals,
      ...remoteDataset.goals,
      superior: {
        ...defaults.goals.superior,
        ...remoteDataset.goals?.superior,
        bySeller: {
          ...defaults.goals.superior.bySeller,
          ...remoteDataset.goals?.superior?.bySeller,
        },
      },
      ejecutivo: {
        ...defaults.goals.ejecutivo,
        ...remoteDataset.goals?.ejecutivo,
        bySeller: {
          ...defaults.goals.ejecutivo.bySeller,
          ...remoteDataset.goals?.ejecutivo?.bySeller,
        },
        salesMonthlyBySeller: {
          ...defaults.goals.ejecutivo.salesMonthlyBySeller,
          ...remoteDataset.goals?.ejecutivo?.salesMonthlyBySeller,
        },
      },
      incompany: {
        ...defaults.goals.incompany,
        ...remoteDataset.goals?.incompany,
        salesAnnualBySeller: {
          ...defaults.goals.incompany.salesAnnualBySeller,
          ...remoteDataset.goals?.incompany?.salesAnnualBySeller,
        },
        salesMonthlyBySeller: {
          ...defaults.goals.incompany.salesMonthlyBySeller,
          ...remoteDataset.goals?.incompany?.salesMonthlyBySeller,
        },
      },
    },
  }
}

function asNAWhenZero(value, formatter) {
  return value > 0 ? formatter(value) : 'N/A'
}

function App() {
  const [dataset, setDataset] = useState(() => buildAnnualDemoData())
  const [sellersByArea, setSellersByArea] = useState({ superior: [], ejecutivo: [], incompany: [] })
  const [auth, setAuth] = useState(() => {
    const saved = sessionStorage.getItem(AUTH_KEY)
    if (!saved) {
      return null
    }
    try {
      return JSON.parse(saved)
    } catch {
      return null
    }
  })
  const [loginInput, setLoginInput] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [datasetHydrated, setDatasetHydrated] = useState(false)
  const [view, setView] = useState('dashboard')
  const [activeArea, setActiveArea] = useState('superior')
  const [activeMonth, setActiveMonth] = useState('enero')
  const [periodType, setPeriodType] = useState('mensual')
  const [selectedExecutiveProgram, setSelectedExecutiveProgram] = useState('todos')
  const [selectedSellerByArea, setSelectedSellerByArea] = useState({
    superior: 'todas',
    ejecutivo: 'todas',
    incompany: 'todas',
  })
  const [criterionByArea, setCriterionByArea] = useState({
    superior: AREA_CONFIG.superior.criteria[0],
    ejecutivo: AREA_CONFIG.ejecutivo.criteria[0],
    incompany: AREA_CONFIG.incompany.criteria[0],
  })
  const [forms, setForms] = useState(INITIAL_FORMS)
  const [flashMessage, setFlashMessage] = useState('')
  const toastTimerRef = useRef(null)
  const [recordViewer, setRecordViewer] = useState(null)
  const [recordDraft, setRecordDraft] = useState(null)
  const [goalSellerByArea, setGoalSellerByArea] = useState({
    superior: '',
    ejecutivo: '',
    incompany: '',
  })

  const isMaster = auth?.role === 'master'
  const canAccessArea = (area) => isMaster || auth?.area === area
  const activeCriterion = criterionByArea[activeArea]
  const visibleCriteria = useMemo(() => {
    if (isMaster) {
      return AREA_CONFIG[activeArea].criteria
    }
    const restricted = getRestrictedAdvisorCriteria(activeArea)
    return AREA_CONFIG[activeArea].criteria.filter((criterion) => !restricted.has(criterion))
  }, [activeArea, isMaster])

  const sellerOptions = sellersByArea[activeArea] || []
  const getAreaSellers = (area) => sellersByArea[area] || []
  const effectiveSeller = isMaster ? selectedSellerByArea[activeArea] : auth?.seller || 'todas'
  const periodMonths = useMemo(() => getPeriodMonths(activeMonth, periodType), [activeMonth, periodType])
  const periodMetaLabel = useMemo(() => getPeriodMetaLabel(periodType), [periodType])
  const executivePrograms = dataset.ejecutivo.programCatalog || []
  const activeYear = new Date().getFullYear()

  function persistGoal({ area, criterion, seller = null, month = null, value, periodType = 'mensual' }) {
    if (!auth?.accessToken) return
    apiRequest('/api/data/goal', {
      method: 'POST',
      token: auth.accessToken,
      body: { area, criterion, seller, month, value: Number(value || 0), periodType, year: activeYear },
    }).catch((err) => {
      console.error(err)
      setFlashMessage('No se pudo guardar meta en servidor')
    })
  }

  useEffect(() => {
    if (!isMaster && view === 'metas') {
      setView('dashboard')
    }
  }, [isMaster, view])

  useEffect(() => {
    if (!visibleCriteria.includes(activeCriterion)) {
      updateCriterion(activeArea, visibleCriteria[0] || AREA_CONFIG[activeArea].criteria[0])
    }
  }, [activeArea, activeCriterion, visibleCriteria])

  useEffect(() => {
    if (!flashMessage) {
      return undefined
    }
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = setTimeout(() => setFlashMessage(''), 2600)
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [flashMessage])

  useEffect(() => {
    let cancelled = false
    async function hydrateFromBackend() {
      if (!auth?.accessToken) {
        setDatasetHydrated(false)
        return
      }
      try {
        const remote = await apiRequest('/api/data/bootstrap', { token: auth.accessToken })
        if (cancelled) return
        const remoteSellers = remote?.sellersByArea || { superior: [], ejecutivo: [], incompany: [] }
        setSellersByArea(remoteSellers)
        setGoalSellerByArea({
          superior: remoteSellers.superior?.[0] || '',
          ejecutivo: remoteSellers.ejecutivo?.[0] || '',
          incompany: remoteSellers.incompany?.[0] || '',
        })
        if (remote?.dataset && typeof remote.dataset === 'object') {
          setDataset(mergeWithDefaults(remote.dataset))
        } else setDataset(buildAnnualDemoData())
        setDatasetHydrated(true)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setFlashMessage('No se pudo cargar registros desde servidor')
        setDatasetHydrated(false)
      }
    }
    hydrateFromBackend()
    return () => {
      cancelled = true
    }
  }, [auth?.accessToken])

  function handleLoginSubmit(event) {
    event.preventDefault()
    const email = sanitizeText(loginInput.email, 120)
    const password = loginInput.password

    apiRequest('/api/auth/login', { method: 'POST', body: { email, password } })
      .then(async (loginData) => {
        const token = loginData?.session?.access_token
        if (!token) throw new Error('Sesion invalida')
        const me = await apiRequest('/api/auth/me', { token })
        const profile = me?.profile
        const session = {
          email: me?.user?.email || email,
          role: profile?.role || 'advisor',
          name: profile?.display_name || me?.user?.email || 'Usuario',
          area: profile?.area || null,
          seller: profile?.seller_name || null,
          accessToken: token,
        }
        setAuth(session)
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(session))
        setLoginError('')
        if (session.role === 'advisor' && session.area) {
          setActiveArea(session.area)
          setSelectedSellerByArea((prev) => ({ ...prev, [session.area]: session.seller }))
        }
      })
      .catch((err) => {
        setLoginError(err.message || 'Credenciales invalidas')
      })
  }

  function handleLogout() {
    setAuth(null)
    setDatasetHydrated(false)
    sessionStorage.removeItem(AUTH_KEY)
    setLoginInput({ email: '', password: '' })
    setView('dashboard')
    setFlashMessage('')
  }

  function updateForm(area, criterion, field, value) {
    setForms((prev) => ({
      ...prev,
      [area]: {
        ...prev[area],
        [criterion]: {
          ...prev[area][criterion],
          [field]: value,
        },
      },
    }))
  }

  function updateCriterion(area, value) {
    if (!isMaster) {
      const restricted = getRestrictedAdvisorCriteria(area)
      if (restricted.has(value)) {
        setFlashMessage('Este criterio no esta disponible para asesores')
        return
      }
    }
    setCriterionByArea((prev) => ({ ...prev, [area]: value }))
  }

  function updateSellerSelection(area, value) {
    setSelectedSellerByArea((prev) => ({ ...prev, [area]: value }))
  }

  function updateAreaGoal(area, key, value) {
    if (!isMaster) {
      return
    }
    const numeric = toNumber(value)
    setDataset((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [area]: {
          ...prev.goals[area],
          [key]: numeric,
        },
      },
    }))
    persistGoal({ area, criterion: key, seller: null, month: null, value: numeric, periodType: 'mensual' })
  }

  function updateGoalSeller(area, seller) {
    setGoalSellerByArea((prev) => ({ ...prev, [area]: seller }))
  }

  function updateAreaGoalBySeller(area, seller, key, value) {
    if (!isMaster) {
      return
    }
    const numeric = toNumber(value)
    setDataset((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [area]: {
          ...prev.goals[area],
          bySeller: {
            ...prev.goals[area].bySeller,
            [seller]: {
              ...prev.goals[area].bySeller?.[seller],
              [key]: numeric,
            },
          },
        },
      },
    }))
    persistGoal({ area, criterion: key, seller, month: null, value: numeric, periodType: 'mensual' })
  }

  function updateIncompanyGoalAnnual(seller, value) {
    if (!isMaster) {
      return
    }
    const annual = toNumber(value)
    const baseMonthly = dataset.goals.incompany.salesMonthlyBySeller[seller] || {}
    const totalCurrent = MONTHS.reduce((acc, month) => acc + (baseMonthly[month] || 0), 0) || 1
    const scaledMonthly = MONTHS.reduce((acc, month) => {
      acc[month] = round2(((baseMonthly[month] || 0) / totalCurrent) * annual)
      return acc
    }, {})

    setDataset((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        incompany: {
          ...prev.goals.incompany,
          salesAnnualBySeller: {
            ...prev.goals.incompany.salesAnnualBySeller,
            [seller]: annual,
          },
          salesMonthlyBySeller: {
            ...prev.goals.incompany.salesMonthlyBySeller,
            [seller]: scaledMonthly,
          },
        },
      },
    }))
    persistGoal({ area: 'incompany', criterion: 'salesAnnual', seller, month: null, value: annual, periodType: 'anual' })
    MONTHS.forEach((month, index) => {
      persistGoal({
        area: 'incompany',
        criterion: 'salesMonthly',
        seller,
        month: index + 1,
        value: scaledMonthly[month] || 0,
        periodType: 'mensual',
      })
    })
  }

  function updateIncompanyGoalMonthly(seller, month, value) {
    if (!isMaster) {
      return
    }
    const numeric = toNumber(value)
    setDataset((prev) => {
      const currentMonthly = {
        ...(prev.goals.incompany.salesMonthlyBySeller[seller] || {}),
        [month]: numeric,
      }
      const recomputedAnnual = MONTHS.reduce((acc, item) => acc + (currentMonthly[item] || 0), 0)
      return {
        ...prev,
        goals: {
          ...prev.goals,
          incompany: {
            ...prev.goals.incompany,
            salesAnnualBySeller: {
              ...prev.goals.incompany.salesAnnualBySeller,
              [seller]: round2(recomputedAnnual),
            },
            salesMonthlyBySeller: {
              ...prev.goals.incompany.salesMonthlyBySeller,
              [seller]: currentMonthly,
            },
          },
        },
      }
    })
    persistGoal({ area: 'incompany', criterion: 'salesMonthly', seller, month: MONTHS.indexOf(month) + 1, value: numeric, periodType: 'mensual' })
  }

  function updateExecutiveGoalMonthly(month, value) {
    if (!isMaster) {
      return
    }
    const numeric = toNumber(value)
    setDataset((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        ejecutivo: {
          ...prev.goals.ejecutivo,
          salesMonthlyBySeller: {
            ...prev.goals.ejecutivo.salesMonthlyBySeller,
            [goalSellerByArea.ejecutivo]: {
              ...(prev.goals.ejecutivo.salesMonthlyBySeller?.[goalSellerByArea.ejecutivo] || {}),
              [month]: numeric,
            },
          },
        },
      },
    }))
    persistGoal({
      area: 'ejecutivo',
      criterion: 'salesMonthly',
      seller: goalSellerByArea.ejecutivo,
      month: MONTHS.indexOf(month) + 1,
      value: numeric,
      periodType: 'mensual',
    })
  }

  function saveRecord(area, criterion, payload) {
    const actor = auth?.name || auth?.username || 'Sistema'
    const now = new Date().toISOString()
    const historySeed = payload.changeHistory || [
      {
        id: crypto.randomUUID(),
        at: now,
        by: actor,
        action: 'CREATED',
        changes: ['Registro creado'],
      },
    ]

    setDataset((prev) => ({
      ...prev,
      [area]: {
        ...prev[area],
        [criterion]: [
          ...prev[area][criterion],
          {
            ...payload,
            createdAt: payload.createdAt || now,
            updatedAt: now,
            changeHistory: historySeed,
          },
        ],
      },
    }))

    if (auth?.accessToken) {
      apiRequest('/api/data/record', {
        method: 'POST',
        token: auth.accessToken,
        body: { area, criterion, record: payload },
      }).catch((err) => {
        console.error(err)
        setFlashMessage('No se pudo guardar registro en servidor')
      })
    }
  }

  function deleteRecord(area, criterion, id) {
    const sourceRow = dataset[area]?.[criterion]?.find((row) => row.id === id)
    if (!sourceRow) {
      setFlashMessage('No se encontro el registro para eliminar')
      return
    }
    if (!isMaster) {
      setFlashMessage('Solo gerencia puede eliminar registros')
      return
    }
    const confirmed = window.confirm('¿Seguro que deseas eliminar este registro? Esta accion no se puede deshacer.')
    if (!confirmed) {
      setFlashMessage('Eliminacion cancelada')
      return
    }
    setDataset((prev) => ({
      ...prev,
      [area]: {
        ...prev[area],
        [criterion]: prev[area][criterion].filter((row) => row.id !== id),
      },
    }))
    if (auth?.accessToken) {
      apiRequest(`/api/data/record/${id}`, { method: 'DELETE', token: auth.accessToken }).catch((err) => {
        console.error(err)
        setFlashMessage(`No se pudo eliminar en servidor: ${err.message}`)
      })
    }
    setFlashMessage('Registro eliminado')
  }

  function canEditRecord(area, criterion, row) {
    return canAccessArea(area)
  }

  function openRecordViewer(area, criterion, row) {
    setRecordViewer({ area, criterion, id: row.id })
    setRecordDraft({ ...row })
  }

  function closeRecordViewer() {
    setRecordViewer(null)
    setRecordDraft(null)
  }

  function updateRecordDraft(field, value) {
    setRecordDraft((prev) => ({ ...prev, [field]: value }))
  }

  function saveRecordChanges() {
    if (!recordViewer || !recordDraft) {
      return
    }
    const { area, criterion, id } = recordViewer
    const sourceRow = dataset[area]?.[criterion]?.find((row) => row.id === id)
    if (!sourceRow) {
      setFlashMessage('No se encontro el registro para actualizar')
      return
    }
    if (!canEditRecord(area, criterion, sourceRow)) {
      setFlashMessage('No tienes permisos para actualizar este registro')
      return
    }

    const key = `${area}:${criterion}`
    const columns = getColumns(area, criterion)
    const editableFields = columns.map((col) => col.key).filter((keyName) => keyName !== 'id')

    const normalized = { ...sourceRow }
    editableFields.forEach((field) => {
      const draftValue = recordDraft[field]
      if (typeof sourceRow[field] === 'number') {
        normalized[field] = toNumber(draftValue)
      } else {
        normalized[field] = sanitizeText(draftValue, 180)
      }
    })

    const changes = editableFields
      .filter((field) => `${sourceRow[field] ?? ''}` !== `${normalized[field] ?? ''}`)
      .map((field) => {
        const previous = sourceRow[field] ?? ''
        const next = normalized[field] ?? ''
        return `${field}: "${previous}" -> "${next}"`
      })

    if (changes.length === 0) {
      setFlashMessage('No hay cambios para guardar')
      return
    }
    const confirmed = window.confirm('¿Deseas guardar los cambios de este registro?')
    if (!confirmed) {
      setFlashMessage('Edicion cancelada')
      return
    }

    const historyEntry = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      by: auth?.name || auth?.username || 'Sistema',
      action: 'UPDATED',
      changes,
    }

    setDataset((prev) => ({
      ...prev,
      [area]: {
        ...prev[area],
        [criterion]: prev[area][criterion].map((row) =>
          row.id === id
            ? {
                ...row,
                ...normalized,
                updatedAt: historyEntry.at,
                changeHistory: [...(row.changeHistory || []), historyEntry],
              }
            : row,
        ),
      },
    }))

    if (auth?.accessToken) {
      apiRequest(`/api/data/record/${id}`, {
        method: 'PATCH',
        token: auth.accessToken,
        body: { area, criterion, record: normalized },
      }).catch((err) => {
        console.error(err)
        setFlashMessage('No se pudo guardar la edicion en servidor')
      })
    }

    setFlashMessage('Registro actualizado')
    closeRecordViewer()
  }

  function isManagerialCriterion(area, criterion) {
    if (area === 'incompany' && criterion === 'facturacion') {
      return true
    }
    if (area === 'ejecutivo' && criterion === 'facturacion') {
      return true
    }
    if (area === 'superior' && (criterion === 'metas' || criterion === 'cumplimiento')) {
      return true
    }
    return false
  }

  function submitCurrentCriterion(event) {
    event.preventDefault()

    if (!canAccessArea(activeArea)) {
      setFlashMessage('No tienes permisos para esta area')
      return
    }
    if (!isMaster) {
      const restricted = getRestrictedAdvisorCriteria(activeArea)
      if (restricted.has(activeCriterion)) {
        setFlashMessage('Este criterio no esta disponible para asesores')
        return
      }
    }
    if (!isMaster && isManagerialCriterion(activeArea, activeCriterion)) {
      setFlashMessage('Este criterio es de uso gerencial')
      return
    }

    const current = forms[activeArea][activeCriterion]
    const month = sanitizeText(current.month, 20).toLowerCase()
    const seller = sanitizeText(current.seller, 80) || (isMaster ? '' : auth?.seller || '')
    const finalSeller = seller || (isMaster ? '' : auth?.seller || '')

    if (!MONTHS.includes(month) || !finalSeller) {
      setFlashMessage('Mes y asesor son obligatorios')
      return
    }
    const saveConfirmed = window.confirm('¿Deseas guardar este registro?')
    if (!saveConfirmed) {
      setFlashMessage('Guardado cancelado')
      return
    }
    const requireText = (value, label) => {
      if (!sanitizeText(value, 120)) {
        setFlashMessage(`${label} es obligatorio`)
        return false
      }
      return true
    }
    const requirePositive = (value, label) => {
      if (toNumber(value) <= 0) {
        setFlashMessage(`${label} debe ser mayor a 0`)
        return false
      }
      return true
    }

    if (activeArea === 'superior') {
      if (activeCriterion === 'leads') {
        if (!requireText(current.nombre, 'Nombre') || !requireText(current.carrera, 'Carrera') || !requireText(current.estado, 'Estado')) {
          return
        }
        saveRecord('superior', 'leads', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          nombre: sanitizeText(current.nombre, 80),
          carrera: sanitizeText(current.carrera, 60),
          estado: sanitizeText(current.estado, 80),
          ventaQ: toNumber(current.ventaQ),
        })
      } else if (activeCriterion === 'alianzas') {
        if (!requireText(current.empresa, 'Empresa') || !requireText(current.estatus, 'Estatus') || !requireText(current.fechaEscritorio, 'Fecha de escritorio')) {
          return
        }
        saveRecord('superior', 'alianzas', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          empresa: sanitizeText(current.empresa, 80),
          estatus: sanitizeText(current.estatus, 80),
          fechaEscritorio: sanitizeText(current.fechaEscritorio, 30),
        })
      } else if (activeCriterion === 'contactabilidad') {
        if (!requirePositive(current.contactados, 'Contactados')) {
          return
        }
        saveRecord('superior', 'contactabilidad', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          contactados: toNumber(current.contactados),
        })
      } else if (activeCriterion === 'resumen') {
        if (
          !requirePositive(current.propuestas, 'Propuestas') ||
          !requirePositive(current.alianzasTrabajadas, 'Alianzas trabajadas') ||
          !requirePositive(current.citas, 'Citas') ||
          !requirePositive(current.contactabilidad, 'Contactabilidad') ||
          !requirePositive(current.venta, 'Venta')
        ) {
          return
        }
        saveRecord('superior', 'resumen', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          propuestas: toNumber(current.propuestas),
          alianzasTrabajadas: toNumber(current.alianzasTrabajadas),
          citas: toNumber(current.citas),
          contactabilidad: toNumber(current.contactabilidad),
          venta: toNumber(current.venta),
        })
      } else {
        const totals = PROGRAM_KEYS.reduce((acc, key) => acc + toNumber(current[key]), 0)
        saveRecord('superior', activeCriterion, {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          bado: toNumber(current.bado),
          bmi: toNumber(current.bmi),
          bas: toNumber(current.bas),
          mlt: toNumber(current.mlt),
          mgp: toNumber(current.mgp),
          mia: toNumber(current.mia),
          mba: toNumber(current.mba),
          total: toNumber(current.total) || totals,
        })
      }
    }

    if (activeArea === 'ejecutivo') {
      if (activeCriterion === 'leads') {
        if (!requireText(current.empresa, 'Empresa') || !requireText(current.cliente, 'Cliente')) {
          return
        }
        const program = dataset.ejecutivo.programCatalog.find((item) => item.id === current.programId)
        if (!program) {
          setFlashMessage('Selecciona un programa valido')
          return
        }
        saveRecord('ejecutivo', 'leads', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          empresa: sanitizeText(current.empresa, 80),
          cliente: sanitizeText(current.cliente, 80),
          programId: current.programId,
          programName: program.name,
          estatus: sanitizeText(current.estatus, 60),
          ventaQ: current.estatus === 'Venta' ? toNumber(current.ventaQ) : 0,
        })
      }
      if (activeCriterion === 'llamadas') {
        if (!requirePositive(current.totalLlamadas, 'Llamadas')) {
          return
        }
        saveRecord('ejecutivo', 'llamadas', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          totalLlamadas: toNumber(current.totalLlamadas),
        })
      }
      if (activeCriterion === 'datosActualizados') {
        if (
          !requireText(current.empresa, 'Empresa') ||
          !requireText(current.nombre, 'Nombre') ||
          !requireText(current.cargo, 'Cargo') ||
          !requireText(current.telefono, 'Telefono') ||
          !requireText(current.correo, 'Correo')
        ) {
          return
        }
        saveRecord('ejecutivo', 'datosActualizados', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          empresa: sanitizeText(current.empresa, 80),
          nombre: sanitizeText(current.nombre, 80),
          cargo: sanitizeText(current.cargo, 60),
          telefono: sanitizeText(current.telefono, 30),
          correo: sanitizeText(current.correo, 90),
        })
      }
      if (activeCriterion === 'clientesNuevos') {
        if (
          !requireText(current.empresa, 'Empresa') ||
          !requireText(current.nombre, 'Nombre') ||
          !requireText(current.cargo, 'Cargo') ||
          !requireText(current.telefono, 'Telefono') ||
          !requireText(current.correo, 'Correo')
        ) {
          return
        }
        saveRecord('ejecutivo', 'clientesNuevos', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          empresa: sanitizeText(current.empresa, 80),
          nombre: sanitizeText(current.nombre, 80),
          cargo: sanitizeText(current.cargo, 60),
          telefono: sanitizeText(current.telefono, 30),
          correo: sanitizeText(current.correo, 90),
        })
      }
      if (activeCriterion === 'facturacion') {
        if (!isMaster) {
          setFlashMessage('La facturacion solo puede llenarla gerencia')
          return
        }
        if (
          !requireText(current.fecha, 'Fecha') ||
          !requireText(current.empresa, 'Empresa') ||
          !requireText(current.tipoCurso, 'Tipo curso') ||
          !requireText(current.nombreCurso, 'Nombre curso') ||
          !requirePositive(current.importe, 'Importe')
        ) {
          return
        }
        saveRecord('ejecutivo', 'facturacion', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          fecha: sanitizeText(current.fecha, 20),
          empresa: sanitizeText(current.empresa, 80),
          tipoCurso: sanitizeText(current.tipoCurso, 70),
          nombreCurso: sanitizeText(current.nombreCurso, 80),
          importe: toNumber(current.importe),
        })
      }
    }

    if (activeArea === 'incompany') {
      if (activeCriterion === 'propuestas') {
        if (
          !requireText(current.fecha, 'Fecha') ||
          !requireText(current.empresa, 'Empresa') ||
          !requireText(current.tipologiaCurso, 'Tipologia de curso') ||
          !requireText(current.nombreCurso, 'Nombre de curso') ||
          !requirePositive(current.inversion, 'Inversion')
        ) {
          return
        }
        saveRecord('incompany', 'propuestas', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          fecha: sanitizeText(current.fecha, 20),
          empresa: sanitizeText(current.empresa, 80),
          tipologiaCurso: sanitizeText(current.tipologiaCurso, 60),
          nombreCurso: sanitizeText(current.nombreCurso, 80),
          inversion: toNumber(current.inversion),
          estatus: sanitizeText(current.estatus, 60),
          totalFinalQ: current.estatus === 'Cierre' ? toNumber(current.totalFinalQ) : 0,
        })
      }
      if (activeCriterion === 'citas') {
        if (!requireText(current.fecha, 'Fecha') || !requireText(current.empresa, 'Empresa') || !requireText(current.contacto, 'Contacto')) {
          return
        }
        saveRecord('incompany', 'citas', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          fecha: sanitizeText(current.fecha, 20),
          empresa: sanitizeText(current.empresa, 80),
          contacto: sanitizeText(current.contacto, 80),
          motivo: sanitizeText(current.motivo, 80),
        })
      }
      if (activeCriterion === 'facturacion') {
        if (!isMaster) {
          setFlashMessage('La facturacion solo puede llenarla gerencia')
          return
        }
        if (
          !requireText(current.fecha, 'Fecha') ||
          !requireText(current.empresa, 'Empresa') ||
          !requireText(current.tipoCurso, 'Tipo curso') ||
          !requireText(current.nombreCurso, 'Nombre curso') ||
          !requirePositive(current.importe, 'Importe')
        ) {
          return
        }
        saveRecord('incompany', 'facturacion', {
          id: crypto.randomUUID(),
          month,
          seller: finalSeller,
          fecha: sanitizeText(current.fecha, 20),
          empresa: sanitizeText(current.empresa, 80),
          tipoCurso: sanitizeText(current.tipoCurso, 70),
          nombreCurso: sanitizeText(current.nombreCurso, 80),
          importe: toNumber(current.importe),
        })
      }
    }

    setFlashMessage('Registro guardado correctamente')
  }

  function addProgramConfig(event) {
    event.preventDefault()
    if (!isMaster) {
      return
    }
    const config = forms.ejecutivo.programConfig
    const name = sanitizeText(config.name, 80)
    if (!name) {
      setFlashMessage('El nombre de programa es obligatorio')
      return
    }
    if (!auth?.accessToken) {
      setFlashMessage('Sesion expirada. Inicia sesion nuevamente')
      return
    }
    const payload = {
      name,
      cycle: String(config.cycle || 'anual').toLowerCase(),
      goalQ: toNumber(config.goalQ),
    }
    apiRequest('/api/data/program', { method: 'POST', token: auth.accessToken, body: payload })
      .then((response) => {
        const program = response?.program || {
          id: crypto.randomUUID(),
          name: payload.name,
          cycle: payload.cycle,
          goalQ: payload.goalQ,
        }
        setDataset((prev) => ({
          ...prev,
          ejecutivo: {
            ...prev.ejecutivo,
            programCatalog: [...prev.ejecutivo.programCatalog, program],
          },
        }))
        setForms((prev) => ({
          ...prev,
          ejecutivo: {
            ...prev.ejecutivo,
            programConfig: { name: '', cycle: 'anual', goalQ: '' },
          },
        }))
        setFlashMessage('Programa guardado en base de datos')
      })
      .catch((err) => {
        console.error(err)
        setFlashMessage(`No se pudo guardar programa: ${err.message}`)
      })
  }

  function editProgramConfig(program) {
    if (!isMaster || !auth?.accessToken) return
    const newName = window.prompt('Nombre del programa', program.name)
    if (!newName) return
    const newCycle = window.prompt('Ciclo (enero..diciembre o anual)', program.cycle)
    if (!newCycle) return
    const newGoalRaw = window.prompt('Meta Q', `${program.goalQ || 0}`)
    if (newGoalRaw == null) return
    const payload = {
      name: sanitizeText(newName, 80),
      cycle: sanitizeText(newCycle, 20).toLowerCase(),
      goalQ: toNumber(newGoalRaw),
    }
    apiRequest(`/api/data/program/${program.id}`, { method: 'PATCH', token: auth.accessToken, body: payload })
      .then(() => {
        setDataset((prev) => ({
          ...prev,
          ejecutivo: {
            ...prev.ejecutivo,
            programCatalog: prev.ejecutivo.programCatalog.map((p) => (p.id === program.id ? { ...p, ...payload } : p)),
          },
        }))
        setFlashMessage('Programa actualizado')
      })
      .catch((err) => {
        console.error(err)
        setFlashMessage(`No se pudo actualizar programa: ${err.message}`)
      })
  }

  function deactivateProgram(programId) {
    if (!isMaster || !auth?.accessToken) return
    if (!window.confirm('Desactivar este programa?')) return
    apiRequest(`/api/data/program/${programId}`, { method: 'DELETE', token: auth.accessToken })
      .then(() => {
        setDataset((prev) => ({
          ...prev,
          ejecutivo: {
            ...prev.ejecutivo,
            programCatalog: prev.ejecutivo.programCatalog.filter((p) => p.id !== programId),
          },
        }))
        setFlashMessage('Programa desactivado')
      })
      .catch((err) => {
        console.error(err)
        setFlashMessage(`No se pudo desactivar programa: ${err.message}`)
      })
  }

  const superiorFiltered = useMemo(() => {
    const leads = filterRecords(dataset.superior.leads, periodMonths, effectiveSeller)
    const alianzas = filterRecords(dataset.superior.alianzas, periodMonths, effectiveSeller)
    const contactabilidad = filterRecords(dataset.superior.contactabilidad, periodMonths, effectiveSeller)
    const metas = filterRecords(dataset.superior.metas, periodMonths, effectiveSeller)
    const cumplimiento = filterRecords(dataset.superior.cumplimiento, periodMonths, effectiveSeller)
    const resumen = filterRecords(dataset.superior.resumen, periodMonths, effectiveSeller)
    return { leads, alianzas, contactabilidad, metas, cumplimiento, resumen }
  }, [dataset.superior, periodMonths, effectiveSeller])

  const ejecutivoFiltered = useMemo(() => {
    const leads = filterRecords(dataset.ejecutivo.leads, periodMonths, effectiveSeller).filter((row) =>
      selectedExecutiveProgram === 'todos' ? true : row.programId === selectedExecutiveProgram,
    )
    const llamadas = filterRecords(dataset.ejecutivo.llamadas, periodMonths, effectiveSeller)
    const datosActualizados = filterRecords(dataset.ejecutivo.datosActualizados, periodMonths, effectiveSeller)
    const clientesNuevos = filterRecords(dataset.ejecutivo.clientesNuevos, periodMonths, effectiveSeller)
    const facturacion = filterRecords(dataset.ejecutivo.facturacion, periodMonths, effectiveSeller)
    return { leads, llamadas, datosActualizados, clientesNuevos, facturacion }
  }, [dataset.ejecutivo, periodMonths, effectiveSeller, selectedExecutiveProgram])

  const incompanyFiltered = useMemo(() => {
    const propuestas = filterRecords(dataset.incompany.propuestas, periodMonths, effectiveSeller)
    const citas = filterRecords(dataset.incompany.citas, periodMonths, effectiveSeller)
    const facturacion = filterRecords(dataset.incompany.facturacion, periodMonths, effectiveSeller)
    return { propuestas, citas, facturacion }
  }, [dataset.incompany, periodMonths, effectiveSeller])

  const currentAreaGoals = useMemo(() => {
    if (activeArea === 'superior') {
      const selected = effectiveSeller === 'todas' ? getAreaSellers('superior') : [effectiveSeller]
      const sumGoal = (key) =>
        selected.reduce((acc, seller) => acc + (dataset.goals.superior.bySeller?.[seller]?.[key] || 0), 0) *
        periodMonths.length
      return [
        { label: `Meta ventas ${periodMetaLabel}`, value: asNAWhenZero(sumGoal('ventasMonthly'), formatCurrency) },
        { label: `Meta contactabilidad ${periodMetaLabel}`, value: asNAWhenZero(sumGoal('contactabilidadMonthly'), (v) => formatNumber(v, 0)) },
        { label: `Meta alianzas ${periodMetaLabel}`, value: asNAWhenZero(sumGoal('alianzasMonthly'), (v) => formatNumber(v, 0)) },
        { label: `Meta citas ${periodMetaLabel}`, value: asNAWhenZero(sumGoal('citasMonthly'), (v) => formatNumber(v, 0)) },
      ]
    }
    if (activeArea === 'ejecutivo') {
      const selected = effectiveSeller === 'todas' ? getAreaSellers('ejecutivo') : [effectiveSeller]
      const sumGoal = (key) =>
        selected.reduce((acc, seller) => acc + (dataset.goals.ejecutivo.bySeller?.[seller]?.[key] || 0), 0) *
        periodMonths.length
      const executiveSalesGoal = selected.reduce(
        (acc, seller) =>
          acc +
          periodMonths.reduce(
            (monthAcc, month) => monthAcc + (dataset.goals.ejecutivo.salesMonthlyBySeller?.[seller]?.[month] || 0),
            0,
          ),
        0,
      )
      return [
        { label: `Meta global ventas ${periodMetaLabel}`, value: asNAWhenZero(executiveSalesGoal, formatCurrency) },
        { label: `Meta llamadas ${periodMetaLabel}`, value: asNAWhenZero(sumGoal('llamadasMonthly'), (v) => formatNumber(v, 0)) },
        { label: `Meta datos actualizados ${periodMetaLabel}`, value: asNAWhenZero(sumGoal('datosActualizadosMonthly'), (v) => formatNumber(v, 0)) },
        { label: `Meta clientes nuevos ${periodMetaLabel}`, value: asNAWhenZero(sumGoal('clientesNuevosMonthly'), (v) => formatNumber(v, 0)) },
      ]
    }
    const incompanyGoalPeriod = (seller) =>
      periodMonths.reduce((acc, month) => acc + (dataset.goals.incompany.salesMonthlyBySeller?.[seller]?.[month] || 0), 0)
    const totalGoal =
      effectiveSeller === 'todas'
        ? getAreaSellers('incompany').reduce((acc, seller) => acc + incompanyGoalPeriod(seller), 0)
        : incompanyGoalPeriod(effectiveSeller)

    return [
      { label: `Meta ventas ${periodMetaLabel}`, value: asNAWhenZero(totalGoal, formatCurrency) },
      { label: `Meta citas ${periodMetaLabel}`, value: asNAWhenZero((dataset.goals.incompany.citasMonthly || 0) * periodMonths.length, (v) => formatNumber(v, 0)) },
      ...getAreaSellers('incompany').map((seller) => ({
        label: `Meta anual ${seller}`,
        value: asNAWhenZero(dataset.goals.incompany.salesAnnualBySeller?.[seller] || 0, formatCurrency),
      })),
    ]
  }, [activeArea, dataset.goals, effectiveSeller, periodMetaLabel, periodMonths])

  const dashboardData = useMemo(() => {
    if (activeArea === 'superior') {
      const totalSales = superiorFiltered.resumen.reduce((acc, row) => acc + row.venta, 0)
      const totalMeta = superiorFiltered.metas.reduce((acc, row) => acc + row.total, 0)
      const totalCumpl = superiorFiltered.cumplimiento.reduce((acc, row) => acc + row.total, 0)
      const proposalStatusRaw = superiorFiltered.leads.reduce(
        (acc, row) => {
          const key = statusFromSuperiorLead(row.estado)
          acc[key] += 1
          return acc
        },
        { Cerradas: 0, Abiertas: 0, Canceladas: 0 },
      )
      const salesByProduct = PROGRAM_KEYS.map((key) => {
        const total = superiorFiltered.cumplimiento.reduce((acc, row) => acc + (row[key] || 0), 0)
        return { name: key.toUpperCase(), value: total }
      }).sort((a, b) => b.value - a.value)
      const topProducts = salesByProduct.slice(0, 3)
      const productAmountCards = salesByProduct.map((item) => ({
        title: item.name,
        value: formatCurrency(item.value),
        subtitle: 'Venta por producto',
        highlight: false,
      }))

      const salesTrend = periodMonths.map((month) => {
        const monthSales = filterRecords(dataset.superior.resumen, [month], effectiveSeller).reduce(
          (acc, row) => acc + row.venta,
          0,
        )
        return { month, venta: monthSales }
      })

      const contactTotal = superiorFiltered.contactabilidad.reduce((acc, row) => acc + row.contactados, 0)
      const contactGoal = Math.max(superiorFiltered.resumen.length, 1) * 220
      const contactPie = [
        { name: 'Contactados', value: contactTotal },
        { name: 'Pendiente', value: Math.max(contactGoal - contactTotal, 0) },
      ]

      const propuestasVsCerradas = Array.from(
        superiorFiltered.resumen.reduce((map, row) => {
          const current = map.get(row.seller) || { seller: row.seller, entregadas: 0, cerradas: 0 }
          current.entregadas += row.propuestas
          map.set(row.seller, current)
          return map
        }, new Map()),
      ).map(([seller, row]) => ({ seller, ...row }))

      superiorFiltered.leads.forEach((row) => {
        if (statusFromSuperiorLead(row.estado) === 'Cerradas') {
          const idx = propuestasVsCerradas.findIndex((item) => item.seller === row.seller)
          if (idx >= 0) {
            propuestasVsCerradas[idx].cerradas += 1
          }
        }
      })

      const alianzasChart = Array.from(
        superiorFiltered.alianzas.reduce((map, row) => {
          const key = row.empresa || 'Sin empresa'
          map.set(key, (map.get(key) || 0) + 1)
          return map
        }, new Map()),
      )
        .map(([empresa, total]) => ({ empresa, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)

      const citasBySeller = Array.from(
        superiorFiltered.resumen.reduce((map, row) => {
          map.set(row.seller, (map.get(row.seller) || 0) + row.citas)
          return map
        }, new Map()),
      ).map(([seller, citas]) => ({ seller, citas }))

      const cumplimientoBySeller = Array.from(
        superiorFiltered.resumen.reduce((map, row) => {
          const current = map.get(row.seller) || {
            seller: row.seller,
            propuestas: 0,
            alianzas: 0,
            citas: 0,
            contactabilidad: 0,
            venta: 0,
          }
          current.propuestas += row.propuestas
          current.alianzas += row.alianzasTrabajadas
          current.citas += row.citas
          current.contactabilidad += row.contactabilidad
          current.venta += row.venta
          map.set(row.seller, current)
          return map
        }, new Map()),
      ).map(([seller, row]) => ({ seller, ...row }))

      const metaBySeller = superiorFiltered.metas.reduce((map, row) => {
        map.set(row.seller, (map.get(row.seller) || 0) + row.total)
        return map
      }, new Map())

      const complianceIndicators = cumplimientoBySeller.map((row) => ({
        seller: row.seller,
        score: calculateComplianceScore({
          propuestas: row.propuestas,
          alianzas: row.alianzas,
          citas: row.citas,
          contactabilidad: row.contactabilidad,
          venta: row.venta,
          meta: metaBySeller.get(row.seller) || 0,
        }),
      }))

      return {
        cards: [
          { title: 'Ventas totales', value: formatCurrency(totalSales), subtitle: 'Resumen filtrado', highlight: true },
          { title: 'Estatus propuestas', value: `C:${proposalStatusRaw.Cerradas} A:${proposalStatusRaw.Abiertas} X:${proposalStatusRaw.Canceladas}`, subtitle: 'Cerradas / Abiertas / Canceladas', highlight: false },
          { title: 'Top 3 productos', value: topProducts.map((item) => item.name).join(', ') || 'Sin datos', subtitle: 'Por venta en Q', highlight: false },
          { title: 'Cumplimiento', value: `${formatNumber(totalMeta > 0 ? (totalCumpl / totalMeta) * 100 : 0, 2)}%`, subtitle: `Sobre meta ${periodMetaLabel} gerencial`, highlight: false },
          ...productAmountCards,
        ],
        charts: [
          { key: 'trend', title: 'Tendencia de ventas', type: 'line', data: salesTrend, x: 'month', y: 'venta', formatter: formatCurrency, color: CHART_COLORS.secondary, wide: true },
          { key: 'contact', title: 'Contactabilidad', type: 'pie', data: contactPie, x: 'name', y: 'value', formatter: (v) => formatNumber(v, 0) },
          { key: 'prop-vs-close', title: 'Propuestas entregadas vs cerradas', type: 'bar-group', data: propuestasVsCerradas, x: 'seller', y: 'entregadas', y2: 'cerradas', color: CHART_COLORS.accent, color2: CHART_COLORS.primary, formatter: (v) => formatNumber(v, 0) },
          { key: 'alianzas', title: 'Alianzas', type: 'hbar', data: alianzasChart, x: 'empresa', y: 'total', color: CHART_COLORS.secondary, formatter: (v) => formatNumber(v, 0), wide: true },
          { key: 'product-sales', title: 'Ventas por producto', type: 'pie', data: salesByProduct, x: 'name', y: 'value', formatter: formatCurrency, pieLabelNameOnly: true },
          { key: 'citas', title: 'Citas realizadas', type: 'bar', data: citasBySeller, x: 'seller', y: 'citas', color: CHART_COLORS.accent, formatter: (v) => formatNumber(v, 0) },
          { key: 'compliance-ind', title: 'Cumplimiento de indicadores', type: 'bar', data: complianceIndicators, x: 'seller', y: 'score', color: CHART_COLORS.primary, formatter: (v) => `${formatNumber(v, 2)}%`, full: true },
        ],
      }
    }

    if (activeArea === 'ejecutivo') {
      const selectedSellers = effectiveSeller === 'todas' ? getAreaSellers('ejecutivo') : [effectiveSeller]
      const totalLlamadas = ejecutivoFiltered.llamadas.reduce((acc, row) => acc + row.totalLlamadas, 0)
      const totalLeads = ejecutivoFiltered.leads.length
      const totalVentas = ejecutivoFiltered.leads
        .filter((row) => row.estatus === 'Venta')
        .reduce((acc, row) => acc + row.ventaQ, 0)
      const facturadoTotal = ejecutivoFiltered.facturacion.reduce((acc, row) => acc + row.importe, 0)
      const backlogTotal = Math.max(totalVentas - facturadoTotal, 0)
      const globalSalesGoal = selectedSellers.reduce(
        (acc, seller) =>
          acc +
          periodMonths.reduce(
            (monthAcc, month) => monthAcc + (dataset.goals.ejecutivo.salesMonthlyBySeller?.[seller]?.[month] || 0),
            0,
          ),
        0,
      )
      const globalSalesCompliance = globalSalesGoal > 0 ? (totalVentas / globalSalesGoal) * 100 : 0
      const monthlyGoal =
        selectedSellers.reduce((acc, seller) => acc + (dataset.goals.ejecutivo.bySeller?.[seller]?.llamadasMonthly || 1600), 0) *
        Math.max(periodMonths.length, 1)
      const dataGoal =
        selectedSellers.reduce((acc, seller) => acc + (dataset.goals.ejecutivo.bySeller?.[seller]?.datosActualizadosMonthly || 160), 0) *
        Math.max(periodMonths.length, 1)
      const clientesGoal =
        selectedSellers.reduce((acc, seller) => acc + (dataset.goals.ejecutivo.bySeller?.[seller]?.clientesNuevosMonthly || 160), 0) *
        Math.max(periodMonths.length, 1)
      const currentDatos = ejecutivoFiltered.datosActualizados.length
      const currentClientes = ejecutivoFiltered.clientesNuevos.length
      const datosCompliance = dataGoal > 0 ? (currentDatos / dataGoal) * 100 : 0
      const clientesCompliance = clientesGoal > 0 ? (currentClientes / clientesGoal) * 100 : 0

      const leadsStatus = Array.from(
        ejecutivoFiltered.leads.reduce((map, row) => {
          map.set(row.estatus, (map.get(row.estatus) || 0) + 1)
          return map
        }, new Map()),
      ).map(([name, value]) => ({ name, value }))

      const leadsByProgram = Array.from(
        ejecutivoFiltered.leads.reduce((map, row) => {
          map.set(row.programName, (map.get(row.programName) || 0) + 1)
          return map
        }, new Map()),
      ).map(([program, value]) => ({ program, value }))

      const ventasFacturadoBacklog = [
        { name: 'Ventas', value: totalVentas },
        { name: 'Facturado', value: facturadoTotal },
        { name: 'Backlog', value: backlogTotal },
      ]

      const soldProgramsMoney = Array.from(
        ejecutivoFiltered.leads
          .filter((row) => row.estatus === 'Venta')
          .reduce((map, row) => {
            const current = map.get(row.programName) || { program: row.programName, ventas: 0, ventaQ: 0 }
            current.ventas += 1
            current.ventaQ += row.ventaQ
            map.set(row.programName, current)
            return map
          }, new Map()),
      ).map(([program, values]) => ({
        program,
        ventas: values.ventas,
        ventaMilesQ: round2(values.ventaQ / 1000),
      }))

      return {
        cards: [
          { title: 'Ventas', value: formatCurrency(totalVentas), subtitle: 'Indicador principal', highlight: true },
          ...(isMaster
            ? [
                { title: 'Facturado', value: formatCurrency(facturadoTotal), subtitle: 'Facturacion del periodo', highlight: false },
                { title: 'Backlog', value: formatCurrency(backlogTotal), subtitle: 'Pendiente por facturar', highlight: false },
              ]
            : []),
          { title: 'Meta global ventas', value: formatCurrency(globalSalesGoal), subtitle: `Meta ${periodMetaLabel}`, highlight: false },
          { title: 'Cumplimiento meta global', value: `${formatNumber(globalSalesCompliance, 2)}%`, subtitle: 'Ventas sobre meta global', highlight: false },
          { title: 'Leads', value: formatNumber(totalLeads, 0), subtitle: 'Ejecutivo filtrado', highlight: false },
          ...(isMaster ? [{ title: 'Llamadas', value: formatNumber(totalLlamadas, 0), subtitle: `Meta ${periodMetaLabel}: ${formatNumber(monthlyGoal, 0)}`, highlight: false }] : []),
          { title: 'Cumplimiento Datos Actualizados', value: `${formatNumber(datosCompliance, 2)}%`, subtitle: `${formatNumber(currentDatos, 0)} de ${formatNumber(dataGoal, 0)} (${periodMetaLabel})`, highlight: false },
          { title: 'Cumplimiento Clientes Nuevos', value: `${formatNumber(clientesCompliance, 2)}%`, subtitle: `${formatNumber(currentClientes, 0)} de ${formatNumber(clientesGoal, 0)} (${periodMetaLabel})`, highlight: false },
        ],
        charts: [
          { key: 'lead-status', title: 'Leads por estatus', type: 'bar', data: leadsStatus, x: 'name', y: 'value', color: CHART_COLORS.secondary, multiColor: true, formatter: (v) => formatNumber(v, 0) },
          { key: 'lead-program', title: 'Leads por programa', type: 'bar', data: leadsByProgram, x: 'program', y: 'value', color: CHART_COLORS.accent, multiColor: true, formatter: (v) => formatNumber(v, 0) },
          { key: 'sold-program-money', title: 'Programa vendido y dinero generado (Q miles)', type: 'bar-group', data: soldProgramsMoney, x: 'program', y: 'ventas', y2: 'ventaMilesQ', color: CHART_COLORS.primary, color2: CHART_COLORS.secondary, formatter: (v) => formatNumber(v, 2), wide: true },
          ...(isMaster
            ? [{
                key: 'calls-goals',
                title: 'Llamadas vs metas',
                type: 'bar-group',
                data: [
                  { metric: 'Diaria', real: round2(totalLlamadas / Math.max(periodMonths.length * 20, 1)), meta: 80 },
                  { metric: 'Semanal', real: round2(totalLlamadas / Math.max(periodMonths.length * 4, 1)), meta: 400 },
                  {
                    metric: 'Mensual',
                    real: round2(totalLlamadas / Math.max(periodMonths.length, 1)),
                    meta: selectedSellers.reduce(
                      (acc, seller) => acc + (dataset.goals.ejecutivo.bySeller?.[seller]?.llamadasMonthly || 1600),
                      0,
                    ),
                  },
                ],
                x: 'metric',
                y: 'real',
                y2: 'meta',
                color: CHART_COLORS.primary,
                color2: CHART_COLORS.secondary,
                formatter: (v) => formatNumber(v, 0),
              }]
            : []),
          {
            key: 'compliance-separated',
            title: 'Cumplimiento separado por criterio',
            type: 'bar',
            data: [
              { name: 'Datos actualizados', value: datosCompliance },
              { name: 'Clientes nuevos', value: clientesCompliance },
            ],
            x: 'name',
            y: 'value',
            color: CHART_COLORS.secondary,
            multiColor: true,
            formatter: (v) => `${formatNumber(v, 2)}%`,
          },
          ...(isMaster
            ? [{
                key: 'ventas-facturado-backlog',
                title: 'Venta vs Facturado vs Backlog de facturacion',
                type: 'bar',
                data: ventasFacturadoBacklog,
                x: 'name',
                y: 'value',
                color: CHART_COLORS.primary,
                multiColor: true,
                formatter: formatCurrency,
              }]
            : []),
        ],
      }
    }

    const closedAmount = incompanyFiltered.propuestas
      .filter((row) => row.estatus === 'Cierre')
      .reduce((acc, row) => acc + row.totalFinalQ, 0)
    const billedAmount = incompanyFiltered.facturacion.reduce((acc, row) => acc + row.importe, 0)
    const pendingAmount = Math.max(closedAmount - billedAmount, 0)
    const citasTotal = incompanyFiltered.citas.length
    const citasGoal = (dataset.goals.incompany.citasMonthly || 60) * Math.max(periodMonths.length, 1)
    const salesGoalPeriodForSeller = (seller) =>
      periodMonths.reduce(
        (acc, month) => acc + (dataset.goals.incompany.salesMonthlyBySeller?.[seller]?.[month] || 0),
        0,
      )
    const salesGoalPeriod =
      effectiveSeller === 'todas'
        ? getAreaSellers('incompany').reduce((acc, seller) => acc + salesGoalPeriodForSeller(seller), 0)
        : salesGoalPeriodForSeller(effectiveSeller)
    const billingCompliance = salesGoalPeriod > 0 ? (billedAmount / salesGoalPeriod) * 100 : 0
    const proposalStatus = Array.from(
      incompanyFiltered.propuestas.reduce((map, row) => {
        map.set(row.estatus, (map.get(row.estatus) || 0) + 1)
        return map
      }, new Map()),
    ).map(([name, value]) => ({ name, value }))
    const citasMotivo = Array.from(
      incompanyFiltered.citas.reduce((map, row) => {
        map.set(row.motivo, (map.get(row.motivo) || 0) + 1)
        return map
      }, new Map()),
    ).map(([name, value]) => ({ name, value }))

    return {
      cards: [
        { title: 'Ventas', value: formatCurrency(closedAmount), subtitle: 'Cierres del periodo', highlight: true },
        ...(isMaster
          ? [
              { title: 'Facturado', value: formatCurrency(billedAmount), subtitle: 'Monto facturado', highlight: false },
              { title: 'Backlog', value: formatCurrency(pendingAmount), subtitle: 'Pendiente por facturar', highlight: false },
              { title: 'Cumplimiento Facturado/Meta', value: `${formatNumber(billingCompliance, 2)}%`, subtitle: 'Facturado sobre meta de ventas', highlight: false },
            ]
          : []),
      ],
      charts: [
        { key: 'proposal-status', title: 'Propuestas por estatus', type: 'bar', data: proposalStatus, x: 'name', y: 'value', color: CHART_COLORS.secondary, multiColor: true, formatter: (v) => formatNumber(v, 0) },
        {
          key: 'citas-meta',
          title: 'Citas realizadas vs meta',
          type: 'bar-group',
          data: [{ name: `Periodo ${periodMetaLabel}`, real: citasTotal, meta: citasGoal }],
          x: 'name',
          y: 'real',
          y2: 'meta',
          color: CHART_COLORS.accent,
          color2: CHART_COLORS.secondary,
          formatter: (v) => formatNumber(v, 0),
        },
        { key: 'citas', title: 'Citas por motivo', type: 'bar', data: citasMotivo, x: 'name', y: 'value', color: CHART_COLORS.primary, multiColor: true, formatter: (v) => formatNumber(v, 0) },
        ...(isMaster
          ? [{
              key: 'closed-billed-pending',
              title: 'Cerrado vs Facturado vs Backlog',
              type: 'bar',
              data: [
                { name: 'Cerrado', value: closedAmount },
                { name: 'Facturado', value: billedAmount },
                { name: 'Backlog', value: pendingAmount },
              ],
              x: 'name',
              y: 'value',
              color: CHART_COLORS.primary,
              multiColor: true,
              barColors: [CHART_COLORS.accent, CHART_COLORS.primary, CHART_COLORS.secondary],
              formatter: formatCurrency,
            }]
          : []),
      ],
    }
  }, [activeArea, dataset, effectiveSeller, ejecutivoFiltered, incompanyFiltered, isMaster, periodMetaLabel, periodMonths, superiorFiltered])

  const currentRows = useMemo(() => {
    if (activeArea === 'superior') {
      return superiorFiltered[activeCriterion] || []
    }
    if (activeArea === 'ejecutivo') {
      return ejecutivoFiltered[activeCriterion] || []
    }
    return incompanyFiltered[activeCriterion] || []
  }, [activeArea, activeCriterion, superiorFiltered, ejecutivoFiltered, incompanyFiltered])

  const selectedRecord = useMemo(() => {
    if (!recordViewer) {
      return null
    }
    const rows = dataset?.[recordViewer.area]?.[recordViewer.criterion] || []
    return rows.find((row) => row.id === recordViewer.id) || null
  }, [dataset, recordViewer])

  if (!auth) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <h1>Dashboard Comercial</h1>
          <p>Acceso por asesor y gerencia</p>
          <form className="login-form" onSubmit={handleLoginSubmit}>
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              value={loginInput.email}
              onChange={(event) => setLoginInput((prev) => ({ ...prev, email: event.target.value }))}
              autoComplete="email"
              required
            />
            <label htmlFor="password">Contrasena</label>
            <input
              id="password"
              type="password"
              value={loginInput.password}
              onChange={(event) => setLoginInput((prev) => ({ ...prev, password: event.target.value }))}
              autoComplete="current-password"
              required
            />
            <button type="submit" className="primary-btn">Ingresar</button>
            {loginError ? <p className="error-message">{loginError}</p> : null}
          </form>
          <small>
            Acceso por correo y contrasena con Supabase Auth
          </small>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="top-header">
        <div>
          <h1>Panel Comercial</h1>
          <p>{auth.role === 'master' ? 'Acceso gerencial total' : `Asesor: ${auth.seller}`}</p>
        </div>
        <div className="top-actions">
          <label>
            Mes
            <select value={activeMonth} onChange={(event) => setActiveMonth(event.target.value)}>
              {MONTHS.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </label>
          <label>
            Periodo
            <select value={periodType} onChange={(event) => setPeriodType(event.target.value)}>
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {isMaster ? (
            <label>
              Asesor
              <select
                value={effectiveSeller}
                onChange={(event) => updateSellerSelection(activeArea, event.target.value)}
              >
                <option value="todas">Todas</option>
                {sellerOptions.map((seller) => (
                  <option key={seller} value={seller}>{seller}</option>
                ))}
              </select>
            </label>
          ) : null}
          {activeArea === 'ejecutivo' ? (
            <label>
              Programa
              <select value={selectedExecutiveProgram} onChange={(event) => setSelectedExecutiveProgram(event.target.value)}>
                <option value="todos">Todos</option>
                {executivePrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="ghost-btn" onClick={() => setView('dashboard')}>Dashboard</button>
          {isMaster ? <button type="button" className="ghost-btn" onClick={() => setView('metas')}>Metas</button> : null}
          <button type="button" className="ghost-btn" onClick={() => setView('ingreso')}>Ingreso datos</button>
          <button type="button" className="danger-btn" onClick={handleLogout}>Cerrar sesion</button>
        </div>
      </header>

      {isMaster ? (
        <section className="area-switch">
          {Object.entries(AREA_CONFIG).map(([key, area]) => (
            <button
              key={key}
              type="button"
              className={`area-pill ${activeArea === key ? 'active' : ''}`}
              onClick={() => setActiveArea(key)}
              disabled={!canAccessArea(key)}
            >
              {area.label}
            </button>
          ))}
        </section>
      ) : null}

      <section className="goals-strip">
        {currentAreaGoals.map((goal) => (
          <article key={goal.label} className="goal-pill">
            <span>{goal.label}</span>
            <strong>{goal.value}</strong>
          </article>
        ))}
      </section>

      {view === 'dashboard' ? (
        <section className="dashboard-grid">
          {dashboardData.cards.map((card) => (
            <article key={card.title} className={`summary-card ${card.highlight ? 'highlight' : ''}`}>
              <h2>{card.title}</h2>
              <strong>{card.value}</strong>
              <span>{card.subtitle}</span>
            </article>
          ))}

          {dashboardData.charts.map((chart) => (
            <article
              key={chart.key}
              className={`chart-card ${chart.wide ? 'wide' : ''} ${chart.full ? 'full' : ''}`}
            >
              <h3>{chart.title}</h3>
              <ResponsiveContainer width="100%" height={260}>
                {chart.type === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={chart.data}
                      dataKey={chart.y}
                      nameKey={chart.x}
                      outerRadius={88}
                      label={chart.pieLabelNameOnly ? ({ payload }) => payload?.name || '' : true}
                    >
                      {chart.data.map((entry, index) => (
                        <Cell key={`${chart.key}-${entry[chart.x]}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => chart.formatter(value)} />
                  </PieChart>
                ) : chart.type === 'line' ? (
                  <LineChart data={chart.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={chart.x} />
                    <YAxis />
                    <Tooltip formatter={(value) => chart.formatter(value)} />
                    <Line type="monotone" dataKey={chart.y} stroke={chart.color || CHART_COLORS.primary} strokeWidth={3} />
                  </LineChart>
                ) : chart.type === 'hbar' ? (
                  <BarChart data={chart.data} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey={chart.x} width={120} />
                    <Tooltip formatter={(value) => chart.formatter(value)} />
                    <Bar dataKey={chart.y} fill={chart.color || CHART_COLORS.secondary} />
                  </BarChart>
                ) : chart.type === 'bar-group' ? (
                  <BarChart data={chart.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={chart.x} />
                    <YAxis />
                    <Tooltip formatter={(value) => chart.formatter(value)} />
                    <Legend />
                    <Bar dataKey={chart.y} fill={chart.color || CHART_COLORS.primary} />
                    <Bar dataKey={chart.y2} fill={chart.color2 || CHART_COLORS.secondary} />
                  </BarChart>
                ) : (
                  <BarChart data={chart.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={chart.x} />
                    <YAxis />
                    <Tooltip formatter={(value) => chart.formatter(value)} />
                    <Bar dataKey={chart.y} fill={chart.color || CHART_COLORS.primary}>
                      {chart.multiColor
                        ? chart.data.map((entry, index) => (
                            <Cell
                              key={`${chart.key}-bar-${entry[chart.x]}-${index}`}
                              fill={chart.barColors?.[index] || COLORS[index % COLORS.length]}
                            />
                          ))
                        : null}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </article>
          ))}
        </section>
      ) : (
        <section className="ingreso-grid">
          {view === 'metas' ? (
            <article className="panel-card full section-block">
              <h2>Metas gerenciales por area</h2>
              {!isMaster ? (
                <p>Solo gerencia puede editar metas. Esta vista muestra las metas configuradas.</p>
              ) : null}

              {activeArea === 'superior' ? (
                <>
                  <div className="csv-actions">
                    <label>
                      Asesor para metas
                      <select
                        value={goalSellerByArea.superior}
                        onChange={(event) => updateGoalSeller('superior', event.target.value)}
                        disabled={!isMaster}
                      >
                        {getAreaSellers('superior').map((seller) => (
                          <option key={seller} value={seller}>{seller}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <form className="manual-form form-5">
                  <label>
                    Ventas mensuales
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={dataset.goals.superior.bySeller?.[goalSellerByArea.superior]?.ventasMonthly || 0}
                      onChange={(event) => updateAreaGoalBySeller('superior', goalSellerByArea.superior, 'ventasMonthly', event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                  <label>
                    Contactabilidad mensual
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dataset.goals.superior.bySeller?.[goalSellerByArea.superior]?.contactabilidadMonthly || 0}
                      onChange={(event) => updateAreaGoalBySeller('superior', goalSellerByArea.superior, 'contactabilidadMonthly', event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                  <label>
                    Alianzas mensuales
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dataset.goals.superior.bySeller?.[goalSellerByArea.superior]?.alianzasMonthly || 0}
                      onChange={(event) => updateAreaGoalBySeller('superior', goalSellerByArea.superior, 'alianzasMonthly', event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                  <label>
                    Citas mensuales
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dataset.goals.superior.bySeller?.[goalSellerByArea.superior]?.citasMonthly || 0}
                      onChange={(event) => updateAreaGoalBySeller('superior', goalSellerByArea.superior, 'citasMonthly', event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                  </form>
                </>
              ) : null}

              {activeArea === 'ejecutivo' ? (
              <>
                <div className="csv-actions">
                  <label>
                    Asesor para metas
                    <select
                      value={goalSellerByArea.ejecutivo}
                      onChange={(event) => updateGoalSeller('ejecutivo', event.target.value)}
                      disabled={!isMaster}
                    >
                      {getAreaSellers('ejecutivo').map((seller) => (
                        <option key={seller} value={seller}>{seller}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <form className="manual-form form-5">
                  <label>
                    Llamadas mensuales
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dataset.goals.ejecutivo.bySeller?.[goalSellerByArea.ejecutivo]?.llamadasMonthly || 0}
                      onChange={(event) => updateAreaGoalBySeller('ejecutivo', goalSellerByArea.ejecutivo, 'llamadasMonthly', event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                  <label>
                    Datos actualizados mensuales
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dataset.goals.ejecutivo.bySeller?.[goalSellerByArea.ejecutivo]?.datosActualizadosMonthly || 0}
                      onChange={(event) => updateAreaGoalBySeller('ejecutivo', goalSellerByArea.ejecutivo, 'datosActualizadosMonthly', event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                  <label>
                    Clientes nuevos mensuales
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dataset.goals.ejecutivo.bySeller?.[goalSellerByArea.ejecutivo]?.clientesNuevosMonthly || 0}
                      onChange={(event) => updateAreaGoalBySeller('ejecutivo', goalSellerByArea.ejecutivo, 'clientesNuevosMonthly', event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                </form>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Meta global ventas Ejecutivo ({goalSellerByArea.ejecutivo})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((month) => (
                        <tr key={month}>
                          <td>{month}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={dataset.goals.ejecutivo.salesMonthlyBySeller?.[goalSellerByArea.ejecutivo]?.[month] || 0}
                              onChange={(event) => updateExecutiveGoalMonthly(month, event.target.value)}
                              disabled={!isMaster}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
              ) : null}

              {activeArea === 'incompany' ? (
              <>
                <div className="csv-actions">
                  <label>
                    Vendedor de meta
                    <select value={goalSellerByArea.incompany} onChange={(event) => updateGoalSeller('incompany', event.target.value)} disabled={!isMaster}>
                      {getAreaSellers('incompany').map((seller) => (
                        <option key={seller} value={seller}>{seller}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Meta anual ventas
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={dataset.goals.incompany.salesAnnualBySeller?.[goalSellerByArea.incompany] || 0}
                      onChange={(event) => updateIncompanyGoalAnnual(goalSellerByArea.incompany, event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                  <label>
                    Meta citas mensuales
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dataset.goals.incompany.citasMonthly}
                      onChange={(event) => updateAreaGoal('incompany', 'citasMonthly', event.target.value)}
                      disabled={!isMaster}
                    />
                  </label>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Meta ventas {goalSellerByArea.incompany}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((month) => (
                        <tr key={month}>
                          <td>{month}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={dataset.goals.incompany.salesMonthlyBySeller?.[goalSellerByArea.incompany]?.[month] || 0}
                              onChange={(event) => updateIncompanyGoalMonthly(goalSellerByArea.incompany, month, event.target.value)}
                              disabled={!isMaster}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
              ) : null}
            </article>
          ) : null}

          {view === 'ingreso' ? (
            <>
              <article className="panel-card full">
                <h2>Configuracion de criterio</h2>
                <div className="csv-actions">
                  <label>
                    Area activa
                    <strong>{AREA_CONFIG[activeArea].label}</strong>
                  </label>
                  <label>
                    Criterio
                    <select
                      value={activeCriterion}
                      onChange={(event) => updateCriterion(activeArea, event.target.value)}
                    >
                      {visibleCriteria.map((criterion) => (
                        <option key={criterion} value={criterion}>
                          {CRITERIA_LABELS[criterion]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>

              {activeArea === 'ejecutivo' ? (
            <article className="panel-card full section-block">
              <h2>Programas y metas (gerencia)</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Programa</th>
                      <th>Ciclo</th>
                      <th>Meta Q</th>
                      {isMaster ? <th>Acciones</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.ejecutivo.programCatalog.map((program) => (
                      <tr key={program.id}>
                        <td>{program.name}</td>
                        <td>{program.cycle}</td>
                        <td>{formatCurrency(program.goalQ)}</td>
                        {isMaster ? (
                          <td>
                            <button type="button" className="ghost-btn" onClick={() => editProgramConfig(program)}>Editar</button>
                            <button type="button" className="danger-btn" onClick={() => deactivateProgram(program.id)}>Desactivar</button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isMaster ? (
                <form className="manual-form form-5" onSubmit={addProgramConfig}>
                  <label>
                    Nombre programa
                    <input
                      value={forms.ejecutivo.programConfig.name}
                      onChange={(event) => updateForm('ejecutivo', 'programConfig', 'name', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Ciclo
                    <select
                      value={forms.ejecutivo.programConfig.cycle}
                      onChange={(event) => updateForm('ejecutivo', 'programConfig', 'cycle', event.target.value)}
                    >
                      <option value="enero">Enero</option>
                      <option value="febrero">Febrero</option>
                      <option value="marzo">Marzo</option>
                      <option value="abril">Abril</option>
                      <option value="mayo">Mayo</option>
                      <option value="junio">Junio</option>
                      <option value="julio">Julio</option>
                      <option value="agosto">Agosto</option>
                      <option value="septiembre">Septiembre</option>
                      <option value="octubre">Octubre</option>
                      <option value="noviembre">Noviembre</option>
                      <option value="diciembre">Diciembre</option>
                      <option value="anual">Anual</option>
                    </select>
                  </label>
                  <label>
                    Meta Q
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={forms.ejecutivo.programConfig.goalQ}
                      onChange={(event) => updateForm('ejecutivo', 'programConfig', 'goalQ', event.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" className="primary-btn">Agregar programa</button>
                </form>
              ) : (
                <p>Las metas por programa son visibles para asesores pero solo editables por gerencia.</p>
              )}
            </article>
              ) : null}

              <article className="panel-card full section-block">
            <h2>{AREA_CONFIG[activeArea].label} - {CRITERIA_LABELS[activeCriterion]}</h2>

            <form className="manual-form form-7" onSubmit={submitCurrentCriterion}>
              <label>
                Mes
                <select
                  value={forms[activeArea][activeCriterion].month || 'enero'}
                  onChange={(event) => updateForm(activeArea, activeCriterion, 'month', event.target.value)}
                >
                  {MONTHS.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </label>
              <label>
                Asesor
                <select
                  value={forms[activeArea][activeCriterion].seller || (isMaster ? '' : auth.seller)}
                  onChange={(event) => updateForm(activeArea, activeCriterion, 'seller', event.target.value)}
                  disabled={!isMaster}
                >
                  <option value="">Seleccionar</option>
                  {getAreaSellers(activeArea).map((seller) => (
                    <option key={seller} value={seller}>{seller}</option>
                  ))}
                </select>
              </label>

              {renderCriterionFields({
                area: activeArea,
                criterion: activeCriterion,
                forms,
                dataset,
                updateForm,
                isMaster,
              })}

              <button
                type="submit"
                className="primary-btn"
                disabled={!canAccessArea(activeArea) || (!isMaster && isManagerialCriterion(activeArea, activeCriterion))}
              >
                Guardar registro
              </button>
            </form>

            <DataTable
              area={activeArea}
              criterion={activeCriterion}
              rows={currentRows}
              onDelete={deleteRecord}
              onView={openRecordViewer}
              canView={true}
              canDelete={isMaster}
            />

              </article>
            </>
          ) : null}
        </section>
      )}
      {recordViewer ? (
        <div className="modal-backdrop" role="presentation" onClick={closeRecordViewer}>
          <article className="record-viewer modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>Ver/Editar registro</h3>
            {selectedRecord ? (
              <>
                <div className="record-meta">
                  <span>ID: {selectedRecord.id}</span>
                  <span>Asesor: {selectedRecord.seller}</span>
                  <span>Ultima actualizacion: {selectedRecord.updatedAt || 'N/A'}</span>
                </div>

                <div className="record-edit-grid">
                  {getColumns(recordViewer.area, recordViewer.criterion).map((column) => {
                    const key = column.key
                    const disabled = !canEditRecord(recordViewer.area, recordViewer.criterion, selectedRecord)
                    const isNumber = typeof selectedRecord?.[key] === 'number'
                    const options =
                      key === 'estado'
                        ? SUPERIOR_LEAD_STATUS
                        : key === 'estatus' && recordViewer.area === 'ejecutivo'
                          ? EXEC_STATUS
                          : key === 'estatus' && recordViewer.area === 'incompany'
                            ? INC_PROPOSAL_STATUS
                            : key === 'motivo'
                              ? INC_MOTIVOS
                              : null
                    if (options) {
                      return (
                        <label key={key}>
                          {column.label}
                          <select value={recordDraft?.[key] ?? ''} onChange={(event) => updateRecordDraft(key, event.target.value)} disabled={disabled}>
                            {options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </label>
                      )
                    }
                    return (
                      <label key={key}>
                        {column.label}
                        <input
                          type={isNumber ? 'number' : 'text'}
                          min={isNumber ? '0' : undefined}
                          step={isNumber ? '0.01' : undefined}
                          value={recordDraft?.[key] ?? ''}
                          onChange={(event) => updateRecordDraft(key, event.target.value)}
                          disabled={disabled}
                        />
                      </label>
                    )
                  })}
                </div>

                <div className="record-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={saveRecordChanges}
                    disabled={!canEditRecord(recordViewer.area, recordViewer.criterion, selectedRecord)}
                  >
                    Guardar cambios
                  </button>
                  <button type="button" className="ghost-btn" onClick={closeRecordViewer}>
                    Cerrar
                  </button>
                </div>

                <h4>Historico de cambios</h4>
                <div className="history-list">
                  {(selectedRecord.changeHistory || []).length === 0 ? (
                    <p>Sin cambios registrados.</p>
                  ) : (
                    (selectedRecord.changeHistory || [])
                      .slice()
                      .reverse()
                      .map((item) => (
                        <div key={item.id} className="history-item">
                          <strong>{item.action}</strong>
                          <span>{item.by} - {item.at}</span>
                          <ul>
                            {item.changes.map((change) => (
                              <li key={change}>{change}</li>
                            ))}
                          </ul>
                        </div>
                      ))
                  )}
                </div>
              </>
            ) : (
              <p>El registro ya no existe o fue eliminado.</p>
            )}
          </article>
        </div>
      ) : null}
      {flashMessage ? <div className="toast-bubble">{flashMessage}</div> : null}
    </main>
  )
}

function renderCriterionFields({ area, criterion, forms, dataset, updateForm, isMaster }) {
  const current = forms[area][criterion]

  if (area === 'superior' && criterion === 'leads') {
    return (
      <>
        <label>Nombre<input value={current.nombre} onChange={(event) => updateForm(area, criterion, 'nombre', event.target.value)} /></label>
        <label>Carrera interes<input value={current.carrera} onChange={(event) => updateForm(area, criterion, 'carrera', event.target.value)} /></label>
        <label>
          Estado
          <select value={current.estado} onChange={(event) => updateForm(area, criterion, 'estado', event.target.value)}>
            {SUPERIOR_LEAD_STATUS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>Total venta Q<input type="number" min="0" step="0.01" value={current.ventaQ} onChange={(event) => updateForm(area, criterion, 'ventaQ', event.target.value)} /></label>
      </>
    )
  }
  if (area === 'superior' && criterion === 'alianzas') {
    return (
      <>
        <label>Empresa<input value={current.empresa} onChange={(event) => updateForm(area, criterion, 'empresa', event.target.value)} /></label>
        <label>
          Estatus
          <select value={current.estatus} onChange={(event) => updateForm(area, criterion, 'estatus', event.target.value)}>
            {SUPERIOR_ALIANZA_STATUS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>Fecha escritorio<input type="date" value={current.fechaEscritorio} onChange={(event) => updateForm(area, criterion, 'fechaEscritorio', event.target.value)} /></label>
      </>
    )
  }
  if (area === 'superior' && criterion === 'contactabilidad') {
    return <label>Contactados<input type="number" min="0" step="1" value={current.contactados} onChange={(event) => updateForm(area, criterion, 'contactados', event.target.value)} /></label>
  }
  if (area === 'superior' && (criterion === 'metas' || criterion === 'cumplimiento')) {
    return (
      <>
        {PROGRAM_KEYS.map((key) => (
          <label key={key}>
            {key.toUpperCase()}
            <input type="number" min="0" step="0.01" value={current[key]} onChange={(event) => updateForm(area, criterion, key, event.target.value)} />
          </label>
        ))}
        <label>Total<input type="number" min="0" step="0.01" value={current.total} onChange={(event) => updateForm(area, criterion, 'total', event.target.value)} /></label>
      </>
    )
  }
  if (area === 'superior' && criterion === 'resumen') {
    return (
      <>
        <label>Propuestas<input type="number" min="0" step="1" value={current.propuestas} onChange={(event) => updateForm(area, criterion, 'propuestas', event.target.value)} /></label>
        <label>Alianzas<input type="number" min="0" step="1" value={current.alianzasTrabajadas} onChange={(event) => updateForm(area, criterion, 'alianzasTrabajadas', event.target.value)} /></label>
        <label>Citas<input type="number" min="0" step="1" value={current.citas} onChange={(event) => updateForm(area, criterion, 'citas', event.target.value)} /></label>
        <label>Contactabilidad<input type="number" min="0" step="1" value={current.contactabilidad} onChange={(event) => updateForm(area, criterion, 'contactabilidad', event.target.value)} /></label>
        <label>Venta<input type="number" min="0" step="0.01" value={current.venta} onChange={(event) => updateForm(area, criterion, 'venta', event.target.value)} /></label>
      </>
    )
  }

  if (area === 'ejecutivo' && criterion === 'leads') {
    return (
      <>
        <label>Empresa<input value={current.empresa} onChange={(event) => updateForm(area, criterion, 'empresa', event.target.value)} /></label>
        <label>Cliente<input value={current.cliente} onChange={(event) => updateForm(area, criterion, 'cliente', event.target.value)} /></label>
        <label>
          Programa interes
          <select value={current.programId} onChange={(event) => updateForm(area, criterion, 'programId', event.target.value)}>
            <option value="">Seleccionar</option>
            {dataset.ejecutivo.programCatalog.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name} ({program.cycle}) - Meta {formatCurrency(program.goalQ)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estatus
          <select value={current.estatus} onChange={(event) => updateForm(area, criterion, 'estatus', event.target.value)}>
            {EXEC_STATUS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Venta Q
          <input
            type="number"
            min="0"
            step="0.01"
            value={current.ventaQ}
            onChange={(event) => updateForm(area, criterion, 'ventaQ', event.target.value)}
            disabled={current.estatus !== 'Venta'}
          />
        </label>
      </>
    )
  }
  if (area === 'ejecutivo' && criterion === 'llamadas') {
    const monthlyGoal = dataset.goals?.ejecutivo?.llamadasMonthly || 1600
    return (
      <>
        <label>Llamadas<input type="number" min="0" step="1" value={current.totalLlamadas} onChange={(event) => updateForm(area, criterion, 'totalLlamadas', event.target.value)} /></label>
        <label>Meta diaria<input value="80" disabled /></label>
        <label>Meta semanal<input value="400" disabled /></label>
        <label>Meta mensual<input value={monthlyGoal} disabled /></label>
      </>
    )
  }
  if (area === 'ejecutivo' && (criterion === 'datosActualizados' || criterion === 'clientesNuevos')) {
    return (
      <>
        <label>Empresa<input value={current.empresa} onChange={(event) => updateForm(area, criterion, 'empresa', event.target.value)} /></label>
        <label>Nombre<input value={current.nombre} onChange={(event) => updateForm(area, criterion, 'nombre', event.target.value)} /></label>
        <label>Cargo<input value={current.cargo} onChange={(event) => updateForm(area, criterion, 'cargo', event.target.value)} /></label>
        <label>Telefono<input value={current.telefono} onChange={(event) => updateForm(area, criterion, 'telefono', event.target.value)} /></label>
        <label>Correo<input type="email" value={current.correo} onChange={(event) => updateForm(area, criterion, 'correo', event.target.value)} /></label>
      </>
    )
  }
  if (area === 'ejecutivo' && criterion === 'facturacion') {
    return (
      <>
        {!isMaster ? <label>Facturacion<input value="Solo gerencia puede editar este criterio" disabled /></label> : null}
        <label>Fecha<input type="date" value={current.fecha} onChange={(event) => updateForm(area, criterion, 'fecha', event.target.value)} disabled={!isMaster} /></label>
        <label>Empresa<input value={current.empresa} onChange={(event) => updateForm(area, criterion, 'empresa', event.target.value)} disabled={!isMaster} /></label>
        <label>Tipo curso<input value={current.tipoCurso} onChange={(event) => updateForm(area, criterion, 'tipoCurso', event.target.value)} disabled={!isMaster} /></label>
        <label>Nombre curso<input value={current.nombreCurso} onChange={(event) => updateForm(area, criterion, 'nombreCurso', event.target.value)} disabled={!isMaster} /></label>
        <label>Importe<input type="number" min="0" step="0.01" value={current.importe} onChange={(event) => updateForm(area, criterion, 'importe', event.target.value)} disabled={!isMaster} /></label>
      </>
    )
  }

  if (area === 'incompany' && criterion === 'propuestas') {
    return (
      <>
        <label>Fecha<input type="date" value={current.fecha} onChange={(event) => updateForm(area, criterion, 'fecha', event.target.value)} /></label>
        <label>Empresa<input value={current.empresa} onChange={(event) => updateForm(area, criterion, 'empresa', event.target.value)} /></label>
        <label>Tipologia curso<input value={current.tipologiaCurso} onChange={(event) => updateForm(area, criterion, 'tipologiaCurso', event.target.value)} /></label>
        <label>Nombre curso<input value={current.nombreCurso} onChange={(event) => updateForm(area, criterion, 'nombreCurso', event.target.value)} /></label>
        <label>Inversion<input type="number" min="0" step="0.01" value={current.inversion} onChange={(event) => updateForm(area, criterion, 'inversion', event.target.value)} /></label>
        <label>
          Estatus
          <select value={current.estatus} onChange={(event) => updateForm(area, criterion, 'estatus', event.target.value)}>
            {INC_PROPOSAL_STATUS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>Total final Q<input type="number" min="0" step="0.01" value={current.totalFinalQ} onChange={(event) => updateForm(area, criterion, 'totalFinalQ', event.target.value)} disabled={current.estatus !== 'Cierre'} /></label>
      </>
    )
  }
  if (area === 'incompany' && criterion === 'citas') {
    return (
      <>
        <label>Fecha<input type="date" value={current.fecha} onChange={(event) => updateForm(area, criterion, 'fecha', event.target.value)} /></label>
        <label>Empresa<input value={current.empresa} onChange={(event) => updateForm(area, criterion, 'empresa', event.target.value)} /></label>
        <label>Contacto<input value={current.contacto} onChange={(event) => updateForm(area, criterion, 'contacto', event.target.value)} /></label>
        <label>
          Motivo
          <select value={current.motivo} onChange={(event) => updateForm(area, criterion, 'motivo', event.target.value)}>
            {INC_MOTIVOS.map((motivo) => (
              <option key={motivo} value={motivo}>{motivo}</option>
            ))}
          </select>
        </label>
      </>
    )
  }
  if (area === 'incompany' && criterion === 'facturacion') {
    return (
      <>
        {!isMaster ? <label>Facturacion<input value="Solo gerencia puede editar este criterio" disabled /></label> : null}
        <label>Fecha<input type="date" value={current.fecha} onChange={(event) => updateForm(area, criterion, 'fecha', event.target.value)} disabled={!isMaster} /></label>
        <label>Empresa<input value={current.empresa} onChange={(event) => updateForm(area, criterion, 'empresa', event.target.value)} disabled={!isMaster} /></label>
        <label>Tipo curso<input value={current.tipoCurso} onChange={(event) => updateForm(area, criterion, 'tipoCurso', event.target.value)} disabled={!isMaster} /></label>
        <label>Nombre curso<input value={current.nombreCurso} onChange={(event) => updateForm(area, criterion, 'nombreCurso', event.target.value)} disabled={!isMaster} /></label>
        <label>Importe<input type="number" min="0" step="0.01" value={current.importe} onChange={(event) => updateForm(area, criterion, 'importe', event.target.value)} disabled={!isMaster} /></label>
      </>
    )
  }
  return null
}

function DataTable({ area, criterion, rows, onDelete, onView, canDelete, canView }) {
  const columns = getColumns(area, criterion)
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1}>No hay registros para el filtro activo.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.format ? column.format(row[column.key], row) : row[column.key]}
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => onView(area, criterion, row)}
                    disabled={!canView}
                  >
                    Ver/Editar
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => onDelete(area, criterion, row.id)}
                    disabled={!canDelete}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function getColumns(area, criterion) {
  if (area === 'superior' && criterion === 'leads') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'carrera', label: 'Carrera' },
      { key: 'estado', label: 'Estado' },
      { key: 'ventaQ', label: 'Venta', format: (value) => formatCurrency(value) },
    ]
  }
  if (area === 'superior' && criterion === 'alianzas') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'empresa', label: 'Empresa' },
      { key: 'estatus', label: 'Estatus' },
      { key: 'fechaEscritorio', label: 'Fecha' },
    ]
  }
  if (area === 'superior' && criterion === 'contactabilidad') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'contactados', label: 'Contactados', format: (value) => formatNumber(value, 0) },
    ]
  }
  if (area === 'superior' && (criterion === 'metas' || criterion === 'cumplimiento')) {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      ...PROGRAM_KEYS.map((key) => ({ key, label: key.toUpperCase(), format: (value) => formatCurrency(value) })),
      { key: 'total', label: 'Total', format: (value) => formatCurrency(value) },
    ]
  }
  if (area === 'superior' && criterion === 'resumen') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'propuestas', label: 'Propuestas', format: (value) => formatNumber(value, 0) },
      { key: 'alianzasTrabajadas', label: 'Alianzas', format: (value) => formatNumber(value, 0) },
      { key: 'citas', label: 'Citas', format: (value) => formatNumber(value, 0) },
      { key: 'contactabilidad', label: 'Contactabilidad', format: (value) => formatNumber(value, 0) },
      { key: 'venta', label: 'Venta', format: (value) => formatCurrency(value) },
    ]
  }
  if (area === 'ejecutivo' && criterion === 'leads') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'empresa', label: 'Empresa' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'programName', label: 'Programa' },
      { key: 'estatus', label: 'Estatus' },
      { key: 'ventaQ', label: 'Venta', format: (value) => formatCurrency(value) },
    ]
  }
  if (area === 'ejecutivo' && criterion === 'llamadas') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'totalLlamadas', label: 'Llamadas', format: (value) => formatNumber(value, 0) },
    ]
  }
  if (area === 'ejecutivo' && (criterion === 'datosActualizados' || criterion === 'clientesNuevos')) {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'empresa', label: 'Empresa' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'cargo', label: 'Cargo' },
      { key: 'telefono', label: 'Telefono' },
      { key: 'correo', label: 'Correo' },
    ]
  }
  if (area === 'ejecutivo' && criterion === 'facturacion') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'empresa', label: 'Empresa' },
      { key: 'tipoCurso', label: 'Tipo curso' },
      { key: 'nombreCurso', label: 'Curso' },
      { key: 'importe', label: 'Importe', format: (value) => formatCurrency(value) },
    ]
  }
  if (area === 'incompany' && criterion === 'propuestas') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'empresa', label: 'Empresa' },
      { key: 'tipologiaCurso', label: 'Tipologia' },
      { key: 'nombreCurso', label: 'Curso' },
      { key: 'estatus', label: 'Estatus' },
      { key: 'inversion', label: 'Inversion', format: (value) => formatCurrency(value) },
      { key: 'totalFinalQ', label: 'Total final', format: (value) => formatCurrency(value) },
    ]
  }
  if (area === 'incompany' && criterion === 'citas') {
    return [
      { key: 'month', label: 'Mes' },
      { key: 'seller', label: 'Asesor' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'empresa', label: 'Empresa' },
      { key: 'contacto', label: 'Contacto' },
      { key: 'motivo', label: 'Motivo' },
    ]
  }
  return [
    { key: 'month', label: 'Mes' },
    { key: 'seller', label: 'Asesor' },
    { key: 'fecha', label: 'Fecha' },
    { key: 'empresa', label: 'Empresa' },
    { key: 'tipoCurso', label: 'Tipo curso' },
    { key: 'nombreCurso', label: 'Curso' },
    { key: 'importe', label: 'Importe', format: (value) => formatCurrency(value) },
  ]
}
export default App
