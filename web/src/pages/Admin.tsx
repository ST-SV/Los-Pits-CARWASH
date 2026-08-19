import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'

type SubTab = 'historial' | 'contabilidad' | 'empleados' | 'horarios' | 'catalogo' | 'auditoria' | 'config'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

interface Cierre {
  id: string
  fecha: string
  createdAt: string
  totalVentas: number
  totalGastos: number
  neto: number
}

interface Historial {
  week: { sales: number; net: number }
  fortnight: { sales: number; net: number }
  month: { sales: number; net: number }
  cierres: Cierre[]
}

interface VentaItemDetalle {
  id: string
  nombre: string
  precio: number
  cantidad: number
}

interface VentaDetalle {
  id: string
  numeroRecibo: string
  fecha: string
  total: number
  metodoPago: string
  anulada: boolean
  anuladaPor?: string | null
  anuladaMotivo?: string | null
  items: VentaItemDetalle[]
}

interface GastoDetalle {
  id: string
  descripcion: string
  monto: number
  registradoPor?: string | null
}

interface CierreDetalle {
  cierre: Cierre & { cerradoPor: string } | null
  ventas: VentaDetalle[]
  gastos: GastoDetalle[]
}

interface DescuentoItem {
  id: string
  monto: number
  motivo: string
}

interface PlanillaPeriodo {
  periodo: 'Q1' | 'Q2' | 'M'
  periodoKey: string
  label: string
  sueldoBase: number
  autosLavados: number
  ventasAtribuidas: number
  comision: number
  descuentos: DescuentoItem[]
  totalDescuentos: number
  totalPagar: number
  estado: 'pagado' | 'pendiente'
  nominaPagoId: string | null
  montoPagado: number | null
  fechaPago: string | null
}

interface PlanillaEmpleado {
  id: string
  nombre: string
  apellido?: string | null
  role: string
  sueldoQuincenal?: number | null
  sueldoMensual?: number | null
  comisionPercent?: number | null
  comisionThreshold?: number | null
  periodos: PlanillaPeriodo[]
}

interface Planilla {
  mes: string
  hoy: { ventas: number; gastos: number; neto: number }
  resumenMensual: {
    ingresos: number
    gastosOperativos: number
    gastosFijos: number
    gastosFijosPagados: number
    gastosFijosPendientes: number
    nominaYaRegistrada: number
    planillaCalculada: number
    balance: number
    flujoCaja: number
  }
  quincenas: { nombre: string; ingresos: number; gastosOperativos: number; gastosFijosPagados: number; planilla: number; balance: number }[]
  empleados: PlanillaEmpleado[]
  totalPlanilla: number
  gastosFijosDetalle: { id: string; descripcion: string; monto: number; pagadoEsteMes: number; estado: 'pagado' | 'pendiente'; ultimoPago: string | null }[]
  stats: {
    ticketPromedio: number
    autosLavadosMes: number
    ventasPorMetodo: Record<string, number>
    topLavador: { nombre: string; ventas: number } | null
    ventasQ1: number
    ventasQ2: number
  }
}

interface GastoFijo {
  id: string
  descripcion: string
  monto: number
  activo: boolean
}

interface PeriodoDetalle {
  label: string
  ingresos: number
  gastosOperativos: number
  nomina: number
  neto: number
  ventasCount: number
  porMetodo: Record<string, number>
  servicios: { nombre: string; cantidad: number; monto: number }[]
  productos: { nombre: string; cantidad: number; monto: number }[]
  gastosDetalle: { id: string; descripcion: string; monto: number; categoria: string; registradoPor?: string | null }[]
}

interface AutosDetalle {
  totalAutos: number
  promedioPorDia: number
  servicios: { nombre: string; cantidad: number; monto: number }[]
  productos: { nombre: string; cantidad: number; monto: number }[]
  eventos: { fecha: string; servicio: string; socio: string | null; lavadores: string[]; total: number }[]
}

interface LavadorDetalle {
  id: string
  nombre: string
  autosSolo: number
  autosCompartido: number
  autosTotal: number
  ventasAtribuidas: number
  comisionTotal: number
  servicios: { nombre: string; cantidad: number }[]
  meta: number | null
  comisionPercent: number
  comisionThreshold: number
}

interface Empleado {
  id: string
  nombre: string
  apellido?: string | null
  role: string
  dui?: string | null
  tipoDocumento?: string | null
  numeroDocumento?: string | null
  email?: string | null
  telefono?: string | null
  emergName?: string | null
  emergPhone?: string | null
  horario?: string | null
  sueldoQuincenal?: number | null
  sueldoMensual?: number | null
  comisionPercent?: number | null
  comisionThreshold?: number | null
}

interface CatalogoItem {
  id: string
  nombre: string
  precio: number
  categoria?: string
  stock?: number | null
  vendidos?: number
  montoVendido?: number
}

const CATEGORIAS_PRODUCTO = ['Bebidas Frías', 'Bebidas Calientes', 'Snacks', 'Otros']
const CATEGORIAS_SERVICIO = ['SEDÁN', 'CAMIONETA PEQUEÑA', 'CAMIONETA MEDIANA', 'CAMIONETA GRANDE', 'PICK UP', 'PICK UP XL', 'General']

interface Catalogo {
  servicios: CatalogoItem[]
  productos: CatalogoItem[]
}

interface AuditEntry {
  id: string
  actor: string
  accion: string
  detalle?: string | null
  fecha: string
}

interface HorarioDia {
  id: string
  diaSemana: number
  abierto: boolean
  horaApertura?: string | null
  horaCierre?: string | null
}

interface Turno {
  id: string
  empleadoId: string
  diaSemana: number
  horaInicio: string
  horaFin: string
  empleado: { id: string; nombre: string; apellido?: string | null; role: string }
}

interface HorariosData {
  horarioNegocio: HorarioDia[]
  turnos: Turno[]
  empleados: { id: string; nombre: string; apellido?: string | null; role: string }[]
}

