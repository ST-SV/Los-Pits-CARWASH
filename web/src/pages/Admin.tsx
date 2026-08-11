import { useEffect, useState } from 'react'
import { useApp } from '../context/useApp'

type SubTab = 'historial' | 'contabilidad' | 'empleados' | 'horarios' | 'catalogo' | 'auditoria' | 'config'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

interface Cierre {
  id: string
  fecha: string
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
    nominaYaRegistrada: number
    planillaCalculada: number
    balance: number
  }
  quincenas: { nombre: string; ingresos: number; gastosOperativos: number; planilla: number; balance: number }[]
  empleados: PlanillaEmpleado[]
  totalPlanilla: number
  stats: {
    ticketPromedio: number
    autosLavadosMes: number
    ventasPorMetodo: Record<string, number>
    topLavador: { nombre: string; ventas: number } | null
    ventasQ1: number
    ventasQ2: number
  }
}

interface Empleado {
  id: string
  nombre: string
  apellido?: string | null
  role: string
  dui?: string | null
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
}

const CATEGORIAS_PRODUCTO = ['Bebidas Frías', 'Bebidas Calientes', 'Snacks', 'Otros']

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
  const [planilla, setPlanilla] = useState<Planilla | null>(null)
  const [mesPlanilla, setMesPlanilla] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [descuentoForm, setDescuentoForm] = useState<{ empleadoId: string; empleadoNombre: string; periodoKey: string; periodoLabel: string; monto: string; motivo: string } | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [auditoria, setAuditoria] = useState<AuditEntry[] | null>(null)
  const [horariosData, setHorariosData] = useState<HorariosData | null>(null)
  const [horarioNegocioForm, setHorarioNegocioForm] = useState<HorarioDia[]>([])
  const [turnoForm, setTurnoForm] = useState<{ empleadoId: string; diaSemana: number; horaInicio: string; horaFin: string } | null>(null)

  const [empForm, setEmpForm] = useState<Partial<Empleado> & { pin?: string }>({})
  const [showEmpForm, setShowEmpForm] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Empleado | null>(null)

  const [catForm, setCatForm] = useState<{ tipo: 'servicio' | 'producto'; nombre: string; precio: string; categoria: string; id?: string } | null>(null)

  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const loadTab = (t: SubTab) => {
    if (t === 'historial') {
      fetch(`/api/admin/historial?adminPin=${encodeURIComponent(adminPin)}`)
        .then(r => r.json())
        .then(setHistorial)
        .catch(() => {})
    } else if (t === 'contabilidad') {
      loadPlanilla(mesPlanilla)
    } else if (t === 'empleados') {
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
          categoria: catForm.tipo === 'producto' ? catForm.categoria : undefined,
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
              {historial.cierres.length === 0 ? (
                <p className="empty-state">Sin cierres registrados</p>
              ) : (
                <div className="list">
                  {historial.cierres.map(c => (
                    <div key={c.id} className="list-row static">
                      <div className="main">
                        <div className="title">{new Date(c.fecha).toLocaleDateString('es-SV')}</div>
                        <div className="sub">
                          Ventas ${c.totalVentas.toFixed(2)} · Gastos ${c.totalGastos.toFixed(2)}
                        </div>
                      </div>
                      <div className="amount">${c.neto.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'contabilidad' && (
        <div>
          <div className="action-row" style={{ alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="k">Mes</span>
              <input type="month" value={mesPlanilla} onChange={e => setMesPlanilla(e.target.value)} />
            </label>
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
                  <span className="k">Nómina ya registrada como gasto</span>
                  <span>${planilla.resumenMensual.nominaYaRegistrada.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Planilla calculada (a abonar)</span>
                  <span>${planilla.resumenMensual.planillaCalculada.toFixed(2)}</span>
                </div>
                <div className="dt-row">
                  <span className="k">Balance del mes</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: planilla.resumenMensual.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    ${planilla.resumenMensual.balance.toFixed(2)}
                  </span>
                </div>
              </div>

              <h2>Balance quincenal</h2>
              <div className="stat-grid">
                {planilla.quincenas.map((q, i) => (
                  <div key={i} className="stat-card">
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
                <div className="stat-card">
                  <div className="label">Autos lavados</div>
                  <div className="value yellow">{planilla.stats.autosLavadosMes}</div>
                </div>
                <div className="stat-card">
                  <div className="label">Ticket promedio</div>
                  <div className="value yellow">${planilla.stats.ticketPromedio.toFixed(2)}</div>
                </div>
                <div className="stat-card">
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
                            <span className="k">{p.label}</span>
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
          {empleados.length === 0 ? (
            <p className="empty-state">Sin empleados</p>
          ) : (
            <div className="list">
              {empleados.map(e => (
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
            <button className="btn-secondary" onClick={() => setCatForm({ tipo: 'servicio', nombre: '', precio: '', categoria: '' })}>
              + Servicio
            </button>
            <button className="btn-secondary" onClick={() => setCatForm({ tipo: 'producto', nombre: '', precio: '', categoria: 'Bebidas Frías' })}>
              + Producto
            </button>
          </div>
          <h2>Servicios</h2>
          {!catalogo || catalogo.servicios.length === 0 ? (
            <p className="empty-state">Sin servicios</p>
          ) : (
            <div className="list">
              {catalogo.servicios.map(s => (
                <div
                  key={s.id}
                  className="list-row"
                  onClick={() => setCatForm({ tipo: 'servicio', nombre: s.nombre, precio: String(s.precio), categoria: '', id: s.id })}
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
                    .map(p => (
                      <div
                        key={p.id}
                        className="list-row"
                        onClick={() =>
                          setCatForm({ tipo: 'producto', nombre: p.nombre, precio: String(p.precio), categoria: p.categoria || 'Otros', id: p.id })
                        }
                      >
                        <div className="main">
                          <div className="title">{p.nombre}</div>
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
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'auditoria' && (
        <div>
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
          <h2>Cambiar PIN de Administrador</h2>
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
            <h2>{editingEmp ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
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
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>{editingEmp ? 'Nuevo PIN (opcional)' : 'PIN *'}</label>
              <input type="password" maxLength={4} value={empForm.pin || ''} onChange={e => setEmpForm({ ...empForm, pin: e.target.value })} />
            </div>
            <div className="form-group">
              <label>DUI</label>
              <input value={empForm.dui || ''} onChange={e => setEmpForm({ ...empForm, dui: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={empForm.email || ''} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={empForm.telefono || ''} onChange={e => setEmpForm({ ...empForm, telefono: e.target.value })} />
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
    </div>
  )
}