export default function Admin() {
  const { toast } = useApp()
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [tab, setTab] = useState<SubTab>('historial')

  const [historial, setHistorial] = useState<Historial | null>(null)
  const [cierreDetalle, setCierreDetalle] = useState<CierreDetalle | null>(null)
  const [cierreDetalleLoading, setCierreDetalleLoading] = useState(false)
  const [cierreFiltro, setCierreFiltro] = useState<'todos' | 'dia' | 'semana' | 'quincena' | 'mes' | 'fecha'>('todos')
  const [cierreFechaBusqueda, setCierreFechaBusqueda] = useState('')
  const [planilla, setPlanilla] = useState<Planilla | null>(null)
  const [mesPlanilla, setMesPlanilla] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [descuentoForm, setDescuentoForm] = useState<{ empleadoId: string; empleadoNombre: string; periodoKey: string; periodoLabel: string; monto: string; motivo: string } | null>(null)
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
  const [gastoFijoForm, setGastoFijoForm] = useState<{ id?: string; descripcion: string; monto: string } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [showPeriodoModal, setShowPeriodoModal] = useState(false)
  const [periodoDetalle, setPeriodoDetalle] = useState<PeriodoDetalle | null>(null)
  const [periodoDetalleLoading, setPeriodoDetalleLoading] = useState(false)
  const [showAutosModal, setShowAutosModal] = useState(false)
  const [autosDetalle, setAutosDetalle] = useState<AutosDetalle | null>(null)
  const [autosDetalleLoading, setAutosDetalleLoading] = useState(false)
  const [showLavadoresModal, setShowLavadoresModal] = useState(false)
  const [lavadoresDetalle, setLavadoresDetalle] = useState<LavadorDetalle[] | null>(null)
  const [lavadoresDetalleLoading, setLavadoresDetalleLoading] = useState(false)
  const [metaEdit, setMetaEdit] = useState<{ id: string; value: string } | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [auditoria, setAuditoria] = useState<AuditEntry[] | null>(null)
  const [horariosData, setHorariosData] = useState<HorariosData | null>(null)
  const [horarioNegocioForm, setHorarioNegocioForm] = useState<HorarioDia[]>([])
  const [turnoForm, setTurnoForm] = useState<{ empleadoId: string; diaSemana: number; horaInicio: string; horaFin: string } | null>(null)

  const [empForm, setEmpForm] = useState<Partial<Empleado> & { pin?: string }>({})
  const [showEmpForm, setShowEmpForm] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Empleado | null>(null)

  const [catForm, setCatForm] = useState<{ tipo: 'servicio' | 'producto'; nombre: string; precio: string; categoria: string; stock: string; id?: string } | null>(null)

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const openCierreDetalle = async (id: string) => {
    setCierreDetalleLoading(true)
    setCierreDetalle(null)
    setEditCierre(null)
    setDeleteCierreMotivo(null)
    try {
      const res = await fetch(`/api/admin/cierre/${id}?adminPin=${encodeURIComponent(adminPin)}`)
      if (!res.ok) throw new Error('Error al cargar el detalle')
      const data = await res.json()
      setCierreDetalle(data)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al cargar el detalle')
    } finally {
      setCierreDetalleLoading(false)
    }
  }

  const [editCierre, setEditCierre] = useState<{ totalVentas: string; totalGastos: string; cerradoPor: string; motivo: string } | null>(null)
  const [deleteCierreMotivo, setDeleteCierreMotivo] = useState<string | null>(null)

  const handleEditCierre = async () => {
    if (!cierreDetalle?.cierre || !editCierre) return
    if (!editCierre.motivo) {
      toast('Ingresa el motivo', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/cierre/${cierreDetalle.cierre.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin,
          totalVentas: parseFloat(editCierre.totalVentas),
          totalGastos: parseFloat(editCierre.totalGastos),
          cerradoPor: editCierre.cerradoPor,
          motivo: editCierre.motivo,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al modificar el cierre')
      }
      toast('Cierre modificado', 'success')
      setEditCierre(null)
      setCierreDetalle(null)
      loadTab('historial')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCierre = async () => {
    if (!cierreDetalle?.cierre || !deleteCierreMotivo) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/cierre/${cierreDetalle.cierre.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, motivo: deleteCierreMotivo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar el cierre')
      }
      toast('Cierre eliminado', 'success')
      setCierreDetalle(null)
      setDeleteCierreMotivo(null)
      loadTab('historial')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnlock = async () => {
    if (!pinInput) return
    try {
      const res = await fetch(`/api/admin/historial?adminPin=${encodeURIComponent(pinInput)}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'PIN incorrecto')
      }
      setAdminPin(pinInput)
      setUnlocked(true)
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  useEffect(() => {
    if (!unlocked) return
    loadTab(tab)
    // Cerrar cualquier formulario/modal abierto al cambiar de tab, para
    // evitar editar o guardar sobre datos de una sección que ya no se ve.
    setCierreDetalle(null)
    setEditCierre(null)
    setDeleteCierreMotivo(null)
    setDescuentoForm(null)
    setPeriodoDetalle(null)
    setAutosDetalle(null)
    setShowAutosModal(false)
    setLavadoresDetalle(null)
    setShowLavadoresModal(false)
    setMetaEdit(null)
    setTurnoForm(null)
    setShowEmpForm(false)
    setEditingEmp(null)
    setCatForm(null)
    setShowPeriodoModal(false)
    setGastoFijoForm(null)
    setShowResetConfirm(false)
    setResetConfirmText('')
  }, [unlocked, tab])

  useEffect(() => {
    if (!unlocked || tab !== 'contabilidad') return
    loadPlanilla(mesPlanilla)
  }, [mesPlanilla])

  const loadPlanilla = (mes: string) => {
    fetch(`/api/admin/planilla?adminPin=${encodeURIComponent(adminPin)}&mes=${encodeURIComponent(mes)}`)
      .then(r => r.json())
      .then(setPlanilla)
      .catch(() => {})
  }

  const loadGastosFijos = () => {
    fetch(`/api/admin/gastos-fijos?adminPin=${encodeURIComponent(adminPin)}`)
      .then(r => r.json())
      .then(setGastosFijos)
      .catch(() => {})
  }

  const handleSaveGastoFijo = async () => {
    if (!gastoFijoForm || !gastoFijoForm.descripcion || !gastoFijoForm.monto) {
      toast('Completa descripción y monto', 'error')
      return
    }
    setSubmitting(true)
    try {
      const isEdit = !!gastoFijoForm.id
      const res = await fetch(isEdit ? `/api/admin/gastos-fijos/${gastoFijoForm.id}` : '/api/admin/gastos-fijos', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, descripcion: gastoFijoForm.descripcion, monto: parseFloat(gastoFijoForm.monto) }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
      toast('Gasto fijo guardado', 'success')
      setGastoFijoForm(null)
      loadGastosFijos()
      loadPlanilla(mesPlanilla)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleGastoFijo = async (g: GastoFijo) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/gastos-fijos/${g.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, activo: !g.activo }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      loadGastosFijos()
      loadPlanilla(mesPlanilla)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePagarGastoFijo = async (g: GastoFijo) => {
    if (!confirm(`¿Registrar el pago de "${g.descripcion}" por $${g.monto.toFixed(2)}? Esto sí afectará el flujo de caja.`)) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/gastos-fijos/${g.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al registrar el pago')
      }
      toast('Pago registrado', 'success')
      loadPlanilla(mesPlanilla)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePagarNomina = async (emp: PlanillaEmpleado, p: PlanillaPeriodo) => {
    if (!confirm(`¿Registrar el pago de nómina de ${emp.nombre} ${emp.apellido || ''} para ${p.label} por $${p.totalPagar.toFixed(2)}? Esto sí afectará el flujo de caja.`)) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/nomina-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, empleadoId: emp.id, periodoKey: p.periodoKey, monto: p.totalPagar }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al registrar el pago de nómina')
      }
      toast('Pago de nómina registrado', 'success')
      loadPlanilla(mesPlanilla)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevertirPagoNomina = async (p: PlanillaPeriodo) => {
    if (!p.nominaPagoId) return
    if (!confirm('¿Revertir este pago de nómina? Se eliminará el registro y su gasto vinculado.')) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/nomina-pago/${p.nominaPagoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al revertir el pago')
      }
      toast('Pago revertido', 'success')
      loadPlanilla(mesPlanilla)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteGastoFijo = async (id: string) => {
    if (!confirm('¿Eliminar este gasto fijo?')) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/gastos-fijos/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) throw new Error('Error al eliminar')
      loadGastosFijos()
      loadPlanilla(mesPlanilla)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetDatosPrueba = async () => {
    if (resetConfirmText !== 'REINICIAR') {
      toast('Escribe REINICIAR para confirmar', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/reset-datos-prueba', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, confirmText: resetConfirmText }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al reiniciar')
      }
      toast('Datos de prueba reiniciados', 'success')
      setShowResetConfirm(false)
      setResetConfirmText('')
      loadPlanilla(mesPlanilla)
      loadGastosFijos()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const openPeriodoDetalle = async (periodo: 'Q1' | 'Q2' | 'M') => {
    setShowPeriodoModal(true)
    setPeriodoDetalleLoading(true)
    setPeriodoDetalle(null)
    try {
      const res = await fetch(`/api/admin/planilla/periodo-detalle?adminPin=${encodeURIComponent(adminPin)}&mes=${encodeURIComponent(mesPlanilla)}&periodo=${periodo}`)
      if (!res.ok) throw new Error('Error al cargar el detalle del período')
      setPeriodoDetalle(await res.json())
    } catch (e: any) {
      toast(e.message, 'error')
      setShowPeriodoModal(false)
    } finally {
      setPeriodoDetalleLoading(false)
    }
  }

  const openAutosDetalle = async () => {
    setShowAutosModal(true)
    setAutosDetalleLoading(true)
    setAutosDetalle(null)
    try {
      const res = await fetch(`/api/admin/planilla/autos-detalle?adminPin=${encodeURIComponent(adminPin)}&mes=${encodeURIComponent(mesPlanilla)}`)
      if (!res.ok) throw new Error('Error al cargar las estadísticas')
      setAutosDetalle(await res.json())
    } catch (e: any) {
      toast(e.message, 'error')
      setShowAutosModal(false)
    } finally {
      setAutosDetalleLoading(false)
    }
  }

  const openLavadoresDetalle = async () => {
    setShowLavadoresModal(true)
    setLavadoresDetalleLoading(true)
    setLavadoresDetalle(null)
    try {
      const res = await fetch(`/api/admin/planilla/lavadores-detalle?adminPin=${encodeURIComponent(adminPin)}&mes=${encodeURIComponent(mesPlanilla)}`)
      if (!res.ok) throw new Error('Error al cargar los lavadores')
      const data = await res.json()
      setLavadoresDetalle(data.lavadores)
    } catch (e: any) {
      toast(e.message, 'error')
      setShowLavadoresModal(false)
    } finally {
      setLavadoresDetalleLoading(false)
    }
  }

  const handleSaveMeta = async (id: string) => {
    if (!metaEdit) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/empleados/${id}/meta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, meta: metaEdit.value === '' ? null : parseInt(metaEdit.value, 10) }),
      })
      if (!res.ok) throw new Error('Error al guardar la meta')
      const metaValue = metaEdit.value === '' ? null : parseInt(metaEdit.value, 10)
      setLavadoresDetalle(prev => prev ? prev.map(l => (l.id === id ? { ...l, meta: metaValue } : l)) : prev)
      setMetaEdit(null)
      toast('Meta guardada', 'success')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const loadTab = (t: SubTab) => {
    if (t === 'historial') {
      fetch(`/api/admin/historial?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setHistorial)
        .catch(() => {})
    } else if (t === 'contabilidad') {
      loadPlanilla(mesPlanilla)
      loadGastosFijos()
    } else if (t === 'empleados') {
      fetch(`/api/admin/empleados?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setEmpleados)
        .catch(() => {})
    } else if (t === 'config') {
      fetch(`/api/admin/empleados?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setEmpleados)
        .catch(() => {})
    } else if (t === 'catalogo') {
      fetch(`/api/admin/catalogo?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setCatalogo)
        .catch(() => {})
    } else if (t === 'auditoria') {
      fetch(`/api/admin/auditoria?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setAuditoria)
        .catch(() => {})
    } else if (t === 'horarios') {
      fetch(`/api/admin/horarios?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then((d: HorariosData) => {
          setHorariosData(d)
          setHorarioNegocioForm(d.horarioNegocio)
        })
        .catch(() => {})
    }
  }

  const handleSaveHorarioNegocio = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/horarios/negocio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, dias: horarioNegocioForm }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar horario')
      }
      toast('Horario del negocio guardado', 'success')
      loadTab('horarios')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddTurno = async () => {
    if (!turnoForm || !turnoForm.horaInicio || !turnoForm.horaFin) {
      toast('Completa entrada y salida', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/horarios/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, ...turnoForm }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al agregar turno')
      }
      toast('Turno agregado', 'success')
      setTurnoForm(null)
      loadTab('horarios')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTurno = async (id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/horarios/turnos/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar turno')
      }
      loadTab('horarios')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddDescuento = async () => {
    if (!descuentoForm || !descuentoForm.monto || !descuentoForm.motivo) {
      toast('Completa el monto y el motivo', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/planilla/descuento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin,
          empleadoId: descuentoForm.empleadoId,
          periodo: descuentoForm.periodoKey,
          monto: parseFloat(descuentoForm.monto),
          motivo: descuentoForm.motivo,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al agregar descuento')
      }
      toast('Descuento agregado', 'success')
      setDescuentoForm(null)
      loadPlanilla(mesPlanilla)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteDescuento = async (id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/planilla/descuento/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar descuento')
      }
      loadPlanilla(mesPlanilla)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const enviarRecibo = async (emp: PlanillaEmpleado, p: PlanillaPeriodo) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/planilla/recibo-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin, empleadoId: emp.id, periodoKey: p.periodoKey }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error al generar el link')
      const recibo = await res.json()
      const url = `${window.location.origin}/recibo/${recibo.token}`
      try {
        await navigator.clipboard.writeText(url)
        toast(
          recibo.firmaNombre
            ? `Link copiado. Ya fue firmado por ${recibo.firmaNombre}.`
            : 'Link copiado al portapapeles. Envíaselo al empleado para que firme.',
          'success'
        )
      } catch {
        window.prompt('Copia el link para enviar al empleado:', url)
      }
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const imprimirRecibo = (emp: PlanillaEmpleado, p: PlanillaPeriodo) => {
    const w = window.open('', '_blank')
    if (!w) return
    const fecha = new Date().toLocaleDateString('es-SV', { year: 'numeric', month: 'long', day: 'numeric' })
    const descuentosHtml = p.descuentos
      .map(d => `<tr><td>Descuento: ${d.motivo}</td><td class="num">-$${d.monto.toFixed(2)}</td></tr>`)
      .join('')
    w.document.write(`
      <html>
      <head>
        <title>Recibo de sueldo - ${emp.nombre} ${emp.apellido || ''} - ${p.label}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
          h1 { font-size: 18px; margin-bottom: 0; }
          .sub { color: #555; font-size: 13px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          td { padding: 6px 4px; border-bottom: 1px solid #ddd; font-size: 14px; }
          .num { text-align: right; }
          .total td { font-weight: 700; font-size: 16px; border-top: 2px solid #111; border-bottom: none; }
          .firma { margin-top: 60px; display: flex; justify-content: space-between; }
          .firma div { width: 45%; border-top: 1px solid #111; text-align: center; padding-top: 6px; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>Los Pits Car Wash — Recibo de sueldo</h1>
        <div class="sub">Emitido el ${fecha}</div>
        <table>
          <tr><td>Empleado</td><td class="num">${emp.nombre} ${emp.apellido || ''}</td></tr>
          <tr><td>Puesto</td><td class="num">${emp.role}</td></tr>
          <tr><td>Período</td><td class="num">${p.label}</td></tr>
          <tr><td>Sueldo base</td><td class="num">$${p.sueldoBase.toFixed(2)}</td></tr>
          <tr><td>Comisión (${emp.comisionPercent || 0}% · ${p.autosLavados} autos)</td><td class="num">$${p.comision.toFixed(2)}</td></tr>
          ${descuentosHtml}
          <tr class="total"><td>Total a pagar</td><td class="num">$${p.totalPagar.toFixed(2)}</td></tr>
        </table>
        <div class="firma">
          <div>Firma del empleado</div>
          <div>Firma de administración</div>
        </div>
        <script>window.onload = () => window.print()</script>
      </body>
      </html>
    `)
    w.document.close()
  }

  const openNewEmp = () => {
    setEditingEmp(null)
    setEmpForm({ role: 'lavador' })
    setShowEmpForm(true)
  }

  const openNewAdmin = () => {
    setEditingEmp(null)
    setEmpForm({ role: 'socio' })
    setShowEmpForm(true)
  }

  const openEditEmp = (e: Empleado) => {
    setEditingEmp(e)
    setEmpForm({ ...e })
    setShowEmpForm(true)
  }

  const handleSaveEmp = async () => {
    if (!empForm.nombre || !empForm.role) {
      toast('Nombre y rol son obligatorios', 'error')
      return
    }
    setSubmitting(true)
    try {
      const body: any = { adminPin, ...empForm }
      const res = await fetch(editingEmp ? `/api/admin/empleados/${editingEmp.id}` : '/api/admin/empleados', {
        method: editingEmp ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar empleado')
      }
      toast('Empleado guardado', 'success')
      setShowEmpForm(false)
      loadTab('empleados')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEmp = async (id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/empleados/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar')
      }
      toast('Empleado eliminado', 'success')
      loadTab('empleados')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveCat = async () => {
    if (!catForm || !catForm.nombre || !catForm.precio) {
      toast('Completa nombre y precio', 'error')
      return
    }
    setSubmitting(true)
    try {
      const url = catForm.id
        ? `/api/admin/catalogo/${catForm.tipo}/${catForm.id}`
        : `/api/admin/catalogo/${catForm.tipo}`
      const res = await fetch(url, {
        method: catForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin,
          nombre: catForm.nombre,
          precio: parseFloat(catForm.precio),
          categoria: catForm.categoria,
          stock: catForm.tipo === 'producto' ? (catForm.stock.trim() === '' ? null : Number(catForm.stock)) : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
      toast('Guardado', 'success')
      setCatForm(null)
      loadTab('catalogo')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCat = async (tipo: 'servicio' | 'producto', id: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/catalogo/${tipo}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al eliminar')
      }
      toast('Eliminado', 'success')
      loadTab('catalogo')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangePin = async () => {
    if (!oldPin || !newPin) {
      toast('Completa ambos PINs', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/config/admin-pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPin, newPin }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al cambiar PIN')
      }
      toast('PIN actualizado', 'success')
      setAdminPin(newPin)
      setOldPin('')
      setNewPin('')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!unlocked) {
    return (
      <div className="pin-gate">
        <h2>Administración</h2>
        <p className="empty-state">Ingresa el PIN de administrador</p>
        <input
          type="password"
          maxLength={4}
          value={pinInput}
          onChange={e => setPinInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          placeholder="••••"
        />
        <button className="btn-primary" onClick={handleUnlock} style={{ maxWidth: 160 }}>
          Desbloquear
        </button>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="subnav">
        {(['historial', 'contabilidad', 'empleados', 'horarios', 'catalogo', 'auditoria', 'config'] as SubTab[]).map(t => (
          <button key={t} className={`subnav-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'historial' && (
        <div>
          {!historial ? (
            <p className="empty-state">Cargando...</p>
          ) : (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="label">Semana</div>
                  <div className="value yellow">${historial.week.sales.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Neto semana</div>
                  <div className="value green">${historial.week.net.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Quincena</div>
                  <div className="value yellow">${historial.fortnight.sales.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Neto quincena</div>
                  <div className="value green">${historial.fortnight.net.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Mes</div>
                  <div className="value yellow">${historial.month.sales.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Neto mes</div>
                  <div className="value green">${historial.month.net.toFixed(2)}</div>
                </div>
              </div>
              <h2>Cierres de caja</h2>
              <div className="action-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {(['todos', 'dia', 'semana', 'quincena', 'mes'] as const).map(f => (
                  <button
                    key={f}
                    className={`btn-secondary ${cierreFiltro === f ? 'active' : ''}`}
                    onClick={() => setCierreFiltro(f)}
                  >
                    {f === 'todos' ? 'Todos' : f === 'dia' ? 'Hoy' : f === 'semana' ? 'Semana' : f === 'quincena' ? 'Quincena' : 'Mes'}
                  </button>
                ))}
                <input
                  type="date"
                  value={cierreFechaBusqueda}
                  onChange={e => {
                    setCierreFechaBusqueda(e.target.value)
                    setCierreFiltro('fecha')
                  }}
                />
              </div>
              {(() => {
                const now = new Date()
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                const startOfWeek = new Date(startOfDay)
                startOfWeek.setDate(startOfWeek.getDate() - 7)
                const startOfFortnight = now.getDate() <= 15
                  ? new Date(now.getFullYear(), now.getMonth(), 1)
                  : new Date(now.getFullYear(), now.getMonth(), 16)
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

                const cierresFiltrados = historial.cierres.filter(c => {
                  const fecha = new Date(c.fecha)
                  if (cierreFiltro === 'dia') return fecha >= startOfDay
                  if (cierreFiltro === 'semana') return fecha >= startOfWeek
                  if (cierreFiltro === 'quincena') return fecha >= startOfFortnight
                  if (cierreFiltro === 'mes') return fecha >= startOfMonth
                  if (cierreFiltro === 'fecha') {
                    if (!cierreFechaBusqueda) return true
                    return fecha.toISOString().slice(0, 10) === cierreFechaBusqueda
                  }
                  return true
                })

                return cierresFiltrados.length === 0 ? (
                  <p className="empty-state">Sin cierres para ese filtro</p>
                ) : (
                  <div className="list">
                    {cierresFiltrados.map(c => (
                      <div key={c.id} className="list-row" onClick={() => openCierreDetalle(c.id)} style={{ cursor: 'pointer' }}>
                        <div className="main">
                          <div className="title">
                            {new Date(c.fecha).toLocaleDateString('es-SV')} · {new Date(c.createdAt).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="sub">
                            Ventas ${c.totalVentas.toFixed(2)} · Gastos ${c.totalGastos.toFixed(2)}
                          </div>
                        </div>
                        <div className="amount">${c.neto.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {tab === 'contabilidad' && (
        <div>
          <div className="action-row" style={{ alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="k">Mes</span>
              <input type="month" value={mesPlanilla} onChange={e => setMesPlanilla(e.target.value)} />
            </label>
            <button className="btn-cancel" style={{ color: 'var(--red)' }} onClick={() => setShowResetConfirm(true)}>
              Reiniciar datos de prueba
            </button>
          </div>

          {!planilla ? (
            <p className="empty-state">Cargando...</p>
          ) : (
            <>
              <h2>Hoy</h2>
              <div className="detail-card">
                <div className="dt-row">
                  <span className="k">Ventas</span>
                  <span>${planilla.hoy.ventas.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Gastos</span>
                  <span>${planilla.hoy.gastos.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Neto</span>
                  <span>${planilla.hoy.neto.toFixed(2)}</span>
                </div>
              </div>

              <h2>Resumen del mes</h2>
              <div className="detail-card">
                <div className="dt-row">
                  <span className="k">Ingresos totales</span>
                  <span>${planilla.resumenMensual.ingresos.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Gastos operativos</span>
                  <span>${planilla.resumenMensual.gastosOperativos.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">— de los cuales gastos fijos</span>
                  <span>${planilla.resumenMensual.gastosFijos.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Nómina ya registrada como gasto</span>
                  <span>${planilla.resumenMensual.nominaYaRegistrada.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Planilla calculada (a abonar)</span>
                  <span>${planilla.resumenMensual.planillaCalculada.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Balance del mes (utilidad, devengado)</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: planilla.resumenMensual.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    ${planilla.resumenMensual.balance.toFixed(2)}
                  </span>
                </div>
                <div className="dt-row">
                  <span className="k">— gastos fijos pagados</span>
                  <span>${planilla.resumenMensual.gastosFijosPagados.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">— gastos fijos pendientes</span>
                  <span style={{ color: planilla.resumenMensual.gastosFijosPendientes > 0 ? 'var(--red)' : undefined }}>
                    ${planilla.resumenMensual.gastosFijosPendientes.toFixed(2)}
                  </span>
                </div>
                <div className="dt-row">
                  <span className="k">Flujo de caja del mes (real, solo pagos registrados)</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: planilla.resumenMensual.flujoCaja >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    ${planilla.resumenMensual.flujoCaja.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="action-row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>Gastos fijos</h2>
                <button className="btn-confirm" onClick={() => setGastoFijoForm({ descripcion: '', monto: '' })}>
                  + Gasto fijo
                </button>
              </div>
              {gastosFijos.length === 0 ? (
                <p className="empty-state">No hay gastos fijos configurados</p>
              ) : (
                <div className="detail-card">
                  {gastosFijos.map(g => {
                    const detalle = planilla?.gastosFijosDetalle.find(d => d.id === g.id)
                    const pagado = detalle?.estado === 'pagado'
                    return (
                      <div className="dt-row" key={g.id} style={{ opacity: g.activo ? 1 : 0.5, flexWrap: 'wrap' }}>
                        <span className="k">
                          {g.descripcion}{!g.activo && ' (inactivo)'}
                          {g.activo && detalle && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: pagado ? 'var(--green)' : 'var(--red)' }}>
                              {pagado ? 'Pagado este mes' : 'Pendiente este mes'}
                            </span>
                          )}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          ${g.monto.toFixed(2)}
                          {g.activo && !pagado && (
                            <button className="btn-confirm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => handlePagarGastoFijo(g)}>
                              Marcar pagado
                            </button>
                          )}
                          <button className="btn-cancel" onClick={() => setGastoFijoForm({ id: g.id, descripcion: g.descripcion, monto: String(g.monto) })}>
                            Editar
                          </button>
                          <button className="btn-cancel" onClick={() => handleToggleGastoFijo(g)}>
                            {g.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button className="btn-cancel" style={{ color: 'var(--red)' }} onClick={() => handleDeleteGastoFijo(g.id)}>
                            Eliminar
                          </button>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              <h2>Balance quincenal</h2>
              <div className="stat-grid">
                {planilla.quincenas.map((q, i) => (
                  <div
                    key={i}
                    className="stat-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openPeriodoDetalle(i === 0 ? 'Q1' : 'Q2')}
                  >
                    <div className="label">{q.nombre}</div>
                    <div className="value yellow">${q.ingresos.toFixed(2)}</div>
                    <div className="sub" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      Gastos ${q.gastosOperativos.toFixed(2)} · Planilla ${q.planilla.toFixed(2)}
                    </div>
                    <div className={`value ${q.balance >= 0 ? 'green' : 'red'}`} style={{ marginTop: 4 }}>
                      ${q.balance.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <h2>Estadísticas del mes</h2>
              <div className="stat-grid">
                <div className="stat-card" style={{ cursor: 'pointer' }} onClick={openAutosDetalle}>
                  <div className="label">Autos lavados</div>
                  <div className="value yellow">{planilla.stats.autosLavadosMes}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Ticket promedio</div>
                  <div className="value yellow">${planilla.stats.ticketPromedio.toFixed(2)}</div>
                </div>
                <div className="stat-card" style={{ cursor: 'pointer' }} onClick={openLavadoresDetalle}>
                  <div className="label">Top lavador</div>
                  <div className="value green" style={{ fontSize: 15 }}>
                    {planilla.stats.topLavador ? planilla.stats.topLavador.nombre : '—'}
                  </div>
                  {planilla.stats.topLavador && (
                    <div className="sub" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      ${planilla.stats.topLavador.ventas.toFixed(2)} en ventas atribuidas
                    </div>
                  )}
                </div>
                {Object.entries(planilla.stats.ventasPorMetodo).map(([metodo, monto]) => (
                  <div key={metodo} className="stat-card">
                    <div className="label" style={{ textTransform: 'capitalize' }}>{metodo}</div>
                    <div className="value yellow">${(monto as number).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <h2>Planilla de empleados</h2>
              {planilla.empleados.length === 0 ? (
                <p className="empty-state">No hay empleados con sueldo configurado. Configura sueldo quincenal o mensual en Empleados.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {planilla.empleados.map(emp => (
                    <div key={emp.id} className="detail-card">
                      <div className="dt-row" style={{ borderBottom: 'none', fontWeight: 700 }}>
                        <span>
                          {emp.nombre} {emp.apellido}
                        </span>
                        <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>{emp.role}</span>
                      </div>
                      {emp.periodos.map(p => (
                        <div key={p.periodo} style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                          <div className="dt-row" style={{ borderBottom: 'none' }}>
                            <span className="k">
                              {p.label}
                              <span style={{ marginLeft: 6, fontSize: 11, color: p.estado === 'pagado' ? 'var(--green)' : 'var(--red)' }}>
                                {p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                              </span>
                            </span>
                            <span style={{ fontWeight: 700 }}>${p.totalPagar.toFixed(2)}</span>
                          </div>
                          <div className="dt-row">
                            <span className="k">Sueldo base</span>
                            <span>${p.sueldoBase.toFixed(2)}</span>
                          </div>
                          <div className="dt-row">
                            <span className="k">
                              Comisión ({emp.comisionPercent || 0}% por lavado que supere ${emp.comisionThreshold || 0} · lavó {p.autosLavados} autos)
                            </span>
                            <span>${p.comision.toFixed(2)}</span>
                          </div>
                          {p.descuentos.map(d => (
                            <div key={d.id} className="dt-row">
                              <span className="k">Descuento: {d.motivo}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                -${d.monto.toFixed(2)}
                                <button
                                  className="btn-danger"
                                  style={{ padding: '0 6px', fontSize: 11 }}
                                  onClick={() => handleDeleteDescuento(d.id)}
                                >
                                  ✕
                                </button>
                              </span>
                            </div>
                          ))}
                          <div className="action-row" style={{ marginTop: 6 }}>
                            <button
                              className="btn-secondary"
                              style={{ fontSize: 12, padding: '4px 10px', maxWidth: 180 }}
                              onClick={() =>
                                setDescuentoForm({
                                  empleadoId: emp.id,
                                  empleadoNombre: `${emp.nombre} ${emp.apellido || ''}`.trim(),
                                  periodoKey: p.periodoKey,
                                  periodoLabel: p.label,
                                  monto: '',
                                  motivo: '',
                                })
                              }
                            >
                              + Descuento
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ fontSize: 12, padding: '4px 10px', maxWidth: 180 }}
                              onClick={() => imprimirRecibo(emp, p)}
                            >
                              🖨 Recibo
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ fontSize: 12, padding: '4px 10px', maxWidth: 220 }}
                              onClick={() => enviarRecibo(emp, p)}
                            >
                              🔗 Enviar para firmar
                            </button>
                            {p.estado === 'pagado' ? (
                              <button
                                className="btn-cancel"
                                style={{ fontSize: 12, padding: '4px 10px', maxWidth: 180, color: 'var(--red)' }}
                                onClick={() => handleRevertirPagoNomina(p)}
                              >
                                Revertir pago
                              </button>
                            ) : (
                              <button
                                className="btn-confirm"
                                style={{ fontSize: 12, padding: '4px 10px', maxWidth: 180 }}
                                onClick={() => handlePagarNomina(emp, p)}
                              >
                                Marcar pagado
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="detail-card">
                    <div className="dt-row" style={{ borderBottom: 'none', fontWeight: 700 }}>
                      <span>Total planilla del mes a abonar</span>
                      <span>${planilla.totalPlanilla.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'empleados' && (
        <div>
          <div className="action-row">
            <button className="btn-primary" onClick={openNewEmp}>
              + Nuevo Empleado
            </button>
          </div>
          {empleados.filter(e => e.role !== 'socio').length === 0 ? (
            <p className="empty-state">Sin empleados</p>
          ) : (
            <>
              <div className="list">
                {empleados.filter(e => e.role !== 'socio').map(e => (
                  <div key={e.id} className="list-row" onClick={() => openEditEmp(e)}>
                    <div className="main">
                      <div className="title">
                        {e.nombre} {e.apellido}
                      </div>
                      <div className="sub">{e.role}</div>
                    </div>
                    <button
                      className="btn-danger"
                      onClick={ev => {
                        ev.stopPropagation()
                        handleDeleteEmp(e.id)
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'horarios' && (
        <div>
          {!horariosData ? (
            <p className="empty-state">Cargando...</p>
          ) : (
            <>
              <h2>Horario del negocio</h2>
              <div className="list">
                {horarioNegocioForm.map((d, i) => (
                  <div key={d.diaSemana} className="list-row static" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div className="main" style={{ minWidth: 100 }}>
                      <div className="title">{DIAS[d.diaSemana]}</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={d.abierto}
                        onChange={e => {
                          const next = [...horarioNegocioForm]
                          next[i] = { ...next[i], abierto: e.target.checked }
                          setHorarioNegocioForm(next)
                        }}
                      />
                      Abierto
                    </label>
                    {d.abierto && (
                      <>
                        <input
                          type="time"
                          value={d.horaApertura || ''}
                          onChange={e => {
                            const next = [...horarioNegocioForm]
                            next[i] = { ...next[i], horaApertura: e.target.value }
                            setHorarioNegocioForm(next)
                          }}
                          style={{ width: 110 }}
                        />
                        <span>a</span>
                        <input
                          type="time"
                          value={d.horaCierre || ''}
                          onChange={e => {
                            const next = [...horarioNegocioForm]
                            next[i] = { ...next[i], horaCierre: e.target.value }
                            setHorarioNegocioForm(next)
                          }}
                          style={{ width: 110 }}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="action-row">
                <button className="btn-primary" onClick={handleSaveHorarioNegocio} disabled={submitting} style={{ maxWidth: 220 }}>
                  {submitting ? 'Guardando...' : 'Guardar horario del negocio'}
                </button>
              </div>

              <h2>Turnos de empleados</h2>
              {horariosData.empleados.length === 0 ? (
                <p className="empty-state">No hay empleados registrados</p>
              ) : (
                <div className="table-scroll" style={{ overflowX: 'auto' }}>
                  <table className="horario-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8 }}>Empleado</th>
                        {DIAS.map((d, i) => (
                          <th key={i} style={{ padding: 8, minWidth: 140 }}>
                            {d.slice(0, 3)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {horariosData.empleados.map(emp => (
                        <tr key={emp.id}>
                          <td style={{ padding: 8, fontWeight: 600 }}>
                            {emp.nombre} {emp.apellido}
                          </td>
                          {DIAS.map((_, dia) => {
                            const turnosDia = horariosData.turnos.filter(t => t.empleadoId === emp.id && t.diaSemana === dia)
                            return (
                              <td key={dia} style={{ padding: 8, verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {turnosDia.map(t => (
                                    <div
                                      key={t.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 4,
                                        background: 'var(--card-bg, #222)',
                                        borderRadius: 6,
                                        padding: '2px 6px',
                                        fontSize: 12,
                                      }}
                                    >
                                      <span>
                                        {t.horaInicio}–{t.horaFin}
                                      </span>
                                      <button
                                        className="btn-danger"
                                        style={{ padding: '0 6px', fontSize: 11 }}
                                        onClick={() => handleDeleteTurno(t.id)}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    className="btn-secondary"
                                    style={{ fontSize: 12, padding: '2px 6px' }}
                                    onClick={() => setTurnoForm({ empleadoId: emp.id, diaSemana: dia, horaInicio: '', horaFin: '' })}
                                  >
                                    + Agregar
                                  </button>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'catalogo' && (
        <div>
          <div className="action-row">
            <button className="btn-secondary" onClick={() => setCatForm({ tipo: 'servicio', nombre: '', precio: '', categoria: 'SEDÁN', stock: '' })}>
              + Servicio
            </button>
            <button className="btn-secondary" onClick={() => setCatForm({ tipo: 'producto', nombre: '', precio: '', categoria: 'Bebidas Frías', stock: '' })}>
              + Producto
            </button>
          </div>
          <h2>Servicios</h2>
          {!catalogo || catalogo.servicios.length === 0 ? (
            <p className="empty-state">Sin servicios</p>
          ) : (
            CATEGORIAS_SERVICIO.filter(cat =>
              catalogo.servicios.some(s => (s.categoria || 'General') === cat)
            ).map(cat => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div className="k" style={{ margin: '8px 0 4px', fontWeight: 700 }}>
                  {cat}
                </div>
                <div className="list">
                  {catalogo.servicios
                    .filter(s => (s.categoria || 'General') === cat)
                    .map(s => (
                      <div
                        key={s.id}
                        className="list-row"
                        onClick={() =>
                          setCatForm({ tipo: 'servicio', nombre: s.nombre, precio: String(s.precio), categoria: s.categoria || 'General', stock: '', id: s.id })
                        }
                      >
                        <div className="main">
                          <div className="title">{s.nombre}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="amount">${s.precio.toFixed(2)}</div>
                          <button
                            className="btn-danger"
                            onClick={ev => {
                              ev.stopPropagation()
                              handleDeleteCat('servicio', s.id)
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
          {catalogo && catalogo.productos.length > 0 && (
            <>
              <h2>Cafetería · Más vendidos</h2>
              <div className="list" style={{ marginBottom: 16 }}>
                {[...catalogo.productos]
                  .sort((a, b) => (b.vendidos || 0) - (a.vendidos || 0))
                  .slice(0, 5)
                  .map((p, idx) => (
                    <div key={p.id} className="list-row">
                      <div className="main">
                        <div className="title">#{idx + 1} {p.nombre}</div>
                        <div className="sub">{p.vendidos || 0} vendidos · ${(p.montoVendido || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
              </div>
              {catalogo.productos.some(p => p.stock !== null && p.stock !== undefined && p.stock <= 5) && (
                <div className="alert-box" style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <strong>⚠️ Stock bajo:</strong>{' '}
                  {catalogo.productos
                    .filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 5)
                    .map(p => `${p.nombre} (${p.stock})`)
                    .join(', ')}
                </div>
              )}
            </>
          )}
          <h2>Productos</h2>
          {!catalogo || catalogo.productos.length === 0 ? (
            <p className="empty-state">Sin productos</p>
          ) : (
            CATEGORIAS_PRODUCTO.filter(cat =>
              catalogo.productos.some(p => (p.categoria || 'Otros') === cat)
            ).map(cat => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div className="k" style={{ margin: '8px 0 4px', fontWeight: 700 }}>
                  {cat}
                </div>
                <div className="list">
                  {catalogo.productos
                    .filter(p => (p.categoria || 'Otros') === cat)
                    .map(p => {
                      const lowStock = p.stock !== null && p.stock !== undefined && p.stock <= 5
                      return (
                      <div
                        key={p.id}
                        className="list-row"
                        onClick={() =>
                          setCatForm({ tipo: 'producto', nombre: p.nombre, precio: String(p.precio), categoria: p.categoria || 'Otros', stock: p.stock != null ? String(p.stock) : '', id: p.id })
                        }
                      >
                        <div className="main">
                          <div className="title">{p.nombre}</div>
                          <div className="sub">
                            {p.stock === null || p.stock === undefined
                              ? 'Sin control de stock'
                              : (
                                <span style={lowStock ? { color: '#c00', fontWeight: 700 } : undefined}>
                                  Restante: {p.stock}{lowStock ? ' ⚠️' : ''}
                                </span>
                              )}
                            {' · '}Vendidos: {p.vendidos || 0}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="amount">${p.precio.toFixed(2)}</div>
                          <button
                            className="btn-danger"
                            onClick={ev => {
                              ev.stopPropagation()
                              handleDeleteCat('producto', p.id)
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                      )
                    })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'auditoria' && (
        <div>
          <div className="action-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {([
              ['dia', 'Descargar día'],
              ['semana', 'Descargar semana'],
              ['quincena', 'Descargar quincena'],
              ['mes', 'Descargar mes'],
            ] as const).map(([rango, label]) => (
              <a
                key={rango}
                className="btn-secondary"
                href={`/api/admin/auditoria/export?adminPin=${encodeURIComponent(adminPin)}&rango=${rango}`}
                target="_blank"
                rel="noreferrer"
              >
                {label}
              </a>
            ))}
          </div>
          {!auditoria ? (
            <p className="empty-state">Cargando...</p>
          ) : auditoria.length === 0 ? (
            <p className="empty-state">Sin registros</p>
          ) : (
            <div className="list">
              {auditoria.map(a => (
                <div key={a.id} className="list-row static">
                  <div className="main">
                    <div className="title">{a.accion}</div>
                    <div className="sub">
                      {a.actor} · {a.detalle} · {new Date(a.fecha).toLocaleString('es-SV')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div>
          <h2>Administradores</h2>
          <div className="action-row">
            <button className="btn-primary" onClick={openNewAdmin}>
              + Nuevo Administrador
            </button>
          </div>
          {empleados.filter(e => e.role === 'socio').length === 0 ? (
            <p className="empty-state">Sin administradores registrados</p>
          ) : (
            <div className="list">
              {empleados.filter(e => e.role === 'socio').map(e => (
                <div key={e.id} className="list-row" onClick={() => openEditEmp(e)}>
                  <div className="main">
                    <div className="title">
                      {e.nombre} {e.apellido}
                    </div>
                    <div className="sub">{e.tipoDocumento || ''} {e.numeroDocumento || ''} · {e.telefono || ''}</div>
                  </div>
                  <button
                    className="btn-danger"
                    onClick={ev => {
                      ev.stopPropagation()
                      handleDeleteEmp(e.id)
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ marginTop: 24 }}>Cambiar PIN de Administrador</h2>
          <div className="form-group">
            <label>PIN actual</label>
            <input type="password" maxLength={4} value={oldPin} onChange={e => setOldPin(e.target.value)} />
          </div>
          <div className="form-group">
            <label>PIN nuevo</label>
            <input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={handleChangePin} disabled={submitting} style={{ maxWidth: 200 }}>
            {submitting ? 'Guardando...' : 'Actualizar PIN'}
          </button>
        </div>
      )}

      {showEmpForm && (
        <div className="modal-overlay" onClick={() => setShowEmpForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>
              {empForm.role === 'socio'
                ? editingEmp ? 'Editar Administrador' : 'Nuevo Administrador'
                : editingEmp ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h2>
            <div className="form-group">
              <label>Nombre *</label>
              <input value={empForm.nombre || ''} onChange={e => setEmpForm({ ...empForm, nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Apellido</label>
              <input value={empForm.apellido || ''} onChange={e => setEmpForm({ ...empForm, apellido: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Rol *</label>
              <select value={empForm.role || 'lavador'} onChange={e => setEmpForm({ ...empForm, role: e.target.value })}>
                <option value="lavador">Lavador</option>
                <option value="recepcion">Recepción</option>
                <option value="socio">Administrador (socio)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>{editingEmp ? 'Nuevo PIN (opcional)' : empForm.role === 'socio' ? 'PIN *' : 'PIN *'}</label>
              <input type="password" maxLength={4} value={empForm.pin || ''} onChange={e => setEmpForm({ ...empForm, pin: e.target.value })} />
              {empForm.role === 'socio' && (
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Este PIN se usa para entrar al panel administrativo y para vender como cajero.
                </span>
              )}
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={empForm.telefono || ''} onChange={e => setEmpForm({ ...empForm, telefono: e.target.value })} />
            </div>
            {empForm.role === 'socio' ? (
              <>
                <div className="form-group">
                  <label>Tipo de documento *</label>
                  <select
                    value={empForm.tipoDocumento || 'DUI'}
                    onChange={e => setEmpForm({ ...empForm, tipoDocumento: e.target.value })}
                  >
                    <option value="DUI">DUI</option>
                    <option value="PASAPORTE">Pasaporte</option>
                    <option value="RESIDENTE">Número de residente</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Número de documento *</label>
                  <input
                    value={empForm.numeroDocumento || ''}
                    onChange={e => setEmpForm({ ...empForm, numeroDocumento: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>DUI</label>
                  <input value={empForm.dui || ''} onChange={e => setEmpForm({ ...empForm, dui: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input value={empForm.email || ''} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contacto de emergencia</label>
                  <input value={empForm.emergName || ''} onChange={e => setEmpForm({ ...empForm, emergName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Teléfono de emergencia</label>
                  <input value={empForm.emergPhone || ''} onChange={e => setEmpForm({ ...empForm, emergPhone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Horario</label>
                  <input value={empForm.horario || ''} onChange={e => setEmpForm({ ...empForm, horario: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Sueldo mensual</label>
                  <input
                    type="number"
                    step="0.01"
                    value={empForm.sueldoMensual ?? ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || undefined
                      setEmpForm({ ...empForm, sueldoMensual: val })
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Quincena (calculado): {((empForm.sueldoMensual || 0) / 2).toFixed(2)}
                  </span>
                </div>
                <div className="form-group">
                  <label>Comisión %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={empForm.comisionPercent ?? ''}
                    onChange={e => setEmpForm({ ...empForm, comisionPercent: parseFloat(e.target.value) || undefined })}
                  />
                </div>
                <div className="form-group">
                  <label>Umbral de comisión</label>
                  <input
                    type="number"
                    step="0.01"
                    value={empForm.comisionThreshold ?? ''}
                    onChange={e => setEmpForm({ ...empForm, comisionThreshold: parseFloat(e.target.value) || undefined })}
                  />
                </div>
              </>
            )}
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setShowEmpForm(false)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleSaveEmp} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {turnoForm && (
        <div className="modal-overlay" onClick={() => setTurnoForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>
              Nuevo turno · {horariosData?.empleados.find(e => e.id === turnoForm.empleadoId)?.nombre} · {DIAS[turnoForm.diaSemana]}
            </h2>
            <div className="form-group">
              <label>Entrada</label>
              <input
                type="time"
                value={turnoForm.horaInicio}
                onChange={e => setTurnoForm({ ...turnoForm, horaInicio: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Salida</label>
              <input
                type="time"
                value={turnoForm.horaFin}
                onChange={e => setTurnoForm({ ...turnoForm, horaFin: e.target.value })}
              />
            </div>
            <p className="empty-state" style={{ fontSize: 12 }}>
              Puedes agregar más de una entrada/salida el mismo día (turno partido).
            </p>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setTurnoForm(null)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleAddTurno} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {descuentoForm && (
        <div className="modal-overlay" onClick={() => setDescuentoForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>
              Descuento · {descuentoForm.empleadoNombre} · {descuentoForm.periodoLabel}
            </h2>
            <div className="form-group">
              <label>Monto *</label>
              <input
                type="number"
                step="0.01"
                value={descuentoForm.monto}
                onChange={e => setDescuentoForm({ ...descuentoForm, monto: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Motivo *</label>
              <input
                value={descuentoForm.motivo}
                onChange={e => setDescuentoForm({ ...descuentoForm, motivo: e.target.value })}
              />
            </div>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setDescuentoForm(null)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleAddDescuento} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {catForm && (
        <div className="modal-overlay" onClick={() => setCatForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{catForm.id ? 'Editar' : 'Nuevo'} {catForm.tipo === 'servicio' ? 'Servicio' : 'Producto'}</h2>
            <div className="form-group">
              <label>Nombre *</label>
              <input value={catForm.nombre} onChange={e => setCatForm({ ...catForm, nombre: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Precio *</label>
              <input type="number" step="0.01" value={catForm.precio} onChange={e => setCatForm({ ...catForm, precio: e.target.value })} />
            </div>
            {catForm.tipo === 'producto' && (
              <div className="form-group">
                <label>Categoría *</label>
                <select value={catForm.categoria} onChange={e => setCatForm({ ...catForm, categoria: e.target.value })}>
                  {CATEGORIAS_PRODUCTO.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}
            {catForm.tipo === 'producto' && (
              <div className="form-group">
                <label>Stock (cantidad disponible)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={catForm.stock}
                  onChange={e => setCatForm({ ...catForm, stock: e.target.value })}
                  placeholder="Dejar vacío = sin control de stock"
                />
              </div>
            )}
            {catForm.tipo === 'servicio' && (
              <div className="form-group">
                <label>Categoría (tipo de vehículo) *</label>
                <select value={catForm.categoria} onChange={e => setCatForm({ ...catForm, categoria: e.target.value })}>
                  {CATEGORIAS_SERVICIO.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setCatForm(null)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleSaveCat} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(cierreDetalleLoading || cierreDetalle) && (
        <div className="modal-overlay" onClick={() => { setCierreDetalle(null); setEditCierre(null); setDeleteCierreMotivo(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {cierreDetalleLoading || !cierreDetalle ? (
              <p className="empty-state">Cargando...</p>
            ) : (
              <>
                <h2>
                  {cierreDetalle.cierre
                    ? `${new Date(cierreDetalle.cierre.fecha).toLocaleDateString('es-SV')} · ${new Date(cierreDetalle.cierre.createdAt).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Detalle del cierre'}
                </h2>
                {cierreDetalle.cierre && !editCierre && deleteCierreMotivo === null && (
                  <div className="detail-card">
                    <div className="dt-row">
                      <span className="k">Cerrado por</span>
                      <span>{cierreDetalle.cierre.cerradoPor}</span>
                    </div>
                    <div className="dt-row">
                      <span className="k">Ventas</span>
                      <span>${cierreDetalle.cierre.totalVentas.toFixed(2)}</span>
                    </div>
                    <div className="dt-row">
                      <span className="k">Gastos</span>
                      <span>${cierreDetalle.cierre.totalGastos.toFixed(2)}</span>
                    </div>
                    <div className="dt-row">
                      <span className="k">Neto</span>
                      <span>${cierreDetalle.cierre.neto.toFixed(2)}</span>
                    </div>
                    <div className="action-row" style={{ marginTop: 10 }}>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          setEditCierre({
                            totalVentas: String(cierreDetalle.cierre!.totalVentas),
                            totalGastos: String(cierreDetalle.cierre!.totalGastos),
                            cerradoPor: cierreDetalle.cierre!.cerradoPor,
                            motivo: '',
                          })
                        }
                      >
                        Modificar
                      </button>
                      <button className="btn-danger" onClick={() => setDeleteCierreMotivo('')} disabled={submitting}>
                        Eliminar cierre
                      </button>
                    </div>
                  </div>
                )}

                {cierreDetalle.cierre && deleteCierreMotivo !== null && (
                  <div className="detail-card">
                    <div className="form-group">
                      <label>Motivo para eliminar este cierre *</label>
                      <input
                        value={deleteCierreMotivo}
                        onChange={e => setDeleteCierreMotivo(e.target.value)}
                        placeholder="Motivo de la eliminación"
                        autoFocus
                      />
                    </div>
                    <div className="modal-buttons">
                      <button className="btn-cancel" onClick={() => setDeleteCierreMotivo(null)}>
                        Cancelar
                      </button>
                      <button
                        className="btn-danger"
                        onClick={handleDeleteCierre}
                        disabled={submitting || !deleteCierreMotivo}
                      >
                        {submitting ? 'Eliminando...' : 'Eliminar cierre'}
                      </button>
                    </div>
                  </div>
                )}

                {cierreDetalle.cierre && editCierre && (
                  <div className="detail-card">
                    <div className="form-group">
                      <label>Total ventas</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editCierre.totalVentas}
                        onChange={e => setEditCierre({ ...editCierre, totalVentas: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Total gastos</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editCierre.totalGastos}
                        onChange={e => setEditCierre({ ...editCierre, totalGastos: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Cerrado por</label>
                      <input
                        value={editCierre.cerradoPor}
                        onChange={e => setEditCierre({ ...editCierre, cerradoPor: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Motivo *</label>
                      <input
                        value={editCierre.motivo}
                        onChange={e => setEditCierre({ ...editCierre, motivo: e.target.value })}
                        placeholder="Motivo de la modificación"
                      />
                    </div>
                    <div className="modal-buttons">
                      <button className="btn-cancel" onClick={() => setEditCierre(null)}>
                        Cancelar
                      </button>
                      <button className="btn-confirm" onClick={handleEditCierre} disabled={submitting}>
                        {submitting ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}

                <h3 className="cat-subheader">Ventas ({cierreDetalle.ventas.length})</h3>
                {cierreDetalle.ventas.length === 0 ? (
                  <p className="empty-state">Sin ventas</p>
                ) : (
                  <div className="list">
                    {cierreDetalle.ventas.map(v => (
                      <div key={v.id} className="list-row static">
                        <div className="main">
                          <div className="title">
                            Recibo {v.numeroRecibo} {v.anulada && <span style={{ color: 'var(--red, #e33)' }}>(anulada)</span>}
                          </div>
                          <div className="sub">
                            {v.items.map(it => `${it.cantidad}x ${it.nombre}`).join(', ')} · {v.metodoPago}
                          </div>
                          {v.anulada && v.anuladaMotivo && (
                            <div className="sub">Motivo: {v.anuladaMotivo} · Por: {v.anuladaPor}</div>
                          )}
                        </div>
                        <div className="amount">${v.total.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="cat-subheader">Gastos ({cierreDetalle.gastos.length})</h3>
                {cierreDetalle.gastos.length === 0 ? (
                  <p className="empty-state">Sin gastos</p>
                ) : (
                  <div className="list">
                    {cierreDetalle.gastos.map(g => (
                      <div key={g.id} className="list-row static">
                        <div className="main">
                          <div className="title">{g.descripcion}</div>
                          {g.registradoPor && <div className="sub">Por: {g.registradoPor}</div>}
                        </div>
                        <div className="amount">${g.monto.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="modal-buttons">
                  <button className="btn-cancel" onClick={() => { setCierreDetalle(null); setEditCierre(null); setDeleteCierreMotivo(null) }}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {gastoFijoForm && (
        <div className="modal-overlay" onClick={() => setGastoFijoForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{gastoFijoForm.id ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</h2>
            <div className="form-group">
              <label>Descripción *</label>
              <input
                value={gastoFijoForm.descripcion}
                onChange={e => setGastoFijoForm({ ...gastoFijoForm, descripcion: e.target.value })}
                placeholder="Ej. Renta del local"
              />
            </div>
            <div className="form-group">
              <label>Monto mensual *</label>
              <input
                type="number"
                step="0.01"
                value={gastoFijoForm.monto}
                onChange={e => setGastoFijoForm({ ...gastoFijoForm, monto: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setGastoFijoForm(null)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleSaveGastoFijo} disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="modal-overlay" onClick={() => { setShowResetConfirm(false); setResetConfirmText('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Reiniciar datos de prueba</h2>
            <p style={{ color: 'var(--red)', fontWeight: 600 }}>
              Esto elimina permanentemente TODAS las ventas, gastos, cierres, cuentas abiertas y descuentos registrados
              (de todos los meses, no solo el mostrado). La configuración de empleados, catálogo y horarios no se toca.
            </p>
            <p>Escribe <strong>REINICIAR</strong> para confirmar.</p>
            <div className="form-group">
              <input value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)} placeholder="REINICIAR" />
            </div>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => { setShowResetConfirm(false); setResetConfirmText('') }}>
                Cancelar
              </button>
              <button className="btn-confirm" style={{ background: 'var(--red)' }} onClick={handleResetDatosPrueba} disabled={submitting || resetConfirmText !== 'REINICIAR'}>
                {submitting ? 'Reiniciando...' : 'Reiniciar todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPeriodoModal && (
        <div className="modal-overlay" onClick={() => setShowPeriodoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {periodoDetalleLoading || !periodoDetalle ? (
              <p className="empty-state">Cargando...</p>
            ) : (
              <>
                <h2>{periodoDetalle.label}</h2>
                <div className="detail-card">
                  <div className="dt-row">
                    <span className="k">Ventas ({periodoDetalle.ventasCount})</span>
                    <span>${periodoDetalle.ingresos.toFixed(2)}</span>
                  </div>
                  <div className="dt-row">
                    <span className="k">Gastos operativos</span>
                    <span>${periodoDetalle.gastosOperativos.toFixed(2)}</span>
                  </div>
                  <div className="dt-row">
                    <span className="k">Nómina registrada</span>
                    <span>${periodoDetalle.nomina.toFixed(2)}</span>
                  </div>
                  <div className="dt-row">
                    <span className="k">Neto</span>
                    <span style={{ fontWeight: 700, color: periodoDetalle.neto >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      ${periodoDetalle.neto.toFixed(2)}
                    </span>
                  </div>
                  {Object.entries(periodoDetalle.porMetodo).map(([metodo, monto]) => (
                    <div key={metodo} className="dt-row">
                      <span className="k" style={{ textTransform: 'capitalize' }}>{metodo}</span>
                      <span>${(monto as number).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <h3 className="cat-subheader">Servicios vendidos</h3>
                {periodoDetalle.servicios.length === 0 ? (
                  <p className="empty-state">Sin servicios</p>
                ) : (
                  <div className="list">
                    {periodoDetalle.servicios.map(s => (
                      <div key={s.nombre} className="list-row static">
                        <div className="main">
                          <div className="title">{s.nombre}</div>
                          <div className="sub">{s.cantidad} vendidos</div>
                        </div>
                        <div className="amount">${s.monto.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="cat-subheader">Cafetería / productos vendidos</h3>
                {periodoDetalle.productos.length === 0 ? (
                  <p className="empty-state">Sin productos</p>
                ) : (
                  <div className="list">
                    {periodoDetalle.productos.map(p => (
                      <div key={p.nombre} className="list-row static">
                        <div className="main">
                          <div className="title">{p.nombre}</div>
                          <div className="sub">{p.cantidad} vendidos</div>
                        </div>
                        <div className="amount">${p.monto.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="cat-subheader">Gastos ({periodoDetalle.gastosDetalle.length})</h3>
                {periodoDetalle.gastosDetalle.length === 0 ? (
                  <p className="empty-state">Sin gastos</p>
                ) : (
                  <div className="list">
                    {periodoDetalle.gastosDetalle.map(g => (
                      <div key={g.id} className="list-row static">
                        <div className="main">
                          <div className="title">{g.descripcion}</div>
                          <div className="sub">{g.categoria}{g.registradoPor ? ` · ${g.registradoPor}` : ''}</div>
                        </div>
                        <div className="amount">${g.monto.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="modal-buttons">
                  <button className="btn-cancel" onClick={() => setShowPeriodoModal(false)}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAutosModal && (
        <div className="modal-overlay" onClick={() => setShowAutosModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {autosDetalleLoading || !autosDetalle ? (
              <p className="empty-state">Cargando...</p>
            ) : (
              <>
                <h2>Autos lavados del mes</h2>
                <div className="detail-card">
                  <div className="dt-row">
                    <span className="k">Total de autos lavados</span>
                    <span style={{ fontWeight: 700 }}>{autosDetalle.totalAutos}</span>
                  </div>
                  <div className="dt-row">
                    <span className="k">Promedio por día (con ventas)</span>
                    <span>{autosDetalle.promedioPorDia.toFixed(1)}</span>
                  </div>
                </div>

                <h3 className="cat-subheader">Servicios más vendidos</h3>
                {autosDetalle.servicios.length === 0 ? (
                  <p className="empty-state">Sin servicios</p>
                ) : (
                  <div className="list">
                    {autosDetalle.servicios.map(s => (
                      <div key={s.nombre} className="list-row static">
                        <div className="main">
                          <div className="title">{s.nombre}</div>
                          <div className="sub">{s.cantidad} autos</div>
                        </div>
                        <div className="amount">${s.monto.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="cat-subheader">Cafetería / productos más vendidos</h3>
                {autosDetalle.productos.length === 0 ? (
                  <p className="empty-state">Sin productos</p>
                ) : (
                  <div className="list">
                    {autosDetalle.productos.map(p => (
                      <div key={p.nombre} className="list-row static">
                        <div className="main">
                          <div className="title">{p.nombre}</div>
                          <div className="sub">{p.cantidad} vendidos</div>
                        </div>
                        <div className="amount">${p.monto.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="cat-subheader">Detalle de autos lavados ({autosDetalle.eventos.length})</h3>
                {autosDetalle.eventos.length === 0 ? (
                  <p className="empty-state">Sin registros</p>
                ) : (
                  <div className="list">
                    {autosDetalle.eventos.map((ev, i) => (
                      <div key={i} className="list-row static">
                        <div className="main">
                          <div className="title">{ev.servicio}</div>
                          <div className="sub">
                            {new Date(ev.fecha).toLocaleDateString('es-SV')}
                            {ev.socio ? ` · Socio: ${ev.socio}` : ''}
                            {ev.lavadores.length > 0 ? ` · ${ev.lavadores.join(' + ')}` : ''}
                          </div>
                        </div>
                        <div className="amount">${ev.total.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="modal-buttons">
                  <button className="btn-cancel" onClick={() => setShowAutosModal(false)}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showLavadoresModal && (
        <div className="modal-overlay" onClick={() => { setShowLavadoresModal(false); setMetaEdit(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {lavadoresDetalleLoading || !lavadoresDetalle ? (
              <p className="empty-state">Cargando...</p>
            ) : (
              <>
                <h2>Lavadores del mes</h2>
                {lavadoresDetalle.length === 0 ? (
                  <p className="empty-state">Sin lavadores</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {lavadoresDetalle.map((l, i) => (
                      <div key={l.id} className="detail-card">
                        <div className="dt-row" style={{ borderBottom: 'none', fontWeight: 700 }}>
                          <span>{i === 0 ? '🏆 ' : ''}{l.nombre}</span>
                          <span>${l.ventasAtribuidas.toFixed(2)}</span>
                        </div>
                        <div className="dt-row">
                          <span className="k">Autos lavados (solo)</span>
                          <span>{l.autosSolo}</span>
                        </div>
                        <div className="dt-row">
                          <span className="k">Autos lavados (compartidos)</span>
                          <span>{l.autosCompartido}</span>
                        </div>
                        <div className="dt-row">
                          <span className="k">Total autos</span>
                          <span style={{ fontWeight: 700 }}>{l.autosTotal}</span>
                        </div>
                        <div className="dt-row">
                          <span className="k">Comisión ({l.comisionPercent}% sobre lavados {'>'} ${l.comisionThreshold})</span>
                          <span>${l.comisionTotal.toFixed(2)}</span>
                        </div>
                        {l.servicios.map(s => (
                          <div key={s.nombre} className="dt-row">
                            <span className="k">{s.nombre}</span>
                            <span>{s.cantidad}</span>
                          </div>
                        ))}
                        <div className="dt-row" style={{ alignItems: 'center' }}>
                          <span className="k">Meta de autos (mes)</span>
                          {metaEdit && metaEdit.id === l.id ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="number"
                                min="0"
                                value={metaEdit.value}
                                onChange={e => setMetaEdit({ id: l.id, value: e.target.value })}
                                style={{ width: 70 }}
                                autoFocus
                              />
                              <button className="btn-confirm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => handleSaveMeta(l.id)} disabled={submitting}>
                                Guardar
                              </button>
                              <button className="btn-cancel" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setMetaEdit(null)}>
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {l.meta ? (
                                <span style={{ color: l.autosTotal >= l.meta ? 'var(--green)' : 'var(--muted)' }}>
                                  {l.autosTotal} / {l.meta}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--muted)' }}>Sin meta</span>
                              )}
                              <button
                                className="btn-secondary"
                                style={{ padding: '2px 8px', fontSize: 12 }}
                                onClick={() => setMetaEdit({ id: l.id, value: l.meta ? String(l.meta) : '' })}
                              >
                                Editar
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="modal-buttons">
                  <button className="btn-cancel" onClick={() => { setShowLavadoresModal(false); setMetaEdit(null) }}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
